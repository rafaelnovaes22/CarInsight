-- AlterTable: Add follow-up and conversion tracking fields to Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "followUpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastFollowUpAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "conversionScore" SMALLINT;

-- AlterTable: Add retention and referral fields to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "satisfactionScore" SMALLINT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: FollowUp
CREATE TABLE IF NOT EXISTS "FollowUp" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FollowUp_phoneNumber_idx" ON "FollowUp"("phoneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FollowUp_status_scheduledAt_idx" ON "FollowUp"("status", "scheduledAt");

-- CreateIndex (unique on Lead.referralCode, allowing nulls)
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_referralCode_key" ON "Lead"("referralCode");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FollowUp_conversationId_fkey'
    ) THEN
        ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_conversationId_fkey"
            FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
