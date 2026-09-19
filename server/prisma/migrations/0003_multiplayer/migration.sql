-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "bet" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "winnerSeat" INTEGER,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePlayer" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "emo" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "drops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "BattlePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jackpot" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "pot" BIGINT NOT NULL DEFAULT 0,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "winnerName" TEXT,
    "winnerShare" DOUBLE PRECISION,
    "roll" DOUBLE PRECISION,

    CONSTRAINT "Jackpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JackpotEntry" (
    "id" TEXT NOT NULL,
    "jackpotId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "emo" TEXT NOT NULL,
    "bet" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JackpotEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Battle_status_createdAt_idx" ON "Battle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BattlePlayer_userId_idx" ON "BattlePlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePlayer_battleId_seat_key" ON "BattlePlayer"("battleId", "seat");

-- CreateIndex
CREATE INDEX "Jackpot_status_createdAt_idx" ON "Jackpot"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JackpotEntry_jackpotId_idx" ON "JackpotEntry"("jackpotId");

-- CreateIndex
CREATE INDEX "JackpotEntry_userId_idx" ON "JackpotEntry"("userId");

-- AddForeignKey
ALTER TABLE "BattlePlayer" ADD CONSTRAINT "BattlePlayer_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePlayer" ADD CONSTRAINT "BattlePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JackpotEntry" ADD CONSTRAINT "JackpotEntry_jackpotId_fkey" FOREIGN KEY ("jackpotId") REFERENCES "Jackpot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JackpotEntry" ADD CONSTRAINT "JackpotEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

