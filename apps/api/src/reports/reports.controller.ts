import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { SettingsService } from '../settings/settings.service';
import { ReportsService } from './reports.service';

@Controller()
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('reports/summary')
  summary(
    @Req() req: Request,
    @Query('from') from = new Date(new Date().getFullYear(), 0, 1).toISOString(),
    @Query('to') to = new Date().toISOString(),
  ) {
    return this.reports.summary(req.user!.id, from, to);
  }

  @Get('exports/csv')
  async csv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from = new Date(new Date().getFullYear(), 0, 1).toISOString(),
    @Query('to') to = new Date().toISOString(),
  ) {
    const rows = await this.reports.exportRows(req.user!.id, from, to);
    const csv = this.reports.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="miletriage-export.csv"',
    );
    res.send(csv);
  }

  @Get('exports/pdf')
  async pdf(
    @Req() req: Request,
    @Res() res: Response,
    @Query('from') from = new Date(new Date().getFullYear(), 0, 1).toISOString(),
    @Query('to') to = new Date().toISOString(),
  ) {
    const [rows, settings] = await Promise.all([
      this.reports.exportRows(req.user!.id, from, to),
      this.settings.get(req.user!.id),
    ]);
    const pdf = await this.reports.toPdf(rows, {
      mileageRate: settings.mileageRate,
      from,
      to,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="miletriage-export.pdf"',
    );
    res.send(pdf);
  }
}
