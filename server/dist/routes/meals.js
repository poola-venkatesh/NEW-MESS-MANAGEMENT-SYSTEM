"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const mealSessionService_1 = require("../services/mealSessionService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
const updateDefinitionSchema = zod_1.z.object({
    startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
    endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
    defaultPrice: zod_1.z.number().positive('Price must be greater than 0').optional(),
    description: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const updateSessionSchema = zod_1.z.object({
    startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
    endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
    price: zod_1.z.number().positive('Price must be greater than 0').optional(),
    menuDescription: zod_1.z.string().optional(),
    status: zod_1.z.enum(['SCHEDULED', 'ACTIVE', 'CLOSED']).optional(),
    isSpecialMeal: zod_1.z.boolean().optional(),
});
/**
 * GET /api/meals/definitions
 * List standard meal definitions
 */
router.get('/definitions', auth_1.requireAuth, async (req, res) => {
    try {
        await (0, mealSessionService_1.ensureMealDefinitions)();
        const definitions = await prisma_1.prisma.mealDefinition.findMany({
            orderBy: { startTime: 'asc' },
        });
        return res.json({ definitions });
    }
    catch (error) {
        console.error('Get definitions error:', error);
        return res.status(500).json({ error: 'Failed to retrieve meal definitions' });
    }
});
/**
 * PATCH /api/meals/definitions/:id
 * Update default meal definition (Admin only)
 */
router.patch('/definitions/:id', auth_1.requireAdmin, async (req, res) => {
    const parseResult = updateDefinitionSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    try {
        const updated = await prisma_1.prisma.mealDefinition.update({
            where: { id: req.params.id },
            data: parseResult.data,
        });
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'MEAL_DEFINITION_UPDATED',
            entityType: 'MealDefinition',
            entityId: updated.id,
            details: parseResult.data,
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        return res.json({ message: 'Default meal definition updated', definition: updated });
    }
    catch (error) {
        console.error('Update definition error:', error);
        return res.status(500).json({ error: 'Failed to update meal definition' });
    }
});
/**
 * GET /api/meals/sessions/today
 * Retrieve today's meal sessions with menus and prices
 */
router.get('/sessions/today', auth_1.requireAuth, async (req, res) => {
    const targetDate = req.query.date || (0, mealSessionService_1.getCurrentDateStr)();
    try {
        const sessions = await (0, mealSessionService_1.getOrCreateTodayMealSessions)(targetDate);
        return res.json({ sessions, date: targetDate });
    }
    catch (error) {
        console.error('Get today sessions error:', error);
        return res.status(500).json({ error: 'Failed to retrieve meal sessions' });
    }
});
/**
 * GET /api/meals/sessions/current
 * Retrieve currently active meal session
 */
router.get('/sessions/current', auth_1.requireAuth, async (req, res) => {
    try {
        const result = await (0, mealSessionService_1.getCurrentActiveMealSession)();
        return res.json(result);
    }
    catch (error) {
        console.error('Get current session error:', error);
        return res.status(500).json({ error: 'Failed to retrieve current active session' });
    }
});
/**
 * PATCH /api/meals/sessions/:id
 * Admin dynamic update of today's menu, timings, or prices
 */
router.patch('/sessions/:id', auth_1.requireAdmin, async (req, res) => {
    const parseResult = updateSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.errors.map((e) => e.message),
        });
    }
    try {
        const session = await prisma_1.prisma.mealSession.findUnique({
            where: { id: req.params.id },
        });
        if (!session) {
            return res.status(404).json({ error: 'Meal session not found' });
        }
        const updated = await prisma_1.prisma.mealSession.update({
            where: { id: session.id },
            data: parseResult.data,
        });
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'MEAL_SESSION_UPDATED',
            entityType: 'MealSession',
            entityId: updated.id,
            details: {
                sessionName: session.name,
                date: session.date,
                updates: parseResult.data,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        return res.json({
            message: `Meal session ${session.name} updated successfully`,
            session: updated,
        });
    }
    catch (error) {
        console.error('Update meal session error:', error);
        return res.status(500).json({ error: 'Failed to update meal session' });
    }
});
/**
 * GET /api/meals/calendar
 * Get academic calendar periods
 */
router.get('/calendar', auth_1.requireAuth, async (req, res) => {
    try {
        const calendars = await prisma_1.prisma.academicCalendar.findMany({
            orderBy: { startDate: 'desc' },
        });
        return res.json({ calendars });
    }
    catch (error) {
        console.error('Get calendar error:', error);
        return res.status(500).json({ error: 'Failed to retrieve academic calendar' });
    }
});
exports.default = router;
