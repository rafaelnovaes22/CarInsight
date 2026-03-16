-- Add domainId to Vehicle, Conversation, Lead
-- Idempotent: uses IF NOT EXISTS / DO $$ ... $$

-- Vehicle.domainId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Vehicle' AND column_name = 'domainId'
  ) THEN
    ALTER TABLE "Vehicle" ADD COLUMN "domainId" TEXT NOT NULL DEFAULT 'automotive';
  END IF;
END $$;

-- Conversation.domainId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Conversation' AND column_name = 'domainId'
  ) THEN
    ALTER TABLE "Conversation" ADD COLUMN "domainId" TEXT NOT NULL DEFAULT 'automotive';
  END IF;
END $$;

-- Lead.domainId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Lead' AND column_name = 'domainId'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "domainId" TEXT NOT NULL DEFAULT 'automotive';
  END IF;
END $$;

-- Backfill existing rows (no-op if default already applied, but explicit for clarity)
UPDATE "Vehicle" SET "domainId" = 'automotive' WHERE "domainId" IS NULL;
UPDATE "Conversation" SET "domainId" = 'automotive' WHERE "domainId" IS NULL;
UPDATE "Lead" SET "domainId" = 'automotive' WHERE "domainId" IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "Vehicle_domainId_idx" ON "Vehicle"("domainId");
CREATE INDEX IF NOT EXISTS "Conversation_domainId_idx" ON "Conversation"("domainId");
CREATE INDEX IF NOT EXISTS "Lead_domainId_idx" ON "Lead"("domainId");
