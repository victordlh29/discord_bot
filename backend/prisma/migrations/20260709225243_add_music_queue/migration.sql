-- CreateTable
CREATE TABLE "MusicQueueItem" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "voiceChannelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "thumbnail" TEXT,
    "position" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicQueueItem_guildId_idx" ON "MusicQueueItem"("guildId");
