-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Price" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';
