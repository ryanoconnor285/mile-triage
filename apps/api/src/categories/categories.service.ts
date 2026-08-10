import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategory, UpdateCategory } from '@mile-triage/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(userId: string) {
    const count = await this.prisma.category.count({ where: { userId } });
    if (count > 0) return this.list(userId);

    await this.prisma.category.createMany({
      data: [
        { userId, name: 'Business', deductible: true, sortOrder: 0 },
        { userId, name: 'Personal', deductible: false, sortOrder: 1 },
      ],
    });
    return this.list(userId);
  }

  list(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, body: CreateCategory) {
    await this.ensureDefaults(userId);
    const max = await this.prisma.category.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    try {
      return await this.prisma.category.create({
        data: {
          userId,
          name: body.name.trim(),
          deductible: body.deductible,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
        },
      });
    } catch {
      throw new BadRequestException('Category name already exists');
    }
  }

  async update(userId: string, id: string, body: UpdateCategory) {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: {
          name: body.name?.trim(),
          deductible: body.deductible,
          sortOrder: body.sortOrder,
        },
      });

      if (body.deductible !== undefined) {
        await this.prisma.drive.updateMany({
          where: { userId, categoryId: id },
          data: {
            status: body.deductible ? 'BUSINESS' : 'PERSONAL',
          },
        });
      }
      return updated;
    } catch {
      throw new BadRequestException('Category name already exists');
    }
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const used = await this.prisma.drive.count({
      where: { userId, categoryId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Category is in use. Reclassify those drives first.',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  async resolveForClassify(
    userId: string,
    categoryId: string | null | undefined,
  ) {
    if (categoryId === null || categoryId === undefined) {
      return { categoryId: null, status: 'UNCLASSIFIED' as const };
    }
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return {
      categoryId: category.id,
      status: category.deductible
        ? ('BUSINESS' as const)
        : ('PERSONAL' as const),
    };
  }
}
