-- CreateEnum
CREATE TYPE "MissionCancellationType" AS ENUM ('CLIENT', 'INTERNAL');

-- AlterTable
ALTER TABLE "Mission"
ADD COLUMN "cancellationType" "MissionCancellationType",
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3);
