"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const prisma_1 = require("../prisma");
async function logAuditEvent(params) {
    try {
        await prisma_1.prisma.auditLog.create({
            data: {
                actorUserId: params.actorUserId || null,
                actorRole: params.actorRole || null,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId || null,
                details: params.details ? JSON.stringify(params.details) : null,
                ipAddress: params.ipAddress || null,
                userAgent: params.userAgent || null,
            },
        });
    }
    catch (error) {
        console.error('CRITICAL: Failed to write audit log:', error);
    }
}
