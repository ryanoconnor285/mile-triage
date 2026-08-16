import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriveStatus, Prisma } from '@prisma/client';
import { BatchClassify, ClassifyDrive, CreateDrive } from '@mile-triage/shared';
import { CategoriesService } from '../categories/categories.service';
import { RoutesService } from '../routes/routes.service';
import { PrismaService } from '../prisma/prisma.service';

type DriveWithRelations = Prisma.DriveGetPayload<{
  include: { vehicle: true; category: true };
}>;

@Injectable()
export class DrivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly routes: RoutesService,
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

    let routeMatches: Map<
      string,
      {
        routeId: string;
        routeName: string;
        suggestedCategoryId: string | null;
      }
    > | null = null;
    if (opts.status === 'UNCLASSIFIED' && drives.length > 0) {
      routeMatches = await this.routes.matchMany(
        userId,
        drives.map((d) => ({
          id: d.id,
          startLat: d.startLat,
          startLng: d.startLng,
          endLat: d.endLat,
          endLng: d.endLng,
          startAddress: d.startAddress,
          endAddress: d.endAddress,
        })),
      );
    }

    return drives.map((d) =>
      this.toSummary(d, routeMatches?.get(d.id) ?? null),
    );
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

    let status: DriveStatus = body.status ?? DriveStatus.UNCLASSIFIED;
    let categoryId: string | null = null;

    if (body.categoryId) {
      const tag = await this.categories.getTag(userId, body.categoryId);
      if (body.status) {
        this.categories.assertTagMatchesStatus(tag, body.status);
        categoryId = tag.id;
      } else {
        const resolved = await this.categories.resolveForClassify(
          userId,
          body.categoryId,
        );
        status = resolved.status;
        categoryId = resolved.categoryId;
      }
    } else if (body.status && body.status !== 'UNCLASSIFIED') {
      status = body.status;
    }

    const drive = await this.prisma.drive.create({
      data: {
        userId,
        vehicleId: body.vehicleId ?? null,
        source: 'MANUAL',
        startedAt,
        endedAt: startedAt,
        distanceMiles: body.distanceMiles,
        categoryId,
        status,
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
    const drive = await this.prisma.drive.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!drive) throw new NotFoundException('Drive not found');

    let categoryId = drive.categoryId;
    let status = drive.status;

    if (body.status !== undefined) {
      status = body.status;
      if (body.status === 'UNCLASSIFIED') {
        categoryId = null;
      }
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId === null) {
        categoryId = null;
      } else {
        const tag = await this.categories.getTag(userId, body.categoryId);
        if (body.status !== undefined) {
          this.categories.assertTagMatchesStatus(tag, body.status);
          categoryId = tag.id;
        } else if (status === 'BUSINESS' || status === 'PERSONAL') {
          this.categories.assertTagMatchesStatus(tag, status);
          categoryId = tag.id;
        } else {
          const resolved = await this.categories.resolveForClassify(
            userId,
            body.categoryId,
          );
          categoryId = resolved.categoryId;
          status = resolved.status;
        }
      }
    } else if (
      body.status !== undefined &&
      body.status !== 'UNCLASSIFIED' &&
      categoryId &&
      drive.category
    ) {
      try {
        this.categories.assertTagMatchesStatus(drive.category, body.status);
      } catch {
        categoryId = null;
      }
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
    for (const driveId of body.driveIds) {
      await this.classify(userId, driveId, {
        status: body.status,
        categoryId: body.categoryId,
        notes: body.notes,
      });
    }
    return this.list(userId, { status: 'UNCLASSIFIED' });
  }

  private toSummary(
    d: DriveWithRelations,
    routeSuggestion?: {
      routeId: string;
      routeName: string;
      suggestedCategoryId: string | null;
    } | null,
  ) {
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
      routeSuggestion: routeSuggestion ?? null,
    };
  }
}
