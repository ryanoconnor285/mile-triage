import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { RoutesService } from './routes.service';

const CreateFromDriveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  driveId: z.string(),
  radiusMiles: z.number().positive().max(5).optional(),
  suggestedCategoryId: z.string().nullable().optional(),
});

@Controller('routes')
@UseGuards(SessionGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.routes.list(req.user!.id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    const parsed = CreateFromDriveSchema.parse(body);
    return this.routes.createFromDrive(req.user!.id, parsed);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.routes.remove(req.user!.id, id);
  }
}
