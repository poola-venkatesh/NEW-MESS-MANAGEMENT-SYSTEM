"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const mealSessionService_1 = require("./services/mealSessionService");
async function startServer() {
    try {
        // Initialize default meal definitions if needed
        await (0, mealSessionService_1.ensureMealDefinitions)();
        console.log('🍽️ Default meal definitions verified.');
        app_1.app.listen(config_1.config.port, '0.0.0.0', () => {
            console.log(`=======================================================`);
            console.log(`🚀 Smart Mess Management System Backend Running`);
            console.log(`📡 URL: http://localhost:${config_1.config.port}`);
            console.log(`🌍 Environment: ${config_1.config.nodeEnv}`);
            console.log(`⏰ Timezone: ${config_1.config.hostelTimezone}`);
            console.log(`=======================================================`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
