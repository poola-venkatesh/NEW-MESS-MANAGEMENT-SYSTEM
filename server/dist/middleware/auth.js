"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signSession = signSession;
exports.verifySession = verifySession;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireStudent = requireStudent;
exports.requireSelfOrAdmin = requireSelfOrAdmin;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../prisma");
const config_1 = require("../config");
/**
 * Sign session data using HMAC SHA256
 */
function signSession(data) {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto_1.default
        .createHmac('sha256', config_1.config.sessionSecret)
        .update(payload)
        .digest('base64url');
    return `${payload}.${signature}`;
}
/**
 * Verify and parse session token
 */
function verifySession(token) {
    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature)
            return null;
        const expectedSig = crypto_1.default
            .createHmac('sha256', config_1.config.sessionSecret)
            .update(payload)
            .digest('base64url');
        // Constant-time comparison
        if (!crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return null;
        }
        const jsonStr = Buffer.from(payload, 'base64url').toString('utf8');
        const parsed = JSON.parse(jsonStr);
        // Max session age: 7 days
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > maxAgeMs) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Attach session cookie to HTTP response
 */
function setSessionCookie(res, userId, role) {
    const token = signSession({
        userId,
        role,
        timestamp: Date.now(),
    });
    res.cookie(config_1.config.cookieName, token, {
        httpOnly: true,
        secure: config_1.config.isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    });
}
/**
 * Clear session cookie on logout
 */
function clearSessionCookie(res) {
    res.clearCookie(config_1.config.cookieName, {
        httpOnly: true,
        secure: config_1.config.isProduction,
        sameSite: 'lax',
        path: '/',
    });
}
/**
 * Middleware: Verify user is authenticated
 */
async function requireAuth(req, res, next) {
    const token = req.cookies?.[config_1.config.cookieName];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    const session = verifySession(token);
    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    try {
        const user = await prisma_1.prisma.user.findUnique({
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
    }
    catch (error) {
        console.error('Auth verification error:', error);
        res.status(500).json({ error: 'Internal authentication error' });
    }
}
/**
 * Middleware: Enforce Admin role
 */
async function requireAdmin(req, res, next) {
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
async function requireStudent(req, res, next) {
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
async function requireSelfOrAdmin(req, res, next) {
    await requireAuth(req, res, () => {
        if (req.user?.role === 'ADMIN') {
            return next();
        }
        const requestedId = req.params.studentId || req.query.studentId;
        const ownStudentProfileId = req.user?.studentProfile?.id;
        const ownCollegeStudentId = req.user?.studentProfile?.studentId;
        if (requestedId &&
            (requestedId === ownStudentProfileId || requestedId === ownCollegeStudentId)) {
            return next();
        }
        return res.status(403).json({
            error: 'Forbidden: You do not have permission to access another student\'s records',
        });
    });
}
