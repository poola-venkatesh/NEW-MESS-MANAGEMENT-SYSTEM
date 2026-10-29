import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { config } from '../config';

// Augment express request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        studentProfile?: {
          id: string;
          studentId: string;
          fullName: string;
        } | null;
      };
    }
  }
}

interface SessionData {
  userId: string;
  role: string;
  timestamp: number;
}

/**
 * Sign session data using HMAC SHA256
 */
export function signSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verify and parse session token
 */
export function verifySession(token: string): SessionData | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(payload)
      .digest('base64url');

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const jsonStr = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed: SessionData = JSON.parse(jsonStr);

    // Max session age: 7 days
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > maxAgeMs) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Attach session cookie to HTTP response
 */
export function setSessionCookie(res: Response, userId: string, role: string) {
  const token = signSession({
    userId,
    role,
    timestamp: Date.now(),
  });

  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear session cookie on logout
 */
export function clearSessionCookie(res: Response) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Middleware: Verify user is authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        studentProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account is inactive or not found.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      studentProfile: user.studentProfile
        ? {
            id: user.studentProfile.id,
            studentId: user.studentProfile.studentId,
            fullName: user.studentProfile.fullName,
          }
        : null,
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Middleware: Enforce Admin role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
    }
    next();
  });
}

/**
 * Middleware: Enforce Student role
 */
export async function requireStudent(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Forbidden: Student privilege required' });
    }
    next();
  });
}

/**
 * Middleware: Enforce IDOR protection.
 * Admin can access any student's record; a Student can ONLY access their own record.
 */
export async function requireSelfOrAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role === 'ADMIN') {
      return next();
    }

    const requestedId = req.params.studentId || req.query.studentId;
    const ownStudentProfileId = req.user?.studentProfile?.id;
    const ownCollegeStudentId = req.user?.studentProfile?.studentId;

    if (
      requestedId &&
      (requestedId === ownStudentProfileId || requestedId === ownCollegeStudentId)
    ) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: You do not have permission to access another student\'s records',
    });
  });
}
