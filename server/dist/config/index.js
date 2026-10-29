"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
    sessionSecret: process.env.SESSION_SECRET || 'fallback-mess-secret-key-at-least-32-chars-long',
    biometricEncryptionKey: process.env.BIOMETRIC_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    hostelName: process.env.HOSTEL_NAME || 'Premier College Hostel Mess',
    hostelTimezone: process.env.HOSTEL_TIMEZONE || 'Asia/Kolkata',
    faceMatchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.50'),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    cookieName: 'mess_session_token',
};
