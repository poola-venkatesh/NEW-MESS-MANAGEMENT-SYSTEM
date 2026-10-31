import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.includes('fallback') || sessionSecret.includes('replace-with')) {
  if (isProduction) {
    console.warn('⚠️ Notice: SESSION_SECRET not provided in environment. Generated secure 256-bit runtime secret.');
  }
  sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
}

let biometricEncryptionKey = process.env.BIOMETRIC_ENCRYPTION_KEY;
if (!biometricEncryptionKey || biometricEncryptionKey.length < 32 || biometricEncryptionKey.includes('0123456789abcdef')) {
  if (isProduction) {
    console.warn('⚠️ Notice: BIOMETRIC_ENCRYPTION_KEY not provided in environment. Generated secure 256-bit runtime key.');
  }
  biometricEncryptionKey = process.env.BIOMETRIC_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
}

let databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
if (
  (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) &&
  !databaseUrl.includes('schema=')
) {
  databaseUrl += databaseUrl.includes('?') ? '&schema=smart_mess' : '?schema=smart_mess';
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  databaseUrl,
  sessionSecret,
  biometricEncryptionKey,
  hostelName: process.env.HOSTEL_NAME || 'Premier College Hostel Mess',
  hostelTimezone: process.env.HOSTEL_TIMEZONE || 'Asia/Kolkata',
  faceMatchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.50'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cookieName: 'mess_session_token',
};
