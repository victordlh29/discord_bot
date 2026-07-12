/*
  Warnings:

  - A unique constraint covering the columns `[name,guildId]` on the table `Rank` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key,guildId]` on the table `Setting` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[discordId,guildId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `guildId` to the `Cosmetic` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `Rank` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `Setting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `UserMissionProgress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `VoiceSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `XpLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MissionFrequency" ADD VALUE 'UNICA';

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "VoiceSession" DROP CONSTRAINT "VoiceSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "XpLog" DROP CONSTRAINT "XpLog_userId_fkey";

-- DropIndex
DROP INDEX "Rank_name_key";

-- DropIndex
DROP INDEX "Setting_key_key";

-- DropIndex
DROP INDEX "User_discordId_key";

-- AlterTable
ALTER TABLE "Cosmetic" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Log" ADD COLUMN     "guildId" TEXT;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Rank" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserMissionProgress" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VoiceSession" ADD COLUMN     "guildId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "XpLog" ADD COLUMN     "guildId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "MessageLog_userId_idx" ON "MessageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_name_guildId_key" ON "Rank"("name", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_guildId_key" ON "Setting"("key", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_guildId_key" ON "User"("discordId", "guildId");

-- CreateIndex
CREATE INDEX "VoiceSession_userId_idx" ON "VoiceSession"("userId");

-- CreateIndex
CREATE INDEX "XpLog_userId_idx" ON "XpLog"("userId");

-- CreateIndex
CREATE INDEX "XpLog_guildId_createdAt_idx" ON "XpLog"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLog" ADD CONSTRAINT "XpLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
