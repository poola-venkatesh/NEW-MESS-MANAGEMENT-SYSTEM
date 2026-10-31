import { app } from './app';
import { config } from './config';
import { ensureMealDefinitions } from './services/mealSessionService';

import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { execSync } from 'child_process';
import path from 'path';

async function ensureDatabaseTablesExist() {
  try {
    await prisma.user.count();
  } catch (err: any) {
    if (err?.message?.includes('does not exist') || err?.code === 'P2021') {
      console.warn('⚠️ Database tables missing. Running automatic schema push...');
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env: process.env,
      });
      console.log('✅ Database tables initialized successfully.');
    } else {
      throw err;
    }
  }
}

async function startServer() {
  try {
    // Self-healing database readiness check
    await ensureDatabaseTablesExist();

    // Ensure initial admin user exists
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount === 0) {
      const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminMaster2026!';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await prisma.user.create({
        data: {
          username: process.env.ADMIN_INITIAL_USERNAME || 'admin',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });
      console.log('🛡️ Initial admin account created automatically.');
    }

    // Initialize default meal definitions if needed
    await ensureMealDefinitions();
    console.log('🍽️ Default meal definitions verified.');

    app.listen(config.port, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 Smart Mess Management System Backend Running`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`⏰ Timezone: ${config.hostelTimezone}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
