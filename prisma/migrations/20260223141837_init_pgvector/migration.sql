-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "versao" TEXT,
    "ano" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "preco" DOUBLE PRECISION,
    "cor" TEXT,
    "carroceria" TEXT NOT NULL,
    "combustivel" TEXT NOT NULL DEFAULT 'Flex',
    "cambio" TEXT NOT NULL DEFAULT 'Manual',
    "arCondicionado" BOOLEAN NOT NULL DEFAULT false,
    "direcaoHidraulica" BOOLEAN NOT NULL DEFAULT false,
    "airbag" BOOLEAN NOT NULL DEFAULT false,
    "abs" BOOLEAN NOT NULL DEFAULT false,
    "vidroEletrico" BOOLEAN NOT NULL DEFAULT false,
    "travaEletrica" BOOLEAN NOT NULL DEFAULT false,
    "alarme" BOOLEAN NOT NULL DEFAULT false,
    "rodaLigaLeve" BOOLEAN NOT NULL DEFAULT false,
    "som" BOOLEAN NOT NULL DEFAULT false,
    "portas" INTEGER NOT NULL DEFAULT 4,
    "opcionais" TEXT,
    "fotoUrl" TEXT,
    "fotosUrls" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "detailUrl" TEXT,
    "descricao" TEXT,
    "embedding" vector(1536),
    "embeddingModel" TEXT DEFAULT 'text-embedding-3-small',
    "embeddingGeneratedAt" TIMESTAMP(3),
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "aptoUber" BOOLEAN NOT NULL DEFAULT false,
    "aptoUberBlack" BOOLEAN NOT NULL DEFAULT false,
    "aptoFamilia" BOOLEAN NOT NULL DEFAULT true,
    "aptoTrabalho" BOOLEAN NOT NULL DEFAULT true,
    "aptoCarga" BOOLEAN NOT NULL DEFAULT false,
    "aptoUsoDiario" BOOLEAN NOT NULL DEFAULT false,
    "aptoEntrega" BOOLEAN NOT NULL DEFAULT false,
    "aptoViagem" BOOLEAN NOT NULL DEFAULT false,
    "aptoUberX" BOOLEAN NOT NULL DEFAULT false,
    "aptoUberComfort" BOOLEAN NOT NULL DEFAULT false,
    "scoreConforto" SMALLINT,
    "scoreEconomia" SMALLINT,
    "scoreEspaco" SMALLINT,
    "scoreSeguranca" SMALLINT,
    "scoreCustoBeneficio" SMALLINT,
    "categoriaVeiculo" TEXT,
    "segmentoPreco" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "classificationVersion" INTEGER NOT NULL DEFAULT 1,
    "economiaCombustivel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStep" TEXT NOT NULL DEFAULT 'greeting',
    "resolutionStatus" TEXT,
    "quizAnswers" TEXT,
    "profileData" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "explanation" JSONB,
    "position" INTEGER NOT NULL DEFAULT 1,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "interested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "feedbackType" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "viewDurationSec" INTEGER,
    "askedQuestions" BOOLEAN NOT NULL DEFAULT false,
    "requestedContact" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "wasSkipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "budget" DOUBLE PRECISION,
    "usage" TEXT,
    "people" INTEGER,
    "hasTradeIn" BOOLEAN NOT NULL DEFAULT false,
    "tradeInInfo" TEXT,
    "interestedVehicles" TEXT,
    "urgency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'whatsapp_bot',
    "soldAt" TIMESTAMP(3),
    "soldVehicleId" TEXT,
    "saleValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "crmSynced" BOOLEAN NOT NULL DEFAULT false,
    "crmId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "waMessageId" TEXT,
    "originalMediaId" TEXT,
    "processingTimeMs" INTEGER,
    "tokenUsage" JSONB,
    "cost" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LangGraphCheckpoint" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "type" TEXT,
    "checkpoint" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LangGraphCheckpoint_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id")
);

-- CreateTable
CREATE TABLE "LangGraphCheckpointBlob" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL,

    CONSTRAINT "LangGraphCheckpointBlob_pkey" PRIMARY KEY ("thread_id","checkpoint_ns")
);

-- CreateTable
CREATE TABLE "system_prompts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UberEligibleVehicleRule" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "minYear" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UberEligibleVehicleRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_externalId_key" ON "Vehicle"("externalId");

-- CreateIndex
CREATE INDEX "Vehicle_aptoFamilia_idx" ON "Vehicle"("aptoFamilia");

-- CreateIndex
CREATE INDEX "Vehicle_aptoUberX_idx" ON "Vehicle"("aptoUberX");

-- CreateIndex
CREATE INDEX "Vehicle_aptoUberComfort_idx" ON "Vehicle"("aptoUberComfort");

-- CreateIndex
CREATE INDEX "Vehicle_aptoUberBlack_idx" ON "Vehicle"("aptoUberBlack");

-- CreateIndex
CREATE INDEX "Vehicle_aptoTrabalho_idx" ON "Vehicle"("aptoTrabalho");

-- CreateIndex
CREATE INDEX "Vehicle_aptoViagem_idx" ON "Vehicle"("aptoViagem");

-- CreateIndex
CREATE INDEX "Vehicle_scoreConforto_idx" ON "Vehicle"("scoreConforto");

-- CreateIndex
CREATE INDEX "Vehicle_scoreEconomia_idx" ON "Vehicle"("scoreEconomia");

-- CreateIndex
CREATE INDEX "Vehicle_scoreEspaco_idx" ON "Vehicle"("scoreEspaco");

-- CreateIndex
CREATE INDEX "Vehicle_categoriaVeiculo_idx" ON "Vehicle"("categoriaVeiculo");

-- CreateIndex
CREATE INDEX "Vehicle_segmentoPreco_idx" ON "Vehicle"("segmentoPreco");

-- CreateIndex
CREATE INDEX "Event_conversationId_idx" ON "Event"("conversationId");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "Event_timestamp_idx" ON "Event"("timestamp");

-- CreateIndex
CREATE INDEX "Recommendation_conversationId_idx" ON "Recommendation"("conversationId");

-- CreateIndex
CREATE INDEX "Recommendation_matchScore_idx" ON "Recommendation"("matchScore");

-- CreateIndex
CREATE INDEX "Recommendation_feedbackType_idx" ON "Recommendation"("feedbackType");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_conversationId_key" ON "Lead"("conversationId");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_timestamp_idx" ON "Message"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "system_prompts_key_key" ON "system_prompts"("key");

-- CreateIndex
CREATE INDEX "UberEligibleVehicleRule_citySlug_idx" ON "UberEligibleVehicleRule"("citySlug");

-- CreateIndex
CREATE INDEX "UberEligibleVehicleRule_category_idx" ON "UberEligibleVehicleRule"("category");

-- CreateIndex
CREATE INDEX "UberEligibleVehicleRule_brand_idx" ON "UberEligibleVehicleRule"("brand");

-- CreateIndex
CREATE INDEX "UberEligibleVehicleRule_model_idx" ON "UberEligibleVehicleRule"("model");

-- CreateIndex
CREATE INDEX "UberEligibleVehicleRule_fetchedAt_idx" ON "UberEligibleVehicleRule"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UberEligibleVehicleRule_citySlug_category_brand_model_minYe_key" ON "UberEligibleVehicleRule"("citySlug", "category", "brand", "model", "minYear");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
