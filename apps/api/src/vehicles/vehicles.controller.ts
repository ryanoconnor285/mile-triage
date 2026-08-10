import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(SessionGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.vehicles.list(req.user!.id);
  }

  @Post('sync')
  sync(@Req() req: Request) {
    return this.vehicles.syncFromTesla(req.user!.id);
  }

  @Post(':id/track')
  track(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { enabled?: boolean },
  ) {
    return this.vehicles.setTracking(req.user!.id, id, body.enabled ?? true);
  }

  @Post(':id/paired')
  paired(@Req() req: Request, @Param('id') id: string) {
    return this.vehicles.markVirtualKeyPaired(req.user!.id, id);
  }

  @Get(':id/pairing')
  pairing(@Req() req: Request, @Param('id') id: string) {
    return this.vehicles.pairingInfo(req.user!.id, id);
  }
}
