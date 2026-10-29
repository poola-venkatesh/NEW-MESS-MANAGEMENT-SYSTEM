"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const biometricService_1 = require("../services/biometricService");
const mealSessionService_1 = require("../services/mealSessionService");
const auditService_1 = require("../services/auditService");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const verifyLimiter = (0, rateLimiter_1.createRateLimiter)({
    windowMs: 10 * 1000,
    maxRequests: 30,
});
const verifyEntrySchema = zod_1.z.object({
    probeDescriptor: zod_1.z
        .array(zod_1.z.number())
        .length(128, 'Probe face descriptor must be a 128-dimensional vector'),
    overrideDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    overrideTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
const manualEntrySchema = zod_1.z.object({
    studentProfileId: zod_1.z.string().uuid(),
    mealSessionId: zod_1.z.string().uuid().optional(),
    reason: zod_1.z.string().min(5, 'A specific audit justification is required for manual entry'),
});
const voidAttendanceSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'A detailed reason is required to void attendance'),
});
/**
 * POST /api/attendance/verify-entry
 * Authoritative biometric face verification and atomic attendance + charge creation
 */
router.post('/verify-entry', verifyLimiter, async (req, res) => {
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
        const match = await (0, biometricService_1.findBestFaceMatch)(probeDescriptor);
        if (!match) {
            await (0, auditService_1.logAuditEvent)({
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
        const { activeSession, currentDate, currentTime } = await (0, mealSessionService_1.getCurrentActiveMealSession)(overrideDate, overrideTime);
        if (!activeSession) {
            return res.status(400).json({
                error: `No meal session is currently active at this time (${currentTime}). Normal attendance is closed.`,
                currentTime,
                currentDate,
            });
        }
        // 3. Verify student status
        const student = await prisma_1.prisma.studentProfile.findUnique({
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
            result = await prisma_1.prisma.$transaction(async (tx) => {
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
        }
        catch (txError) {
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
        await (0, auditService_1.logAuditEvent)({
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
    }
    catch (error) {
        console.error('Verify entry error:', error);
        return res.status(500).json({ error: 'Internal error processing meal attendance' });
    }
});
/**
 * POST /api/attendance/manual-entry
 * Audited manual attendance creation for exceptions (Admin only)
 */
router.post('/manual-entry', auth_1.requireAdmin, async (req, res) => {
    const parseResult = manualEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    const { studentProfileId, mealSessionId, reason } = parseResult.data;
    try {
        const student = await prisma_1.prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { user: true },
        });
        if (!student || student.softDeleted || !student.user.isActive) {
            return res.status(404).json({ error: 'Active student not found' });
        }
        // Resolve target session: if specified, use it; otherwise resolve current active session
        let targetSession;
        if (mealSessionId) {
            targetSession = await prisma_1.prisma.mealSession.findUnique({
                where: { id: mealSessionId },
            });
        }
        else {
            const resolved = await (0, mealSessionService_1.getCurrentActiveMealSession)();
            targetSession = resolved.activeSession;
        }
        if (!targetSession) {
            return res.status(400).json({ error: 'No active or valid meal session found' });
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
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
                    verifiedByUserId: req.user.id,
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
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
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
    }
    catch (error) {
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
router.post('/:id/void', auth_1.requireAdmin, async (req, res) => {
    const parseResult = voidAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    const { reason } = parseResult.data;
    try {
        const attendance = await prisma_1.prisma.attendance.findUnique({
            where: { id: req.params.id },
            include: { student: true, charge: true, mealSession: true },
        });
        if (!attendance) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        if (attendance.status === 'VOIDED_BY_AUDIT') {
            return res.status(400).json({ error: 'Attendance record is already voided' });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
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
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
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
    }
    catch (error) {
        console.error('Void attendance error:', error);
        return res.status(500).json({ error: 'Failed to void attendance record' });
    }
});
/**
 * GET /api/attendance/history
 * List attendance with filtering (Admin or self-student)
 */
router.get('/history', auth_1.requireAuth, async (req, res) => {
    const studentProfileId = req.query.studentProfileId || '';
    const date = req.query.date || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const mealName = req.query.mealName || '';
    // If student role, restrict to own profile
    let targetStudentId = studentProfileId;
    if (req.user?.role === 'STUDENT') {
        targetStudentId = req.user.studentProfile?.id || '__none__';
    }
    try {
        const whereClause = {};
        if (targetStudentId) {
            whereClause.studentId = targetStudentId;
        }
        if (date) {
            whereClause.date = date;
        }
        else if (startDate && endDate) {
            whereClause.date = { gte: startDate, lte: endDate };
        }
        if (mealName) {
            whereClause.mealSession = { name: mealName };
        }
        const records = await prisma_1.prisma.attendance.findMany({
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
    }
    catch (error) {
        console.error('Attendance history error:', error);
        return res.status(500).json({ error: 'Failed to retrieve attendance history' });
    }
});
exports.default = router;
