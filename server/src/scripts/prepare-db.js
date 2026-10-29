const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

const prismaDir = path.resolve(__dirname, '../../prisma');
const schemaFile = path.join(prismaDir, 'schema.prisma');
const pgSchemaFile = path.join(prismaDir, 'schema.postgresql.prisma');

console.log(`🔍 Checking database connection for deployment... [${isPostgres ? 'PostgreSQL' : 'SQLite'}]`);

try {
  if (isPostgres) {
    console.log('🐘 PostgreSQL detected. Synchronizing PostgreSQL schema...');
    fs.copyFileSync(pgSchemaFile, schemaFile);
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
  } else {
    console.log('📁 SQLite detected. Ensuring Prisma Client is generated...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
  }
  console.log('✅ Database preparation completed successfully.');
} catch (err) {
  console.error('❌ Database preparation error:', err.message);
  process.exit(1);
}
