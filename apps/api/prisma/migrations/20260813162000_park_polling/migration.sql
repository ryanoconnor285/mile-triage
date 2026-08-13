-- Park-based drive detection: new drive source plus per-vehicle poll state.
ALTER TYPE "DriveSource" ADD VALUE 'POLLED';

ALTER TABLE "Vehicle"
  ADD COLUMN "anchorOdometer" DOUBLE PRECISION,
  ADD COLUMN "anchorLat" DOUBLE PRECISION,
  ADD COLUMN "anchorLng" DOUBLE PRECISION,
  ADD COLUMN "anchorAt" TIMESTAMP(3),
  ADD COLUMN "tripStartedAt" TIMESTAMP(3),
  ADD COLUMN "lastShiftState" TEXT,
  ADD COLUMN "lastPolledAt" TIMESTAMP(3),
  ADD COLUMN "nextPollAt" TIMESTAMP(3),
  ADD COLUMN "pollFailures" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Vehicle_trackingEnabled_nextPollAt_idx"
  ON "Vehicle"("trackingEnabled", "nextPollAt");
