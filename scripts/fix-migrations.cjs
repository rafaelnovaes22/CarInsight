/**
 * fix-migrations.cjs
 *
 * Smart migration fixer for Railway deploys. Handles multiple scenarios:
 *
 * 1. Fresh DB (staging): No tables exist → ensure init migration runs from scratch
 * 2. Existing DB (production): Tables created via `db push` → baseline init as applied,
 *    then patch any columns that were added to the init migration after the original db push
 * 3. Failed migrations: Clean up records with rolled_back_at set so they can be retried
 */
const { PrismaClient } = require('@prisma/client');

const INIT_MIGRATION = '20260223141837_init_pgvector';
const FOLLOWUP_MIGRATION = '20260303022200_add_followup_and_retention_fields';

async function main() {
  const prisma = new PrismaClient();
  try {
    // Step 1: Check if core tables exist (Vehicle is created by init migration)
    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Vehicle'
      ) AS "exists"
    `);
    const tablesExist = tableCheck[0].exists;

    if (!tablesExist) {
      // --- SCENARIO: Fresh DB (staging) ---
      console.log('fix-migrations: fresh database detected (no Vehicle table)');

      // Remove any falsely-marked init migration so migrate deploy runs the full SQL
      try {
        const deleted = await prisma.$executeRawUnsafe(
          `DELETE FROM "_prisma_migrations" WHERE migration_name = '${INIT_MIGRATION}'`
        );
        if (deleted > 0) {
          console.log(
            'fix-migrations: removed false init record — migrate deploy will create all tables'
          );
        }
      } catch {
        // _prisma_migrations table doesn't exist yet — that's fine, migrate deploy will handle it
        console.log('fix-migrations: no _prisma_migrations table yet (first deploy)');
      }
    } else {
      // --- SCENARIO: Existing DB (production) ---
      console.log('fix-migrations: existing database detected (Vehicle table exists)');

      // Mark init migration as applied (baseline) — idempotent if already marked
      try {
        const alreadyApplied = await prisma.$queryRawUnsafe(`
          SELECT 1 FROM "_prisma_migrations"
          WHERE migration_name = '${INIT_MIGRATION}'
        `);
        if (alreadyApplied.length === 0) {
          // Not yet marked — use resolve to baseline it
          const { execSync } = require('child_process');
          execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
            stdio: 'inherit',
          });
          console.log('fix-migrations: init migration baselined as applied');
        } else {
          console.log('fix-migrations: init migration already marked as applied');
        }
      } catch {
        // _prisma_migrations might not exist — let migrate deploy create it
        const { execSync } = require('child_process');
        execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
          stdio: 'inherit',
        });
        console.log('fix-migrations: init migration baselined as applied');
      }

      // Patch columns from init migration that may be missing (db push with older schema)
      await patchMissingColumns(prisma);
    }

    // Step 2: Check second migration (followup/retention fields)
    try {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Conversation' AND column_name = 'followUpCount'
      `);

      if (cols.length === 0 && tablesExist) {
        // Conversation table exists but followUpCount doesn't — migration was falsely marked
        const deleted = await prisma.$executeRawUnsafe(
          `DELETE FROM "_prisma_migrations" WHERE migration_name = '${FOLLOWUP_MIGRATION}'`
        );
        if (deleted > 0) {
          console.log(
            'fix-migrations: removed false record for followup migration (will be applied by migrate deploy)'
          );
        }
      }
    } catch {
      // Table doesn't exist yet — init migration will create everything
    }

    // Step 3: Clean up failed migrations so they can be retried
    try {
      const cleaned = await prisma.$executeRawUnsafe(`
        DELETE FROM "_prisma_migrations"
        WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL
      `);
      if (cleaned > 0) {
        console.log(`fix-migrations: cleaned ${cleaned} failed/incomplete migration record(s)`);
      }
    } catch {
      // _prisma_migrations doesn't exist yet
    }

    console.log('fix-migrations: done');
  } catch (e) {
    console.error('fix-migrations: error —', e.message);
    // Don't throw — let migrate deploy handle it
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Checks for columns defined in the init migration that may not exist
 * in the actual database (because db push was run with an older schema).
 */
async function patchMissingColumns(prisma) {
  const patches = [
    {
      table: 'Recommendation',
      column: 'explanation',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "explanation" JSONB`,
    },
    {
      table: 'Recommendation',
      column: 'userRating',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "userRating" INTEGER`,
    },
    {
      table: 'Recommendation',
      column: 'userFeedback',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "userFeedback" TEXT`,
    },
    {
      table: 'Recommendation',
      column: 'feedbackType',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "feedbackType" TEXT`,
    },
    {
      table: 'Recommendation',
      column: 'feedbackAt',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "feedbackAt" TIMESTAMP(3)`,
    },
    {
      table: 'Recommendation',
      column: 'viewedAt',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "viewedAt" TIMESTAMP(3)`,
    },
    {
      table: 'Recommendation',
      column: 'viewDurationSec',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "viewDurationSec" INTEGER`,
    },
    {
      table: 'Recommendation',
      column: 'askedQuestions',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "askedQuestions" BOOLEAN NOT NULL DEFAULT false`,
    },
    {
      table: 'Recommendation',
      column: 'requestedContact',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "requestedContact" BOOLEAN NOT NULL DEFAULT false`,
    },
    {
      table: 'Recommendation',
      column: 'rejectionReason',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "rejectionReason" TEXT`,
    },
    {
      table: 'Recommendation',
      column: 'wasSkipped',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "wasSkipped" BOOLEAN NOT NULL DEFAULT false`,
    },
    {
      table: 'Recommendation',
      column: 'position',
      sql: `ALTER TABLE "Recommendation" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 1`,
    },
  ];

  for (const patch of patches) {
    try {
      const exists = await prisma.$queryRawUnsafe(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${patch.table}' AND column_name = '${patch.column}'
      `);
      if (exists.length === 0) {
        await prisma.$executeRawUnsafe(patch.sql);
        console.log(`fix-migrations: added missing column ${patch.table}.${patch.column}`);
      }
    } catch (e) {
      console.log(`fix-migrations: warning patching ${patch.table}.${patch.column} — ${e.message}`);
    }
  }
}

main();
