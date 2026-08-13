import {
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryService } from './telemetry.service';

const ROUTES = [
  {
    label: 'Office run',
    start: { lat: 40.7128, lng: -74.006, address: 'Lower Manhattan, NY' },
    end: { lat: 40.7484, lng: -73.9857, address: 'Midtown Manhattan, NY' },
    miles: 4.2,
    points: [
      { lat: 40.72, lng: -74.0 },
      { lat: 40.73, lng: -73.99 },
      { lat: 40.74, lng: -73.987 },
    ],
  },
  {
    label: 'Client visit',
    start: { lat: 40.7484, lng: -73.9857, address: 'Midtown Manhattan, NY' },
    end: { lat: 40.7061, lng: -74.0087, address: 'Financial District, NY' },
    miles: 3.8,
    points: [
      { lat: 40.74, lng: -73.99 },
      { lat: 40.72, lng: -74.0 },
    ],
  },
  {
    label: 'Brooklyn errand',
    start: { lat: 40.7061, lng: -74.0087, address: 'Financial District, NY' },
    end: { lat: 40.6782, lng: -73.9442, address: 'Brooklyn, NY' },
    miles: 5.1,
    points: [
      { lat: 40.7, lng: -73.99 },
      { lat: 40.69, lng: -73.96 },
    ],
  },
];

@Controller('dev')
@UseGuards(SessionGuard)
export class SimulateController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Post('simulate-drive')
  async simulate(@Req() req: Request) {
    if (this.config.get<string>('AUTH_MODE') === 'tesla') {
      throw new ForbiddenException(
        'Drive simulation is only available in mock mode',
      );
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { userId: req.user!.id, trackingEnabled: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!vehicle) {
      throw new ForbiddenException('No tracked vehicle to simulate');
    }

    const last = await this.prisma.drive.findFirst({
      where: { vehicleId: vehicle.id, endedAt: { not: null } },
      orderBy: { endedAt: 'desc' },
    });
    const startOdo = last?.endOdometer ?? 12000;
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const startedAt = new Date(Date.now() - 45 * 60 * 1000);
    const endedAt = new Date(Date.now() - 5 * 60 * 1000);
    const endOdo = Number((startOdo + route.miles).toFixed(1));

    const events = [
      {
        type: 'drive_start' as const,
        vin: vehicle.vin,
        occurredAt: startedAt.toISOString(),
        odometer: startOdo,
        lat: route.start.lat,
        lng: route.start.lng,
      },
      ...route.points.map((p, i) => ({
        type: 'breadcrumb' as const,
        vin: vehicle.vin,
        occurredAt: new Date(
          startedAt.getTime() +
            ((i + 1) / (route.points.length + 1)) *
              (endedAt.getTime() - startedAt.getTime()),
        ).toISOString(),
        lat: p.lat,
        lng: p.lng,
        odometer: Number(
          (
            startOdo +
            (route.miles * (i + 1)) / (route.points.length + 1)
          ).toFixed(2),
        ),
      })),
      {
        type: 'drive_end' as const,
        vin: vehicle.vin,
        occurredAt: endedAt.toISOString(),
        odometer: endOdo,
        lat: route.end.lat,
        lng: route.end.lng,
      },
    ];

    const result = await this.telemetry.ingest(events);
    let driveId: string | undefined;
    for (const r of result.results) {
      if (r.type === 'drive_end' && 'driveId' in r && r.driveId) {
        driveId = r.driveId;
      }
    }

    if (driveId) {
      await this.prisma.drive.update({
        where: { id: driveId },
        data: {
          startAddress: route.start.address,
          endAddress: route.end.address,
        },
      });
    }

    return {
      ok: true,
      label: route.label,
      driveId,
      processed: result.processed,
    };
  }
}
