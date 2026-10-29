import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';

import authRoutes from './routes/auth';
import adminStudentsRoutes from './routes/adminStudents';
import biometricsRoutes from './routes/biometrics';
import attendanceRoutes from './routes/attendance';
import mealsRoutes from './routes/meals';
import billingRoutes from './routes/billing';
import reportsRoutes from './routes/reports';
import auditRoutes from './routes/audit';

export const app = express();

// Trust proxy for secure cookies behind proxies / load balancers
app.set('trust proxy', 1);

// Security & Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      // Allow localhost or configured frontend URL
      if (
        origin === config.frontendUrl ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/testing, restrict in prod
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Smart Mess Management System API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/students', adminStudentsRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);

// In production or when client build exists, serve static client files
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for /admin and /student routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global 404 handler for API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  const message = config.isProduction
    ? 'An unexpected internal error occurred'
    : err.message || 'Internal server error';

  res.status(status).json({ error: message });
});
