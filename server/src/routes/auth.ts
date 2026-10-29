import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { setSessionCookie, clearSessionCookie, requireAuth } from '../middleware/auth';
import { logAuditEvent } from '../services/auditService';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many login attempts. Please wait 1 minute before trying again.',
});

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { username, password } = parseResult.data;
  const ipAddress = req.ip || req.socket.remoteAddress;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        studentProfile: true,
      },
    });

    if (!user || !user.isActive) {
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        details: { username, reason: 'Invalid username or inactive user' },
        ipAddress,
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await logAuditEvent({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        details: { username, reason: 'Password mismatch' },
        ipAddress,
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set HTTP-only secure cookie
    setSessionCookie(res, user.id, user.role);

    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        studentProfile: user.studentProfile
          ? {
              id: user.studentProfile.id,
              studentId: user.studentProfile.studentId,
              fullName: user.studentProfile.fullName,
              email: user.studentProfile.email,
              hostelBlock: user.studentProfile.hostelBlock,
              roomNo: user.studentProfile.roomNo,
              faceEnrolled: user.studentProfile.faceEnrolled,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress;

  if (req.user) {
    await logAuditEvent({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      ipAddress,
    });
  }

  clearSessionCookie(res);
  return res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        studentProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        studentProfile: user.studentProfile
          ? {
              id: user.studentProfile.id,
              studentId: user.studentProfile.studentId,
              fullName: user.studentProfile.fullName,
              email: user.studentProfile.email,
              phone: user.studentProfile.phone,
              hostelBlock: user.studentProfile.hostelBlock,
              roomNo: user.studentProfile.roomNo,
              remarks: user.studentProfile.remarks,
              faceEnrolled: user.studentProfile.faceEnrolled,
              faceEnrolledAt: user.studentProfile.faceEnrolledAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Auth /me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
