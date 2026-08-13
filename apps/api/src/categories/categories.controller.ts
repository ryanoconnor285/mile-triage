import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from '@mile-triage/shared';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.categories.ensureDefaults(req.user!.id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    const parsed = CreateCategorySchema.parse(body);
    return this.categories.create(req.user!.id, parsed);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCategorySchema.parse(body);
    return this.categories.update(req.user!.id, id, parsed);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.categories.remove(req.user!.id, id);
  }
}
