import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriveStatus, Prisma } from '@prisma/client';
import { BatchClassify, ClassifyDrive, CreateDrive } from '@mile-triage/shared';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';

type DriveWithRelations = Prisma.DriveGetPayload<{
  include: { vehicle: true; category: true };
}>;

@Injectable()
export class DrivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async list(userId: string, opts: { status?: DriveStatus; week?: string }) {
    const where: Prisma.DriveWhereInput = { userId };
    if (opts.status) where.status = opts.status;
    if (opts.week) {
      const start = new Date(`${opts.week}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Invalid week date');
      }
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      where.startedAt = { gte: start, lt: end };
    }

    const drives = await this.prisma.drive.findMany({
      where,
      include: { vehicle: true, category: true },
      orderBy: { startedAt: 'desc' },
    });

    return drives.map((d) => this.toSummary(d));
  }

  async get(userId: string, id: string) {
    const drive = await this.prisma.drive.findFirst({
      where: { id, userId },
      include: {
        vehicle: true,
        category: true,
        points: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!drive) throw new NotFoundException('Drive not found');
    return {
      ...this.toSummary(drive),
      points: drive.points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt.toISOString(),
        odometer: p.odometer,
      })),
    };
  }

  async create(userId: string, body: CreateDrive) {
    // Anchor to midday UTC so the drive can't shift to the neighbouring day
    // when rendered in the user's timezone.
    const startedAt = new Date(`${body.date}T12:00:00.000Z`);
    if (Number.isNaN(startedAt.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    if (body.vehicleId) {
      const owned = await this.prisma.vehicle.findFirst({
        where: { id: body.vehicleId, userId },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('Vehicle not found');
    }

    const resolved =
      body.categoryId === undefined || body.categoryId === null
        ? { categoryId: null, status: DriveStatus.UNCLASSIFIED }
        : await this.categories.resolveForClassify(userId, body.categoryId);

    const drive = await this.prisma.drive.create({
      data: {
        userId,
        vehicleId: body.vehicleId ?? null,
        source: 'MANUAL',
        startedAt,
        // Reports only count finished drives, so a manual entry is complete on arrival.
        endedAt: startedAt,
        distanceMiles: body.distanceMiles,
        categoryId: resolved.categoryId,
        status: resolved.status,
        purposeNote: body.purposeNote ?? null,
        notes: body.notes ?? null,
        startAddress: body.startAddress ?? null,
        endAddress: body.endAddress ?? null,
      },
      include: { vehicle: true, category: true },
    });

    return this.toSummary(drive);
  }

  async remove(userId: string, id: string) {
    const drive = await this.prisma.drive.findFirst({
      where: { id, userId },
      select: { id: true, source: true },
    });
    if (!drive) throw new NotFoundException('Drive not found');
    if (drive.source !== 'MANUAL') {
      throw new BadRequestException(
        'Only manually added drives can be deleted',
      );
    }
    await this.prisma.drive.delete({ where: { id } });
    return { ok: true };
  }

  async classify(userId: string, id: string, body: ClassifyDrive) {
    const drive = await this.prisma.drive.findFirst({ where: { id, userId } });
    if (!drive) throw new NotFoundException('Drive not found');

    let categoryId = drive.categoryId;
    let status = drive.status;

    if (body.categoryId !== undefined) {
      const resolved = await this.categories.resolveForClassify(
        userId,
        body.categoryId,
      );
      categoryId = resolved.categoryId;
      status = resolved.status;
    } else if (body.status === 'UNCLASSIFIED') {
      categoryId = null;
      status = 'UNCLASSIFIED';
    } else if (body.status === 'BUSINESS' || body.status === 'PERSONAL') {
      await this.categories.ensureDefaults(userId);
      const cat = await this.prisma.category.findFirst({
        where: {
          userId,
          deductible: body.status === 'BUSINESS',
          name: body.status === 'BUSINESS' ? 'Business' : 'Personal',
        },
      });
      categoryId = cat?.id ?? null;
      status = body.status;
    }

    const updated = await this.prisma.drive.update({
      where: { id },
      data: {
        categoryId,
        status,
        purposeNote:
          body.purposeNote === undefined ? drive.purposeNote : body.purposeNote,
        notes: body.notes === undefined ? drive.notes : body.notes,
      },
      include: { vehicle: true, category: true },
    });
    return this.toSummary(updated);
  }

  async batchClassify(userId: string, body: BatchClassify) {
    const resolved = await this.categories.resolveForClassify(
      userId,
      body.categoryId,
    );
    await this.prisma.drive.updateMany({
      where: { userId, id: { in: body.driveIds } },
      data: {
        categoryId: resolved.categoryId,
        status: resolved.status,
        purposeNote:
          body.purposeNote === undefined ? undefined : body.purposeNote,
      },
    });
    return this.list(userId, { status: 'UNCLASSIFIED' });
  }

  private toSummary(d: DriveWithRelations) {
    return {
      id: d.id,
      vehicleId: d.vehicleId,
      vehicleName: d.vehicle?.displayName ?? null,
      source: d.source,
      startedAt: d.startedAt.toISOString(),
      endedAt: d.endedAt?.toISOString() ?? null,
      startOdometer: d.startOdometer,
      endOdometer: d.endOdometer,
      distanceMiles: d.distanceMiles,
      durationSec: d.durationSec,
      startLat: d.startLat,
      startLng: d.startLng,
      endLat: d.endLat,
      endLng: d.endLng,
      startAddress: d.startAddress,
      endAddress: d.endAddress,
      status: d.status,
      categoryId: d.categoryId,
      categoryName: d.category?.name ?? null,
      categoryDeductible: d.category?.deductible ?? null,
      purposeNote: d.purposeNote,
      notes: d.notes,
    };
  }
}
