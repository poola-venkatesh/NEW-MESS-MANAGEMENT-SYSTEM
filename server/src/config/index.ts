import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'fallback-mess-secret-key-at-least-32-chars-long';
const biometricEncryptionKey =
  process.env.BIOMETRIC_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

if (isProduction) {
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.includes('fallback') ||
    process.env.SESSION_SECRET.includes('replace-with')
  ) {
    throw new Error('SECURITY VIOLATION: SESSION_SECRET must be set to a secure secret in production.');
  }
  if (!process.env.BIOMETRIC_ENCRYPTION_KEY || process.env.BIOMETRIC_ENCRYPTION_KEY.length < 32) {
    throw new Error('SECURITY VIOLATION: BIOMETRIC_ENCRYPTION_KEY must be a secure key in production.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  sessionSecret,
  biometricEncryptionKey,
  hostelName: process.env.HOSTEL_NAME || 'Premier College Hostel Mess',
  hostelTimezone: process.env.HOSTEL_TIMEZONE || 'Asia/Kolkata',
  faceMatchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.50'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieName: 'mess_session_token',
};
