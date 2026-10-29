import { prisma } from '../prisma';

export interface AuditLogParams {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
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
  } catch (error) {
    console.error('CRITICAL: Failed to write audit log:', error);
  }
}
