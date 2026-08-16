import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  keywordsFromAddress,
  matchRouteScore,
  type DriveEndpoints,
} from './route-match.util';

export type CreateRouteFromDrive = {
  name: string;
  driveId: string;
  radiusMiles?: number;
  suggestedCategoryId?: string | null;
};

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedRoute.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { suggestedCategory: true },
    });
  }

  async createFromDrive(userId: string, body: CreateRouteFromDrive) {
    const drive = await this.prisma.drive.findFirst({
      where: { id: body.driveId, userId },
    });
    if (!drive) throw new NotFoundException('Drive not found');
    if (
      drive.startLat == null ||
      drive.startLng == null ||
      drive.endLat == null ||
      drive.endLng == null
    ) {
      throw new BadRequestException(
        'Drive needs GPS endpoints to save as a route',
      );
    }

    try {
      return await this.prisma.savedRoute.create({
        data: {
          userId,
          name: body.name.trim(),
          startLat: drive.startLat,
          startLng: drive.startLng,
          endLat: drive.endLat,
          endLng: drive.endLng,
          radiusMiles: body.radiusMiles ?? 0.35,
          startKeywords: keywordsFromAddress(drive.startAddress),
          endKeywords: keywordsFromAddress(drive.endAddress),
          suggestedCategoryId: body.suggestedCategoryId ?? null,
        },
        include: { suggestedCategory: true },
      });
    } catch {
      throw new BadRequestException('Route name already exists');
    }
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.savedRoute.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Route not found');
    await this.prisma.savedRoute.delete({ where: { id } });
    return { ok: true };
  }

  async matchDrive(userId: string, drive: DriveEndpoints & { id?: string }) {
    const routes = await this.prisma.savedRoute.findMany({ where: { userId } });
    let best: {
      routeId: string;
      routeName: string;
      suggestedCategoryId: string | null;
      score: number;
    } | null = null;

    for (const route of routes) {
      const score = matchRouteScore(route, drive);
      if (score == null) continue;
      if (!best || score > best.score) {
        best = {
          routeId: route.id,
          routeName: route.name,
          suggestedCategoryId: route.suggestedCategoryId,
          score,
        };
      }
    }

    if (!best) return null;
    return {
      routeId: best.routeId,
      routeName: best.routeName,
      suggestedCategoryId: best.suggestedCategoryId,
    };
  }

  async matchMany(userId: string, drives: (DriveEndpoints & { id: string })[]) {
    const routes = await this.prisma.savedRoute.findMany({ where: { userId } });
    const out = new Map<
      string,
      {
        routeId: string;
        routeName: string;
        suggestedCategoryId: string | null;
      }
    >();

    for (const drive of drives) {
      let best: {
        routeId: string;
        routeName: string;
        suggestedCategoryId: string | null;
        score: number;
      } | null = null;

      for (const route of routes) {
        const score = matchRouteScore(route, drive);
        if (score == null) continue;
        if (!best || score > best.score) {
          best = {
            routeId: route.id,
            routeName: route.name,
            suggestedCategoryId: route.suggestedCategoryId,
            score,
          };
        }
      }

      if (best) {
        out.set(drive.id, {
          routeId: best.routeId,
          routeName: best.routeName,
          suggestedCategoryId: best.suggestedCategoryId,
        });
      }
    }

    return out;
  }
}
