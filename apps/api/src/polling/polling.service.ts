import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TeslaApiService } from '../tesla/tesla-api.service';
import { decide, type DetectedDrive, type PollState } from './park-detection';

/** Cars examined per tick, so one busy account cannot starve the others. */
const BATCH_SIZE = 25;
const BASE_BACKOFF_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60_000;

type DueVehicle = {
  id: string;
  userId: string;
  vin: string;
  pollFailures: number;
  anchorOdometer: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
  anchorAt: Date | null;
  tripStartedAt: Date | null;
  lastShiftState: string | null;
};

@Injectable()
export class PollingService {
  private readonly logger = new Logger(PollingService.name);
  /** Ticks overlap if a batch runs long; one pass at a time is plenty. */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tesla: TeslaApiService,
    private readonly config: ConfigService,
  ) {}

  private enabled(): boolean {
    return (
      this.config.get('AUTH_MODE') === 'tesla' &&
      this.config.get('TESLA_POLLING_ENABLED') !== 'false'
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      await this.pollDue();
    } catch (err) {
      this.logger.error(`Poll pass failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async pollDue(): Promise<{ polled: number; drives: number }> {
    const now = new Date();
    const due = (await this.prisma.vehicle.findMany({
      where: {
        trackingEnabled: true,
        OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }],
      },
      orderBy: { nextPollAt: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        vin: true,
        pollFailures: true,
        anchorOdometer: true,
        anchorLat: true,
        anchorLng: true,
        anchorAt: true,
        tripStartedAt: true,
        lastShiftState: true,
      },
    })) as DueVehicle[];

    let drives = 0;
    for (const vehicle of due) {
      if (await this.pollVehicle(vehicle)) drives += 1;
    }
    return { polled: due.length, drives };
  }

  /** Returns true when the poll produced a drive. */
  private async pollVehicle(vehicle: DueVehicle): Promise<boolean> {
    const state: PollState = {
      anchorOdometer: vehicle.anchorOdometer,
      anchorLat: vehicle.anchorLat,
      anchorLng: vehicle.anchorLng,
      anchorAt: vehicle.anchorAt,
      tripStartedAt: vehicle.tripStartedAt,
      lastShiftState: vehicle.lastShiftState,
    };

    try {
      const observation = await this.tesla.getVehicleSnapshot(
        vehicle.userId,
        vehicle.vin,
      );
      const decision = decide(state, observation);

      let created = false;
      if (decision.drive) {
        created = await this.recordDrive(vehicle, decision.drive);
      }

      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          ...decision.state,
          lastPolledAt: new Date(),
          nextPollAt: new Date(Date.now() + decision.intervalMs),
          pollFailures: 0,
        },
      });

      if (created) {
        this.logger.log(
          `${vehicle.vin}: recorded ${decision.drive?.distanceMiles} mi from park detection`,
        );
      }
      return created;
    } catch (err) {
      await this.backOff(vehicle, err);
      return false;
    }
  }

  /**
   * Tesla outages and revoked tokens both surface here. Backing off keeps a
   * broken account from consuming the batch on every tick.
   */
  private async backOff(vehicle: DueVehicle, err: unknown): Promise<void> {
    const failures = vehicle.pollFailures + 1;
    const delay = Math.min(
      BASE_BACKOFF_MS * 2 ** (failures - 1),
      MAX_BACKOFF_MS,
    );
    this.logger.warn(
      `${vehicle.vin}: poll failed (${failures}), retrying in ${Math.round(
        delay / 60_000,
      )}m: ${String(err)}`,
    );
    await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        pollFailures: failures,
        lastPolledAt: new Date(),
        nextPollAt: new Date(Date.now() + delay),
      },
    });
  }

  /**
   * The end odometer uniquely identifies a detected trip, so a replayed or
   * concurrent poll cannot duplicate it.
   */
  private async recordDrive(
    vehicle: DueVehicle,
    drive: DetectedDrive,
  ): Promise<boolean> {
    const existing = await this.prisma.drive.findFirst({
      where: {
        vehicleId: vehicle.id,
        source: 'POLLED',
        endOdometer: drive.endOdometer,
      },
      select: { id: true },
    });
    if (existing) return false;

    await this.prisma.drive.create({
      data: {
        userId: vehicle.userId,
        vehicleId: vehicle.id,
        source: 'POLLED',
        status: 'UNCLASSIFIED',
        startedAt: drive.startedAt,
        endedAt: drive.endedAt,
        startOdometer: drive.startOdometer,
        endOdometer: drive.endOdometer,
        distanceMiles: drive.distanceMiles,
        durationSec: drive.durationSec,
        startLat: drive.startLat,
        startLng: drive.startLng,
        endLat: drive.endLat,
        endLng: drive.endLng,
        startAddress: coordLabel(drive.startLat, drive.startLng, 'Start'),
        endAddress: coordLabel(drive.endLat, drive.endLng, 'End'),
      },
    });
    return true;
  }
}

function coordLabel(
  lat: number | null,
  lng: number | null,
  label: string,
): string | null {
  if (lat == null || lng == null) return null;
  return `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}
