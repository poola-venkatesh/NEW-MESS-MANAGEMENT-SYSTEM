const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (isPostgres && !dbUrl.includes('schema=')) {
  dbUrl += dbUrl.includes('?') ? '&schema=smart_mess' : '?schema=smart_mess';
  process.env.DATABASE_URL = dbUrl;
}

const prismaDir = path.resolve(__dirname, '../../prisma');
const schemaFile = path.join(prismaDir, 'schema.prisma');
const pgSchemaFile = path.join(prismaDir, 'schema.postgresql.prisma');

console.log(`🔍 Checking database connection for deployment... [${isPostgres ? 'PostgreSQL (Isolated schema: smart_mess)' : 'SQLite'}]`);

try {
  if (isPostgres) {
    console.log('🐘 PostgreSQL detected. Synchronizing PostgreSQL schema into smart_mess...');
    fs.copyFileSync(pgSchemaFile, schemaFile);
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..'), env: process.env });
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..'), env: process.env });
  } else {
    console.log('📁 SQLite detected. Ensuring Prisma Client is generated and tables initialized...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..'), env: process.env });
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..'), env: process.env });
  }
  console.log('✅ Database preparation completed successfully.');
} catch (err) {
  console.error('❌ Database preparation error:');
  if (err.stdout) console.error(err.stdout.toString());
  if (err.stderr) console.error(err.stderr.toString());
  console.error(err.message);
  process.exit(1);
}
