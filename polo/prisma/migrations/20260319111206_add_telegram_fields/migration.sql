-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkedAt" TIMESTAMP(3),
ADD COLUMN     "telegramToken" TEXT,
ADD COLUMN     "telegramTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserSession_telegramToken_idx" ON "UserSession"("telegramToken");
