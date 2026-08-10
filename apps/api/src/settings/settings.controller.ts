import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AppSettingsSchema } from '@mile-triage/shared';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@Req() req: Request) {
    return this.settings.get(req.user!.id);
  }

  @Patch()
  update(@Req() req: Request, @Body() body: unknown) {
    const parsed = AppSettingsSchema.partial().parse(body);
    return this.settings.update(req.user!.id, parsed);
  }
}
