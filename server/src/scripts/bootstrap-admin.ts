import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { logAuditEvent } from '../services/auditService';

async function bootstrapAdmin() {
  const args = process.argv.slice(2);
  let username = '';
  let password = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) {
      username = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
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

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin && !args.includes('--force')) {
    console.warn(`WARNING: An admin user (${existingAdmin.username}) already exists.`);
    console.warn('To create an additional admin, add the --force flag.');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    console.error(`Error: User with username "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  await logAuditEvent({
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
    await prisma.$disconnect();
  });
