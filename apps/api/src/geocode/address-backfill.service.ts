import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { isCoordinateLabel } from './address-format';
import { GeocodeService } from './geocode.service';

/**
 * Drives are written with a coordinate placeholder so a slow or failed geocoder
 * never blocks recording a trip. This upgrades those placeholders afterwards,
 * which also covers drives recorded before geocoding existed.
 *
 * Small batches on a slow cron: the geocoder is rate limited to one request per
 * second, and there is no hurry.
 */
const BATCH_SIZE = 5;

@Injectable()
export class AddressBackfillService {
  private readonly logger = new Logger(AddressBackfillService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    if (!this.geocode.enabled() || this.running) return;
    this.running = true;
    try {
      await this.backfill();
    } catch (err) {
      this.logger.error(`Address backfill failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async backfill(): Promise<number> {
    // Hand-entered drives carry no coordinates, so they are never candidates and
    // a user's own wording is never overwritten.
    const candidates = await this.prisma.drive.findMany({
      where: {
        OR: [
          { AND: [{ startLat: { not: null } }, { startLng: { not: null } }] },
          { AND: [{ endLat: { not: null } }, { endLng: { not: null } }] },
        ],
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        startLat: true,
        startLng: true,
        endLat: true,
        endLng: true,
        startAddress: true,
        endAddress: true,
      },
    });

    const pending = candidates.filter(
      (d) =>
        ((isCoordinateLabel(d.startAddress) || !d.startAddress) &&
          d.startLat !== null &&
          d.startLng !== null) ||
        ((isCoordinateLabel(d.endAddress) || !d.endAddress) &&
          d.endLat !== null &&
          d.endLng !== null),
    );

    let updated = 0;
    for (const drive of pending.slice(0, BATCH_SIZE)) {
      const data: { startAddress?: string; endAddress?: string } = {};

      if (
        (isCoordinateLabel(drive.startAddress) || !drive.startAddress) &&
        drive.startLat !== null &&
        drive.startLng !== null
      ) {
        const label = await this.geocode.reverse(
          drive.startLat,
          drive.startLng,
        );
        if (label) data.startAddress = label;
      }

      if (
        (isCoordinateLabel(drive.endAddress) || !drive.endAddress) &&
        drive.endLat !== null &&
        drive.endLng !== null
      ) {
        const label = await this.geocode.reverse(drive.endLat, drive.endLng);
        if (label) data.endAddress = label;
      }

      if (Object.keys(data).length > 0) {
        await this.prisma.drive.update({ where: { id: drive.id }, data });
        updated += 1;
      }
    }

    if (updated > 0) {
      this.logger.log(`Resolved addresses for ${updated} drive(s)`);
    }
    return updated;
  }
}
