import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';
import {
  getOrCreateTodayMealSessions,
  getCurrentActiveMealSession,
  ensureMealDefinitions,
  getCurrentDateStr,
} from '../services/mealSessionService';
import { logAuditEvent } from '../services/auditService';

const router = Router();

const updateDefinitionSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
  defaultPrice: z.number().positive('Price must be greater than 0').optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateSessionSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:mm').optional(),
  price: z.number().positive('Price must be greater than 0').optional(),
  menuDescription: z.string().optional(),
  status: z.enum(['SCHEDULED', 'ACTIVE', 'CLOSED']).optional(),
  isSpecialMeal: z.boolean().optional(),
});

/**
 * GET /api/meals/definitions
 * List standard meal definitions
 */
router.get('/definitions', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureMealDefinitions();
    const definitions = await prisma.mealDefinition.findMany({
      orderBy: { startTime: 'asc' },
    });
    return res.json({ definitions });
  } catch (error) {
    console.error('Get definitions error:', error);
    return res.status(500).json({ error: 'Failed to retrieve meal definitions' });
  }
});

/**
 * PATCH /api/meals/definitions/:id
 * Update default meal definition (Admin only)
 */
router.patch('/definitions/:id', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = updateDefinitionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  try {
    const updated = await prisma.mealDefinition.update({
      where: { id: req.params.id },
      data: parseResult.data,
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'MEAL_DEFINITION_UPDATED',
      entityType: 'MealDefinition',
      entityId: updated.id,
      details: parseResult.data,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.json({ message: 'Default meal definition updated', definition: updated });
  } catch (error) {
    console.error('Update definition error:', error);
    return res.status(500).json({ error: 'Failed to update meal definition' });
  }
});

/**
 * GET /api/meals/sessions/today
 * Retrieve today's meal sessions with menus and prices
 */
router.get('/sessions/today', requireAuth, async (req: Request, res: Response) => {
  const targetDate = (req.query.date as string) || getCurrentDateStr();
  try {
    const sessions = await getOrCreateTodayMealSessions(targetDate);
    return res.json({ sessions, date: targetDate });
  } catch (error) {
    console.error('Get today sessions error:', error);
    return res.status(500).json({ error: 'Failed to retrieve meal sessions' });
  }
});

/**
 * GET /api/meals/sessions/current
 * Retrieve currently active meal session
 */
router.get('/sessions/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await getCurrentActiveMealSession();
    return res.json(result);
  } catch (error) {
    console.error('Get current session error:', error);
    return res.status(500).json({ error: 'Failed to retrieve current active session' });
  }
});

/**
 * PATCH /api/meals/sessions/:id
 * Admin dynamic update of today's menu, timings, or prices
 */
router.patch('/sessions/:id', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = updateSessionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  try {
    const session = await prisma.mealSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) {
      return res.status(404).json({ error: 'Meal session not found' });
    }

    const updated = await prisma.mealSession.update({
      where: { id: session.id },
      data: parseResult.data,
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
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
  } catch (error) {
    console.error('Update meal session error:', error);
    return res.status(500).json({ error: 'Failed to update meal session' });
  }
});

/**
 * GET /api/meals/calendar
 * Get academic calendar periods
 */
router.get('/calendar', requireAuth, async (req: Request, res: Response) => {
  try {
    const calendars = await prisma.academicCalendar.findMany({
      orderBy: { startDate: 'desc' },
    });
    return res.json({ calendars });
  } catch (error) {
    console.error('Get calendar error:', error);
    return res.status(500).json({ error: 'Failed to retrieve academic calendar' });
  }
});

export default router;
