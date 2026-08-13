-- CreateEnum
CREATE TYPE "DriveSource" AS ENUM ('TELEMETRY', 'MANUAL');

-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "source" "DriveSource" NOT NULL DEFAULT 'TELEMETRY',
ALTER COLUMN "vehicleId" DROP NOT NULL,
ALTER COLUMN "startOdometer" DROP NOT NULL;
