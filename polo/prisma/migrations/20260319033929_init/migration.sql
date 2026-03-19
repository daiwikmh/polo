-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "eoaAddress" TEXT NOT NULL,
    "smartAccountAddress" TEXT NOT NULL,
    "sessionDetails" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSession_smartAccountAddress_idx" ON "UserSession"("smartAccountAddress");

-- CreateIndex
CREATE INDEX "UserSession_active_idx" ON "UserSession"("active");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_eoaAddress_key" ON "UserSession"("eoaAddress");
