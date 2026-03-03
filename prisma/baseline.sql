-- Prisma Migrate Baseline Script
-- This creates the _prisma_migrations table and marks the init migration
-- as already applied, so that `prisma migrate deploy` only runs new migrations.
-- Safe to run multiple times (all operations use IF NOT EXISTS / ON CONFLICT).

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    "checksum"              VARCHAR(64)  NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0
);

-- Mark the init migration as already applied (baseline)
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (
    'baseline-init-00000000-0000-0000-0000-000000000001',
    'baseline',
    '20260223141837_init_pgvector',
    now(),
    1
)
ON CONFLICT ("id") DO NOTHING;

-- Mark the follow-up/retention migration as already applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (
    'baseline-init-00000000-0000-0000-0000-000000000002',
    'baseline',
    '20260303022200_add_followup_and_retention_fields',
    now(),
    1
)
ON CONFLICT ("id") DO NOTHING;
