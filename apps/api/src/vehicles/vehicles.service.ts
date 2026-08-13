import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TeslaApiService } from '../tesla/tesla-api.service';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tesla: TeslaApiService,
  ) {}

  list(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { displayName: 'asc' },
    });
  }

  async syncFromTesla(userId: string) {
    if (this.config.get('AUTH_MODE') !== 'tesla') {
      return {
        synced: 0,
        mode: 'mock' as const,
        vehicles: await this.list(userId),
        message: 'Mock mode — using local demo vehicles',
      };
    }

    const remote = await this.tesla.listVehicles(userId);
    let synced = 0;
    for (const v of remote) {
      await this.prisma.vehicle.upsert({
        where: { userId_vin: { userId, vin: v.vin } },
        create: {
          userId,
          vin: v.vin,
          displayName: v.displayName,
          trackingEnabled: false,
        },
        update: {
          displayName: v.displayName,
        },
      });
      synced += 1;
    }

    this.logger.log(`Synced ${synced} vehicles for user ${userId}`);
    return {
      synced,
      mode: 'tesla' as const,
      vehicles: await this.list(userId),
      message: `Synced ${synced} vehicle(s) from Tesla`,
    };
  }

  async setTracking(userId: string, vehicleId: string, enabled: boolean) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const mock = this.config.get('AUTH_MODE') !== 'tesla';
    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        trackingEnabled: enabled,
        ...(mock && enabled
          ? { virtualKeyPaired: true, telemetryConfigured: true }
          : {}),
        ...(enabled
          ? // Poll on the next tick rather than waiting out an old schedule.
            { nextPollAt: new Date(), pollFailures: 0 }
          : {
              telemetryConfigured: false,
              // Drop the odometer baseline. Miles driven while untracked must not
              // resurface as one huge drive when tracking is turned back on.
              anchorOdometer: null,
              anchorLat: null,
              anchorLng: null,
              anchorAt: null,
              tripStartedAt: null,
              nextPollAt: null,
            }),
      },
    });

    return updated;
  }
}
