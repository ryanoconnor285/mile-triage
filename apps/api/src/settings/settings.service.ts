import { Injectable } from '@nestjs/common';
import { DEFAULT_MILEAGE_RATE } from '@mile-triage/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const settings = await this.prisma.appSettings.upsert({
      where: { userId },
      create: { userId, mileageRate: DEFAULT_MILEAGE_RATE },
      update: {},
    });
    return {
      mileageRate: settings.mileageRate,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn as 0 | 1,
    };
  }

  async update(
    userId: string,
    data: Partial<{ mileageRate: number; timezone: string; weekStartsOn: 0 | 1 }>,
  ) {
    const settings = await this.prisma.appSettings.upsert({
      where: { userId },
      create: {
        userId,
        mileageRate: data.mileageRate ?? DEFAULT_MILEAGE_RATE,
        timezone: data.timezone ?? 'America/New_York',
        weekStartsOn: data.weekStartsOn ?? 0,
      },
      update: data,
    });
    return {
      mileageRate: settings.mileageRate,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn as 0 | 1,
    };
  }
}
