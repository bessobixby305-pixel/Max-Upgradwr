-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "battlesWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bestCrash" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "bestItemPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contracts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "crashCashouts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyAt" TIMESTAMP(3),
ADD COLUMN     "dailyStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diceWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "doubleGreens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jackpotWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minesCashouts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescueAt" TIMESTAMP(3),
ADD COLUMN     "slotJackpots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slotSpins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "towerBestFloor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "towerCashouts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wheelAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LiveRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "bet" BIGINT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "secret" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveRound_userId_endedAt_idx" ON "LiveRound"("userId", "endedAt");

-- AddForeignKey
ALTER TABLE "LiveRound" ADD CONSTRAINT "LiveRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRound" ADD CONSTRAINT "LiveRound_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "Seed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

