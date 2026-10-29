"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
const rateLimitMap = new Map();
// Clean expired entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 60000);
function createRateLimiter(options) {
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${req.baseUrl}${req.path}:${ip}`;
        const now = Date.now();
        const entry = rateLimitMap.get(key);
        if (!entry || now > entry.resetTime) {
            rateLimitMap.set(key, {
                count: 1,
                resetTime: now + options.windowMs,
            });
            return next();
        }
        if (entry.count >= options.maxRequests) {
            return res.status(429).json({
                error: options.message ||
                    'Too many requests from this IP. Please try again after a few moments.',
            });
        }
        entry.count += 1;
        next();
    };
}
