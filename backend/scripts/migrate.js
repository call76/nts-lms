/**
 * Safe schema sync.
 *
 * The old version of this script ran `DROP TABLE "Follow" CASCADE` on EVERY install/start,
 * silently wiping all follow relationships, and it never created any other table.
 * Now we simply let Prisma sync the database with prisma/schema.prisma. `db push` is
 * additive and refuses destructive changes unless explicitly forced, so existing data is safe.
 *
 * Deployment must stop when schema sync fails; otherwise the app can start against an incompatible schema.
 */
const { spawnSync } = require('child_process');
const path = require('path');

if (!process.env.DATABASE_URL) {
  try { require('dotenv').config(); } catch (e) { /* dotenv optional here */ }
}
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set - skipping schema sync.');
  process.exit(0);
}

console.log('Syncing database schema (prisma db push)...');
const bin = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const result = spawnSync(bin, ['db', 'push'], { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: process.platform === 'win32' });

if (result.status === 0) {
  console.log('🎉 Database schema is up to date');
} else {
  console.error('❌ Schema sync failed (exit code ' + result.status + '). Deployment stopped to protect data.');
  process.exit(result.status || 1);
}

