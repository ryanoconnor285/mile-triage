import { Injectable, NotFoundException } from '@nestjs/common';
import { TelemetryEvent } from '@mile-triage/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(events: TelemetryEvent[]) {
    const results = [];
    for (const event of events) {
      results.push(await this.handleEvent(event));
    }
    return { processed: results.length, results };
  }

  private async handleEvent(event: TelemetryEvent) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { vin: event.vin, trackingEnabled: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`No tracked vehicle for VIN ${event.vin}`);
    }

    if (event.type === 'drive_start') {
      const drive = await this.prisma.drive.create({
        data: {
          userId: vehicle.userId,
          vehicleId: vehicle.id,
          startedAt: new Date(event.occurredAt),
          startOdometer: event.odometer,
          startLat: event.lat,
          startLng: event.lng,
          startAddress: this.approxAddress(event.lat, event.lng, 'Start'),
          status: 'UNCLASSIFIED',
        },
      });
      return { type: event.type, driveId: drive.id };
    }

    const openDrive = await this.prisma.drive.findFirst({
      where: { vehicleId: vehicle.id, endedAt: null, source: 'TELEMETRY' },
      orderBy: { startedAt: 'desc' },
    });

    if (event.type === 'breadcrumb') {
      if (!openDrive) {
        return { type: event.type, skipped: true };
      }
      await this.prisma.drivePoint.create({
        data: {
          driveId: openDrive.id,
          lat: event.lat,
          lng: event.lng,
          recordedAt: new Date(event.occurredAt),
          odometer: event.odometer,
        },
      });
      return { type: event.type, driveId: openDrive.id };
    }

    // drive_end
    if (!openDrive) {
      return { type: event.type, skipped: true };
    }
    const endedAt = new Date(event.occurredAt);
    // drive_start always records an odometer, so a null here means the row did
    // not come from a normal start event and there is no baseline to subtract.
    const distanceMiles =
      openDrive.startOdometer === null
        ? 0
        : Number((event.odometer - openDrive.startOdometer).toFixed(2));
    const durationSec = Math.max(
      0,
      Math.round((endedAt.getTime() - openDrive.startedAt.getTime()) / 1000),
    );
    const drive = await this.prisma.drive.update({
      where: { id: openDrive.id },
      data: {
        endedAt,
        endOdometer: event.odometer,
        endLat: event.lat,
        endLng: event.lng,
        endAddress: this.approxAddress(event.lat, event.lng, 'End'),
        distanceMiles: Math.max(0, distanceMiles),
        durationSec,
      },
    });
    return { type: event.type, driveId: drive.id };
  }

  private approxAddress(
    lat?: number,
    lng?: number,
    label = 'Location',
  ): string | null {
    if (lat == null || lng == null) return null;
    return `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}
