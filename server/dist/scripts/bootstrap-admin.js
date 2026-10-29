"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../prisma");
const auditService_1 = require("../services/auditService");
async function bootstrapAdmin() {
    const args = process.argv.slice(2);
    let username = '';
    let password = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--username' && args[i + 1]) {
            username = args[i + 1];
            i++;
        }
        else if (args[i] === '--password' && args[i + 1]) {
            password = args[i + 1];
            i++;
        }
    }
    if (!username || !password) {
        console.error('Usage: npm run bootstrap-admin -- --username <admin_username> --password <strong_password>');
        console.error('Example: npm run bootstrap-admin -- --username messadmin --password AdminSecretPass2026!');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Error: Password must be at least 8 characters long.');
        process.exit(1);
    }
    const existingAdmin = await prisma_1.prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });
    if (existingAdmin && !args.includes('--force')) {
        console.warn(`WARNING: An admin user (${existingAdmin.username}) already exists.`);
        console.warn('To create an additional admin, add the --force flag.');
        process.exit(1);
    }
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { username },
    });
    if (existingUser) {
        console.error(`Error: User with username "${username}" already exists.`);
        process.exit(1);
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const admin = await prisma_1.prisma.user.create({
        data: {
            username,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
    });
    await (0, auditService_1.logAuditEvent)({
        actorUserId: admin.id,
        actorRole: 'ADMIN',
        action: 'ADMIN_BOOTSTRAP',
        entityType: 'User',
        entityId: admin.id,
        details: {
            username: admin.username,
            note: 'Initial admin account bootstrap executed successfully',
        },
    });
    console.log('---------------------------------------------------------');
    console.log(`✅ Admin account "${username}" bootstrapped successfully!`);
    console.log(`User ID: ${admin.id}`);
    console.log('You can now log in at /admin');
    console.log('---------------------------------------------------------');
}
bootstrapAdmin()
    .catch((e) => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
