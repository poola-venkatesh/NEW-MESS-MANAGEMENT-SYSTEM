"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const biometricService_1 = require("../services/biometricService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
const enrollSchema = zod_1.z.object({
    studentProfileId: zod_1.z.string().uuid(),
    descriptor: zod_1.z
        .array(zod_1.z.number())
        .length(128, 'Face descriptor must be exactly 128 numbers'),
    consentGiven: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'Informed biometric consent must be given' }),
    }),
    qualityScore: zod_1.z.number().min(0.5, 'Face quality score is too low').optional().default(0.9),
});
const reEnrollSchema = enrollSchema.extend({
    reason: zod_1.z.string().min(5, 'Reason for biometric re-enrollment is required'),
});
/**
 * POST /api/biometrics/enroll
 * Secure face template enrollment
 */
router.post('/enroll', auth_1.requireAdmin, async (req, res) => {
    const parseResult = enrollSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    const { studentProfileId, descriptor, qualityScore } = parseResult.data;
    try {
        const student = await prisma_1.prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { biometric: true },
        });
        if (!student || student.softDeleted) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        if (student.faceEnrolled || student.biometric) {
            return res.status(409).json({
                error: 'Biometrics already enrolled for this student. Use authorized re-enrollment to update.',
            });
        }
        // Encrypt the 128-D vector with AES-256-GCM
        const { encryptedTemplate, iv, authTag } = (0, biometricService_1.encryptTemplate)(descriptor);
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.faceBiometric.create({
                data: {
                    studentId: student.id,
                    encryptedTemplate,
                    iv,
                    authTag,
                    algorithm: 'aes-256-gcm',
                    modelVersion: 'face-api-facenet-v1',
                    qualityScore,
                    enrolledByUserId: req.user.id,
                    consentTimestamp: new Date(),
                },
            });
            await tx.studentProfile.update({
                where: { id: student.id },
                data: {
                    faceEnrolled: true,
                    faceEnrolledAt: new Date(),
                    faceConsentGiven: true,
                },
            });
        });
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'BIOMETRIC_ENROLLED',
            entityType: 'FaceBiometric',
            entityId: student.id,
            details: {
                studentId: student.studentId,
                fullName: student.fullName,
                qualityScore,
                modelVersion: 'face-api-facenet-v1',
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        return res.status(201).json({
            message: 'Face template securely enrolled',
            student: {
                id: student.id,
                studentId: student.studentId,
                fullName: student.fullName,
                faceEnrolled: true,
            },
        });
    }
    catch (error) {
        console.error('Face enrollment error:', error);
        return res.status(500).json({ error: 'Failed to enroll biometric template' });
    }
});
/**
 * POST /api/biometrics/re-enroll
 * Authorized face re-enrollment with previous template replacement
 */
router.post('/re-enroll', auth_1.requireAdmin, async (req, res) => {
    const parseResult = reEnrollSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    const { studentProfileId, descriptor, qualityScore, reason } = parseResult.data;
    try {
        const student = await prisma_1.prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { biometric: true },
        });
        if (!student || student.softDeleted) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        const { encryptedTemplate, iv, authTag } = (0, biometricService_1.encryptTemplate)(descriptor);
        await prisma_1.prisma.$transaction(async (tx) => {
            // Upsert biometric record
            if (student.biometric) {
                await tx.faceBiometric.update({
                    where: { studentId: student.id },
                    data: {
                        encryptedTemplate,
                        iv,
                        authTag,
                        qualityScore,
                        enrolledByUserId: req.user.id,
                        updatedAt: new Date(),
                    },
                });
            }
            else {
                await tx.faceBiometric.create({
                    data: {
                        studentId: student.id,
                        encryptedTemplate,
                        iv,
                        authTag,
                        qualityScore,
                        enrolledByUserId: req.user.id,
                    },
                });
            }
            await tx.studentProfile.update({
                where: { id: student.id },
                data: {
                    faceEnrolled: true,
                    faceEnrolledAt: new Date(),
                    faceConsentGiven: true,
                },
            });
        });
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'BIOMETRIC_RE_ENROLLED',
            entityType: 'FaceBiometric',
            entityId: student.id,
            details: {
                studentId: student.studentId,
                reason,
                qualityScore,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        return res.json({
            message: 'Face template updated successfully',
            student: {
                id: student.id,
                studentId: student.studentId,
                faceEnrolled: true,
            },
        });
    }
    catch (error) {
        console.error('Biometric re-enrollment error:', error);
        return res.status(500).json({ error: 'Failed to update biometric template' });
    }
});
/**
 * DELETE /api/biometrics/:studentProfileId
 * Biometric deletion / revocation procedure
 */
router.delete('/:studentProfileId', auth_1.requireAdmin, async (req, res) => {
    const { studentProfileId } = req.params;
    try {
        const student = await prisma_1.prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { biometric: true },
        });
        if (!student) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            if (student.biometric) {
                await tx.faceBiometric.delete({
                    where: { studentId: student.id },
                });
            }
            await tx.studentProfile.update({
                where: { id: student.id },
                data: {
                    faceEnrolled: false,
                    faceEnrolledAt: null,
                    faceConsentGiven: false,
                },
            });
        });
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'BIOMETRIC_DELETED',
            entityType: 'FaceBiometric',
            entityId: student.id,
            details: {
                studentId: student.studentId,
                note: 'Biometric template permanently purged upon authorized request',
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        return res.json({
            message: 'Biometric data successfully deleted and revoked for this student.',
        });
    }
    catch (error) {
        console.error('Biometric delete error:', error);
        return res.status(500).json({ error: 'Failed to delete biometric data' });
    }
});
exports.default = router;
