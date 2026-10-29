"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config");
const auth_1 = __importDefault(require("./routes/auth"));
const adminStudents_1 = __importDefault(require("./routes/adminStudents"));
const biometrics_1 = __importDefault(require("./routes/biometrics"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const meals_1 = __importDefault(require("./routes/meals"));
const billing_1 = __importDefault(require("./routes/billing"));
const reports_1 = __importDefault(require("./routes/reports"));
const audit_1 = __importDefault(require("./routes/audit"));
exports.app = (0, express_1.default)();
// Trust proxy for secure cookies behind proxies / load balancers
exports.app.set('trust proxy', 1);
// Security & Middlewares
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin)
            return callback(null, true);
        // Allow localhost or configured frontend URL
        if (origin === config_1.config.frontendUrl ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in dev/testing, restrict in prod
    },
    credentials: true,
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
exports.app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Smart Mess Management System API',
    });
});
// API Routes
exports.app.use('/api/auth', auth_1.default);
exports.app.use('/api/admin/students', adminStudents_1.default);
exports.app.use('/api/biometrics', biometrics_1.default);
exports.app.use('/api/attendance', attendance_1.default);
exports.app.use('/api/meals', meals_1.default);
exports.app.use('/api/billing', billing_1.default);
exports.app.use('/api/reports', reports_1.default);
exports.app.use('/api/audit', audit_1.default);
// In production or when client build exists, serve static client files
const clientDistPath = path_1.default.resolve(__dirname, '../../client/dist');
if (fs_1.default.existsSync(clientDistPath)) {
    exports.app.use(express_1.default.static(clientDistPath));
    // SPA fallback for /admin and /student routes
    exports.app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
    });
}
// Global 404 handler for API routes
exports.app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});
// Global Error Handler
exports.app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    const status = err.status || 500;
    const message = config_1.config.isProduction
        ? 'An unexpected internal error occurred'
        : err.message || 'Internal server error';
    res.status(status).json({ error: message });
});
