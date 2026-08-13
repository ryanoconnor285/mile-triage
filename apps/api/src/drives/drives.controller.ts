import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DriveStatus } from '@prisma/client';
import {
  BatchClassifySchema,
  ClassifyDriveSchema,
  CreateDriveSchema,
} from '@mile-triage/shared';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { DrivesService } from './drives.service';

@Controller('drives')
@UseGuards(SessionGuard)
export class DrivesController {
  constructor(private readonly drives: DrivesService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('status') status?: DriveStatus,
    @Query('week') week?: string,
  ) {
    return this.drives.list(req.user!.id, { status, week });
  }

  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    const parsed = CreateDriveSchema.parse(body);
    return this.drives.create(req.user!.id, parsed);
  }

  @Post('batch-classify')
  batch(@Req() req: Request, @Body() body: unknown) {
    const parsed = BatchClassifySchema.parse(body);
    return this.drives.batchClassify(req.user!.id, parsed);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.drives.remove(req.user!.id, id);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.drives.get(req.user!.id, id);
  }

  @Patch(':id')
  classify(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = ClassifyDriveSchema.parse(body);
    return this.drives.classify(req.user!.id, id, parsed);
  }
}
