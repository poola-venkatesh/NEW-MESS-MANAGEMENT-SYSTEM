import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin, requireAuth, requireSelfOrAdmin } from '../middleware/auth';
import { findBestFaceMatch } from '../services/biometricService';
import { getCurrentActiveMealSession, getCurrentDateStr } from '../services/mealSessionService';
import { logAuditEvent } from '../services/auditService';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const verifyLimiter = createRateLimiter({
  windowMs: 10 * 1000,
  maxRequests: 30,
});

const verifyEntrySchema = z.object({
  probeDescriptor: z
    .array(z.number())
    .length(128, 'Probe face descriptor must be a 128-dimensional vector'),
  overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  overrideTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const manualEntrySchema = z.object({
  studentProfileId: z.string().uuid(),
  mealSessionId: z.string().uuid().optional(),
  reason: z.string().min(5, 'A specific audit justification is required for manual entry'),
});

const voidAttendanceSchema = z.object({
  reason: z.string().min(5, 'A detailed reason is required to void attendance'),
});

/**
 * POST /api/attendance/verify-entry
 * Authoritative biometric face verification and atomic attendance + charge creation
 */
router.post('/verify-entry', verifyLimiter, async (req: Request, res: Response) => {
  const parseResult = verifyEntrySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid biometric probe data',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { probeDescriptor, overrideDate, overrideTime } = parseResult.data;
  const ipAddress = req.ip || req.socket.remoteAddress;

  try {
    // 1. Authoritative face recognition on backend
    const match = await findBestFaceMatch(probeDescriptor);
    if (!match) {
      await logAuditEvent({
        action: 'ATTENDANCE_SCAN_UNRECOGNIZED',
        entityType: 'Attendance',
        details: { reason: 'No face matched above confidence threshold' },
        ipAddress,
      });
      return res.status(422).json({
        error: 'Face not recognized. Please adjust lighting, face the camera directly, or contact the mess admin.',
      });
    }

    // 2. Resolve active meal session
    const { activeSession, currentDate, currentTime } = await getCurrentActiveMealSession(
      overrideDate,
      overrideTime
    );

    if (!activeSession) {
      return res.status(400).json({
        error: `No meal session is currently active at this time (${currentTime}). Normal attendance is closed.`,
        currentTime,
        currentDate,
      });
    }

    // 3. Verify student status
    const student = await prisma.studentProfile.findUnique({
      where: { id: match.studentId },
      include: { user: true },
    });

    if (!student || student.softDeleted || !student.user.isActive) {
      return res.status(403).json({
        error: 'Student account is inactive or not found. Access denied.',
      });
    }

    // 4. Atomic transaction: Check duplicate, create Attendance, create Charge
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Duplicate check
        const existingAttendance = await tx.attendance.findUnique({
          where: {
            studentId_mealSessionId: {
              studentId: student.id,
              mealSessionId: activeSession.id,
            },
          },
        });

        if (existingAttendance) {
          throw new Error('DUPLICATE_SCAN');
        }

        // Create Attendance record
        const attendance = await tx.attendance.create({
          data: {
            studentId: student.id,
            mealSessionId: activeSession.id,
            date: currentDate,
            verifiedAt: new Date(),
            verificationMethod: 'FACE_BIOMETRIC',
            confidenceScore: match.confidenceScore,
            status: 'VALID',
          },
        });

        // Create Charge record using snapshot meal price
        const charge = await tx.charge.create({
          data: {
            studentId: student.id,
            mealSessionId: activeSession.id,
            attendanceId: attendance.id,
            amount: activeSession.price,
            mealName: activeSession.name,
            date: currentDate,
            status: 'APPLIED',
          },
        });

        return { attendance, charge };
      });
    } catch (txError: any) {
      if (txError.message === 'DUPLICATE_SCAN' || txError.code === 'P2002') {
        return res.status(409).json({
          error: `Duplicate scan: ${student.fullName} (${student.studentId}) is already checked into ${activeSession.name} today.`,
          alreadyCheckedIn: true,
          student: {
            studentId: student.studentId,
            fullName: student.fullName,
          },
        });
      }
      throw txError;
    }

    await logAuditEvent({
      actorUserId: student.userId,
      actorRole: 'STUDENT',
      action: 'ATTENDANCE_RECORDED',
      entityType: 'Attendance',
      entityId: result.attendance.id,
      details: {
        studentId: student.studentId,
        fullName: student.fullName,
        mealSession: activeSession.name,
        price: activeSession.price,
        confidenceScore: match.confidenceScore,
      },
      ipAddress,
    });

    return res.status(201).json({
      message: `Welcome, ${student.fullName}! Check-in confirmed for ${activeSession.name}.`,
      success: true,
      student: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        hostelBlock: student.hostelBlock,
        roomNo: student.roomNo,
      },
      mealSession: {
        name: activeSession.name,
        date: activeSession.date,
        price: Number(activeSession.price),
      },
      chargeAmount: Number(result.charge.amount),
      verifiedAt: result.attendance.verifiedAt,
      confidenceScore: match.confidenceScore,
    });
  } catch (error) {
    console.error('Verify entry error:', error);
    return res.status(500).json({ error: 'Internal error processing meal attendance' });
  }
});

/**
 * POST /api/attendance/manual-entry
 * Audited manual attendance creation for exceptions (Admin only)
 */
router.post('/manual-entry', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = manualEntrySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { studentProfileId, mealSessionId, reason } = parseResult.data;

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { user: true },
    });

    if (!student || student.softDeleted || !student.user.isActive) {
      return res.status(404).json({ error: 'Active student not found' });
    }

    // Resolve target session: if specified, use it; otherwise resolve current active session
    let targetSession;
    if (mealSessionId) {
      targetSession = await prisma.mealSession.findUnique({
        where: { id: mealSessionId },
      });
    } else {
      const resolved = await getCurrentActiveMealSession();
      targetSession = resolved.activeSession;
    }

    if (!targetSession) {
      return res.status(400).json({ error: 'No active or valid meal session found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: {
          studentId_mealSessionId: {
            studentId: student.id,
            mealSessionId: targetSession.id,
          },
        },
      });

      if (existing) {
        throw new Error('DUPLICATE_SCAN');
      }

      const attendance = await tx.attendance.create({
        data: {
          studentId: student.id,
          mealSessionId: targetSession.id,
          date: targetSession.date,
          verifiedAt: new Date(),
          verificationMethod: 'AUDITED_MANUAL',
          verifiedByUserId: req.user!.id,
          status: 'VALID',
        },
      });

      const charge = await tx.charge.create({
        data: {
          studentId: student.id,
          mealSessionId: targetSession.id,
          attendanceId: attendance.id,
          amount: targetSession.price,
          mealName: targetSession.name,
          date: targetSession.date,
          status: 'APPLIED',
        },
      });

      return { attendance, charge };
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ATTENDANCE_MANUAL_ENTRY',
      entityType: 'Attendance',
      entityId: result.attendance.id,
      details: {
        studentId: student.studentId,
        mealSession: targetSession.name,
        price: targetSession.price,
        reason,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.status(201).json({
      message: `Manual check-in recorded for ${student.fullName}`,
      attendance: result.attendance,
      charge: result.charge,
    });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_SCAN') {
      return res.status(409).json({ error: 'Student already checked into this meal session' });
    }
    console.error('Manual entry error:', error);
    return res.status(500).json({ error: 'Failed to record manual attendance' });
  }
});

/**
 * POST /api/attendance/:id/void
 * Audited correction workflow: void an attendance record and its charge (Admin only)
 */
router.post('/:id/void', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = voidAttendanceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { reason } = parseResult.data;

  try {
    const attendance = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { student: true, charge: true, mealSession: true },
    });

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (attendance.status === 'VOIDED_BY_AUDIT') {
      return res.status(400).json({ error: 'Attendance record is already voided' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          status: 'VOIDED_BY_AUDIT',
          voidReason: reason,
        },
      });

      if (attendance.charge) {
        await tx.charge.update({
          where: { id: attendance.charge.id },
          data: { status: 'VOIDED' },
        });
      }
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ATTENDANCE_VOIDED',
      entityType: 'Attendance',
      entityId: attendance.id,
      details: {
        studentId: attendance.student.studentId,
        mealSession: attendance.mealSession.name,
        voidReason: reason,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({
      message: 'Attendance and linked charge voided successfully with audit record',
    });
  } catch (error) {
    console.error('Void attendance error:', error);
    return res.status(500).json({ error: 'Failed to void attendance record' });
  }
});

/**
 * GET /api/attendance/history
 * List attendance with filtering (Admin or self-student)
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  const studentProfileId = (req.query.studentProfileId as string) || '';
  const date = (req.query.date as string) || '';
  const startDate = (req.query.startDate as string) || '';
  const endDate = (req.query.endDate as string) || '';
  const mealName = (req.query.mealName as string) || '';

  // If student role, restrict to own profile
  let targetStudentId = studentProfileId;
  if (req.user?.role === 'STUDENT') {
    targetStudentId = req.user.studentProfile?.id || '__none__';
  }

  try {
    const whereClause: any = {};

    if (targetStudentId) {
      whereClause.studentId = targetStudentId;
    }

    if (date) {
      whereClause.date = date;
    } else if (startDate && endDate) {
      whereClause.date = { gte: startDate, lte: endDate };
    }

    if (mealName) {
      whereClause.mealSession = { name: mealName };
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            hostelBlock: true,
            roomNo: true,
          },
        },
        mealSession: {
          select: {
            id: true,
            name: true,
            price: true,
            date: true,
          },
        },
        charge: true,
      },
      orderBy: [{ date: 'desc' }, { verifiedAt: 'desc' }],
      take: 100,
    });

    return res.json({ attendances: records });
  } catch (error) {
    console.error('Attendance history error:', error);
    return res.status(500).json({ error: 'Failed to retrieve attendance history' });
  }
});

export default router;
