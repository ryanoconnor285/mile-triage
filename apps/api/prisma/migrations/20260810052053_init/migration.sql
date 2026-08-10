-- CreateEnum
CREATE TYPE "DriveStatus" AS ENUM ('UNCLASSIFIED', 'BUSINESS', 'PERSONAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "teslaUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "displayName" TEXT,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "virtualKeyPaired" BOOLEAN NOT NULL DEFAULT false,
    "telemetryConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "startOdometer" DOUBLE PRECISION NOT NULL,
    "endOdometer" DOUBLE PRECISION,
    "distanceMiles" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "startAddress" TEXT,
    "endAddress" TEXT,
    "status" "DriveStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
    "purposeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrivePoint" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "odometer" DOUBLE PRECISION,

    CONSTRAINT "DrivePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mileageRate" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_teslaUserId_key" ON "User"("teslaUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Vehicle_vin_idx" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_userId_vin_key" ON "Vehicle"("userId", "vin");

-- CreateIndex
CREATE INDEX "Drive_userId_status_startedAt_idx" ON "Drive"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "Drive_vehicleId_startedAt_idx" ON "Drive"("vehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "DrivePoint_driveId_recordedAt_idx" ON "DrivePoint"("driveId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_userId_key" ON "AppSettings"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivePoint" ADD CONSTRAINT "DrivePoint_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
