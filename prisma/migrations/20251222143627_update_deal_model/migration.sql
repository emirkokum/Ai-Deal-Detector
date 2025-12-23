/*
  Warnings:

  - You are about to drop the column `discountPct` on the `Deal` table. All the data in the column will be lost.
  - You are about to drop the column `isHistoricalLow` on the `Deal` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId]` on the table `Deal` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "discountPct",
DROP COLUMN "isHistoricalLow",
ADD COLUMN     "aiAnalysis" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deal_gameId_key" ON "Deal"("gameId");
