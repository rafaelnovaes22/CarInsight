/**
 * fix-migrations.cjs
 *
 * Smart migration fixer for Railway deploys. Handles multiple scenarios:
 *
 * 1. Fresh DB with pgvector: lets migrate deploy run normally
 * 2. Fresh DB WITHOUT pgvector (staging): creates tables manually (TEXT instead of vector),
 *    marks migrations as applied so migrate deploy is a no-op
 * 3. Existing DB (production): baselines init as applied, patches missing columns
 * 4. Failed migrations: cleans up records so they can be retried
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INIT_MIGRATION = '20260223141837_init_pgvector';
const FOLLOWUP_MIGRATION = '20260303022200_add_followup_and_retention_fields';

/**
 * Splits SQL into top-level statements.
 * Handles quotes, comments, and dollar-quoted blocks (DO $$ ... $$).
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') inLineComment = false;
      index += 1;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 2;
        inBlockComment = false;
        continue;
      }
      index += 1;
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += char;
        index += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 2;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      index += 1;
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        index += 2;
        continue;
      }
      if (char === '"') inDoubleQuote = false;
      index += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      current += '--';
      index += 2;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      current += '/*';
      index += 2;
      inBlockComment = true;
      continue;
    }

    if (char === "'") {
      current += char;
      inSingleQuote = true;
      index += 1;
      continue;
    }

    if (char === '"') {
      current += char;
      inDoubleQuote = true;
      index += 1;
      continue;
    }

    if (char === '$') {
      const slice = sql.slice(index);
      const match = slice.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$/) || slice.match(/^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

/**
 * Executes statements one by one. Prisma prepared statements only accept one command at a time.
 */
async function executeSqlStatements(prisma, sql) {
  const statements = splitSqlStatements(sql);
  let executedCount = 0;

  for (const rawStatement of statements) {
    const executableStatement = rawStatement
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
      .replace(/;\s*$/, '');

    if (!executableStatement) continue;

    try {
      await prisma.$executeRawUnsafe(executableStatement);
      executedCount += 1;
    } catch (error) {
      console.error(
        `fix-migrations: SQL execution failed at statement ${executedCount + 1}/${statements.length}`
      );
      console.error(`fix-migrations: statement preview: ${executableStatement.slice(0, 220)}`);
      throw error;
    }
  }

  console.log(`fix-migrations: executed ${executedCount} SQL statements`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // Step 1: Check if core tables exist
    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Vehicle'
      ) AS "exists"
    `);
    const tablesExist = tableCheck[0].exists;

    if (!tablesExist) {
      // --- SCENARIO: Fresh DB ---
      console.log('fix-migrations: fresh database detected (no Vehicle table)');

      // Clean up any false migration records
      await cleanupMigrationRecords(prisma);

      // Check if pgvector is available
      const hasVector = await checkPgVector(prisma);

      if (hasVector) {
        console.log('fix-migrations: pgvector available - migrate deploy will handle it');
        // Let migrate deploy run normally
      } else {
        console.log('fix-migrations: pgvector NOT available - creating tables manually');
        await createTablesWithoutVector(prisma);
        console.log('fix-migrations: all tables created, migrations marked as applied');
      }
    } else {
      // --- SCENARIO: Existing DB (production) ---
      console.log('fix-migrations: existing database detected (Vehicle table exists)');
      await baselineExistingDb(prisma);
      await patchMissingColumns(prisma);
    }

    // Clean up failed/incomplete migrations
    await cleanupFailedMigrations(prisma);

    console.log('fix-migrations: done');
  } catch (e) {
    console.error('fix-migrations: error -', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Check if pgvector extension is available on this PostgreSQL server
 */
async function checkPgVector(prisma) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
    `);
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Remove any existing migration records (for fresh DB cleanup)
 */
async function cleanupMigrationRecords(prisma) {
  try {
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE migration_name IN ('${INIT_MIGRATION}', '${FOLLOWUP_MIGRATION}')`
    );
    if (deleted > 0) {
      console.log(`fix-migrations: removed ${deleted} stale migration record(s)`);
    }
  } catch {
    // _prisma_migrations doesn't exist yet
  }
}

/**
 * Creates all tables manually without pgvector (uses TEXT for embedding column).
 * Then marks both migrations as applied so migrate deploy is a no-op.
 */
async function createTablesWithoutVector(prisma) {
  // Read the original migration SQL files
  const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

  const initSqlOriginal = fs.readFileSync(
    path.join(migrationsDir, INIT_MIGRATION, 'migration.sql'),
    'utf8'
  );
  const followupSql = fs.readFileSync(
    path.join(migrationsDir, FOLLOWUP_MIGRATION, 'migration.sql'),
    'utf8'
  );

  // Modify init SQL: skip CREATE EXTENSION and use TEXT instead of vector(1536)
  const initSqlModified = initSqlOriginal
    .replace(
      /CREATE EXTENSION IF NOT EXISTS "vector";?/i,
      '-- pgvector not available, skipping CREATE EXTENSION'
    )
    .replace(/"embedding"\s+vector\(1536\),/i, '"embedding" TEXT,');

  // Ensure _prisma_migrations table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) NOT NULL PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Execute init migration (modified)
  console.log('fix-migrations: executing init migration (without pgvector)...');
  await executeSqlStatements(prisma, initSqlModified);

  // Record init migration with ORIGINAL file checksum (so Prisma doesn't detect drift)
  const initChecksum = computeChecksum(initSqlOriginal);
  await recordMigration(prisma, INIT_MIGRATION, initChecksum);
  console.log('fix-migrations: init migration applied and recorded');

  // Execute followup migration
  console.log('fix-migrations: executing followup migration...');
  await executeSqlStatements(prisma, followupSql);

  const followupChecksum = computeChecksum(followupSql);
  await recordMigration(prisma, FOLLOWUP_MIGRATION, followupChecksum);
  console.log('fix-migrations: followup migration applied and recorded');
}

/**
 * Compute SHA-256 checksum of migration SQL (matching Prisma's format)
 */
function computeChecksum(sql) {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

/**
 * Record a migration as applied in _prisma_migrations
 */
async function recordMigration(prisma, name, checksum) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count", "started_at")
     VALUES ($1, $2, $3, NOW(), 1, NOW())
     ON CONFLICT DO NOTHING`,
    id,
    checksum,
    name
  );
}

/**
 * For existing DBs: baseline init migration as applied and check followup migration
 */
async function baselineExistingDb(prisma) {
  try {
    const alreadyApplied = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '${INIT_MIGRATION}'
    `);
    if (alreadyApplied.length === 0) {
      const { execSync } = require('child_process');
      execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
        stdio: 'inherit',
      });
      console.log('fix-migrations: init migration baselined as applied');
    } else {
      console.log('fix-migrations: init migration already marked as applied');
    }
  } catch {
    const { execSync } = require('child_process');
    execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
      stdio: 'inherit',
    });
    console.log('fix-migrations: init migration baselined as applied');
  }

  // Check if followup migration columns exist
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Conversation' AND column_name = 'followUpCount'
    `);
    if (cols.length === 0) {
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
    // Table doesn't exist yet
  }
}

/**
 * Clean up failed/incomplete migration records so they can be retried
 */
async function cleanupFailedMigrations(prisma) {
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
}

/**
 * Patches columns from init migration that may be missing on existing DBs
 * (when db push was run with an older schema version)
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
      console.log(`fix-migrations: warning patching ${patch.table}.${patch.column} - ${e.message}`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  splitSqlStatements,
  executeSqlStatements,
};
