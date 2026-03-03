/**
 * fix-migrations.cjs
 *
 * Fixes falsely-resolved Prisma migrations on Railway.
 * When `prisma migrate resolve --applied` is used, it marks a migration
 * as applied WITHOUT executing the SQL. This script detects that scenario
 * (columns missing despite migration marked as applied) and removes the
 * false record so that `prisma migrate deploy` can actually run the SQL.
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // Check if followUpCount column exists in Conversation table
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Conversation' AND column_name = 'followUpCount'
    `);

    if (cols.length === 0) {
      // Column doesn't exist — migration was falsely marked as applied
      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations" WHERE migration_name = '20260303022200_add_followup_and_retention_fields'`
      );
      if (deleted > 0) {
        console.log(
          'fix-migrations: removed false record for add_followup_and_retention_fields (will be applied by migrate deploy)'
        );
      }
    } else {
      console.log('fix-migrations: followup columns verified OK');
    }
  } catch (e) {
    // Ignore — _prisma_migrations table might not exist on first deploy
    console.log('fix-migrations: skipped —', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
