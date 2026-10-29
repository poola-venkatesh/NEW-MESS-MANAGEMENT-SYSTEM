"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * GET /api/audit/logs
 * Retrieve system audit logs (Admin only)
 */
router.get('/logs', auth_1.requireAdmin, async (req, res) => {
    const action = req.query.action;
    const entityType = req.query.entityType;
    const entityId = req.query.entityId;
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = parseInt(req.query.skip || '0', 10);
    try {
        const where = {};
        if (action)
            where.action = action;
        if (entityType)
            where.entityType = entityType;
        if (entityId)
            where.entityId = entityId;
        const [logs, total] = await Promise.all([
            prisma_1.prisma.auditLog.findMany({
                where,
                include: {
                    actorUser: {
                        select: {
                            id: true,
                            username: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            prisma_1.prisma.auditLog.count({ where }),
        ]);
        return res.json({ logs, total });
    }
    catch (error) {
        console.error('Audit logs error:', error);
        return res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});
exports.default = router;
