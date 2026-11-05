-- CreateEnum
CREATE TYPE "Hostel" AS ENUM ('UNI_WORLD_1', 'UNI_WORLD_2');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hostel" "Hostel" NOT NULL DEFAULT 'UNI_WORLD_1';

-- CreateIndex
CREATE INDEX "Product_hostel_idx" ON "Product"("hostel");
