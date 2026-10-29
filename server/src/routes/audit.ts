import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * GET /api/audit/logs
 * Retrieve system audit logs (Admin only)
 */
router.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  const action = req.query.action as string;
  const entityType = req.query.entityType as string;
  const entityId = req.query.entityId as string;
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const skip = parseInt((req.query.skip as string) || '0', 10);

  try {
    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
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
      prisma.auditLog.count({ where }),
    ]);

    return res.json({ logs, total });
  } catch (error) {
    console.error('Audit logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

export default router;
