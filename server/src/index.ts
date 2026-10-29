import { app } from './app';
import { config } from './config';
import { ensureMealDefinitions } from './services/mealSessionService';

async function startServer() {
  try {
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
