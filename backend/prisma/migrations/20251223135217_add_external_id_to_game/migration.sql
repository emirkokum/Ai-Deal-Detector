/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "platform" SET DEFAULT 'steam';

-- CreateIndex
CREATE UNIQUE INDEX "Game_externalId_key" ON "Game"("externalId");
