import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { logAuditEvent } from '../services/auditService';

const router = Router();

const studentRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  studentId: z.string().min(2, 'College student ID is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric, dots, and underscores'),
  password: z.string().min(8, 'Initial password must be at least 8 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  course: z.string().optional().or(z.literal('')),
  hostelBlock: z.string().optional().or(z.literal('')),
  roomNo: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
});

const studentUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  course: z.string().optional().or(z.literal('')),
  hostelBlock: z.string().optional().or(z.literal('')),
  roomNo: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
});

const passwordResetSchema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  reason: z.string().min(3, 'Reason for password reset is required'),
});

/**
 * GET /api/admin/students
 * List, search, and filter students
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  const search = (req.query.search as string) || '';
  const block = (req.query.block as string) || '';
  const status = (req.query.status as string) || 'all'; // all, active, inactive, enrolled, not_enrolled

  try {
    const whereClause: any = {
      softDeleted: false,
    };

    if (search) {
      whereClause.OR = [
        { fullName: { contains: search } },
        { studentId: { contains: search } },
        { user: { username: { contains: search } } },
      ];
    }

    if (block) {
      whereClause.hostelBlock = block;
    }

    if (status === 'active') {
      whereClause.user = { ...whereClause.user, isActive: true };
    } else if (status === 'inactive') {
      whereClause.user = { ...whereClause.user, isActive: false };
    } else if (status === 'enrolled') {
      whereClause.faceEnrolled = true;
    } else if (status === 'not_enrolled') {
      whereClause.faceEnrolled = false;
    }

    const students = await prisma.studentProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        charges: {
          where: { status: 'APPLIED' },
          select: { amount: true },
        },
        payments: {
          select: { amount: true },
        },
        adjustments: {
          select: { amount: true, type: true },
        },
      },
      orderBy: { studentId: 'asc' },
    });

    // Compute live balance for each student
    const result = students.map((s) => {
      const totalCharges = s.charges.reduce((sum, c) => sum + Number(c.amount), 0);
      const totalPayments = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const netAdjustments = s.adjustments.reduce((sum, a) => {
        return a.type === 'CREDIT_REFUND' ? sum + Number(a.amount) : sum - Number(a.amount);
      }, 0);
      const outstandingBalance = Number(
        (totalCharges - totalPayments - netAdjustments).toFixed(2)
      );

      return {
        id: s.id,
        userId: s.userId,
        studentId: s.studentId,
        username: s.user.username,
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        course: s.course,
        hostelBlock: s.hostelBlock,
        roomNo: s.roomNo,
        remarks: s.remarks,
        isActive: s.user.isActive,
        faceEnrolled: s.faceEnrolled,
        faceEnrolledAt: s.faceEnrolledAt,
        outstandingBalance,
        totalMealsConsumed: s.charges.length,
        createdAt: s.createdAt,
      };
    });

    return res.json({ students: result });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ error: 'Failed to retrieve students' });
  }
});

/**
 * POST /api/admin/students
 * Manual student registration by authorized admin
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = studentRegistrationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const {
    fullName,
    studentId,
    username,
    password,
    email,
    phone,
    course,
    hostelBlock,
    roomNo,
    remarks,
  } = parseResult.data;

  try {
    // Check username uniqueness
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res.status(409).json({ error: `Username "${username}" is already in use.` });
    }

    // Check college studentId uniqueness
    const existingStudentId = await prisma.studentProfile.findUnique({
      where: { studentId },
    });
    if (existingStudentId) {
      return res.status(409).json({ error: `College Student ID "${studentId}" is already registered.` });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Create User and StudentProfile in single atomic transaction
    const newStudent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          role: 'STUDENT',
          isActive: true,
        },
      });

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          studentId,
          fullName,
          email: email || null,
          phone: phone || null,
          course: course || null,
          hostelBlock: hostelBlock || null,
          roomNo: roomNo || null,
          remarks: remarks || null,
          faceEnrolled: false,
        },
      });

      return { user, profile };
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'STUDENT_REGISTER',
      entityType: 'StudentProfile',
      entityId: newStudent.profile.id,
      details: {
        studentId: newStudent.profile.studentId,
        username: newStudent.user.username,
        fullName: newStudent.profile.fullName,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.status(201).json({
      message: 'Student registered successfully',
      student: {
        id: newStudent.profile.id,
        userId: newStudent.user.id,
        studentId: newStudent.profile.studentId,
        username: newStudent.user.username,
        fullName: newStudent.profile.fullName,
        email: newStudent.profile.email,
        phone: newStudent.profile.phone,
        course: newStudent.profile.course,
        hostelBlock: newStudent.profile.hostelBlock,
        roomNo: newStudent.profile.roomNo,
        faceEnrolled: false,
        createdAt: newStudent.profile.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to create student account' });
  }
});

/**
 * GET /api/admin/students/:id
 * Retrieve individual student details
 */
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            createdAt: true,
          },
        },
        biometric: {
          select: {
            id: true,
            modelVersion: true,
            qualityScore: true,
            consentTimestamp: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json({ student });
  } catch (error) {
    console.error('Get student error:', error);
    return res.status(500).json({ error: 'Failed to retrieve student' });
  }
});

/**
 * PATCH /api/admin/students/:id
 * Update permitted student fields
 */
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = studentUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const updated = await prisma.studentProfile.update({
      where: { id: req.params.id },
      data: {
        fullName: parseResult.data.fullName ?? student.fullName,
        email: parseResult.data.email !== undefined ? parseResult.data.email || null : student.email,
        phone: parseResult.data.phone !== undefined ? parseResult.data.phone || null : student.phone,
        course: parseResult.data.course !== undefined ? parseResult.data.course || null : student.course,
        hostelBlock: parseResult.data.hostelBlock !== undefined ? parseResult.data.hostelBlock || null : student.hostelBlock,
        roomNo: parseResult.data.roomNo !== undefined ? parseResult.data.roomNo || null : student.roomNo,
        remarks: parseResult.data.remarks !== undefined ? parseResult.data.remarks || null : student.remarks,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'STUDENT_UPDATE',
      entityType: 'StudentProfile',
      entityId: updated.id,
      details: parseResult.data,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({ message: 'Student record updated', student: updated });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({ error: 'Failed to update student' });
  }
});

/**
 * POST /api/admin/students/:id/reset-password
 * Admin password reset workflow
 */
router.post('/:id/reset-password', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = passwordResetSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { newPassword, reason } = parseResult.data;

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash: newHash },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'STUDENT_PASSWORD_RESET',
      entityType: 'User',
      entityId: student.userId,
      details: { studentId: student.studentId, reason },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * POST /api/admin/students/:id/toggle-active
 * Activate or deactivate student account
 */
router.post('/:id/toggle-active', requireAdmin, async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const newStatus = !student.user.isActive;

    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: newStatus },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: newStatus ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
      entityType: 'User',
      entityId: student.userId,
      details: { studentId: student.studentId, newStatus },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({
      message: `Student account ${newStatus ? 'activated' : 'deactivated'} successfully`,
      isActive: newStatus,
    });
  } catch (error) {
    console.error('Toggle active error:', error);
    return res.status(500).json({ error: 'Failed to update account status' });
  }
});

/**
 * DELETE /api/admin/students/:id
 * Soft delete student account with financial preservation
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Soft delete: set softDeleted = true, user.isActive = false. Preserve all charges, payments, attendances!
    await prisma.$transaction([
      prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          softDeleted: true,
          deletedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: student.userId },
        data: { isActive: false },
      }),
    ]);

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'STUDENT_ACCOUNT_DELETED',
      entityType: 'StudentProfile',
      entityId: student.id,
      details: {
        studentId: student.studentId,
        note: 'Soft deleted to preserve financial and attendance integrity',
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({
      message: 'Student account safely removed. Financial and attendance records preserved.',
    });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Failed to delete student account' });
  }
});

/**
 * PATCH /api/admin/students/profile/self
 * Allow logged-in student to update permitted profile fields (remarks, phone)
 */
router.patch('/profile/self', requireAuth, async (req: Request, res: Response) => {
  if (req.user?.role !== 'STUDENT' || !req.user.studentProfile) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { remarks, phone } = req.body;

  try {
    const updated = await prisma.studentProfile.update({
      where: { id: req.user.studentProfile.id },
      data: {
        remarks: remarks !== undefined ? remarks : undefined,
        phone: phone !== undefined ? phone : undefined,
      },
    });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'STUDENT_SELF_PROFILE_UPDATE',
      entityType: 'StudentProfile',
      entityId: updated.id,
      details: { remarks, phone },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({ message: 'Profile updated successfully', student: updated });
  } catch (error) {
    console.error('Self profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
