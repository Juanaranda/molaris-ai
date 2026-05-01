-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sessionId" TEXT,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_events_clinicId_idx" ON "usage_events"("clinicId");

-- CreateIndex
CREATE INDEX "usage_events_createdAt_idx" ON "usage_events"("createdAt");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
