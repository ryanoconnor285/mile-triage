import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

type ExportRow = {
  date: string;
  vehicle: string;
  startAddress: string;
  endAddress: string;
  startOdometer: number | '';
  endOdometer: number | '';
  totalMiles: number;
  purpose: string;
  purposeNote: string;
  notes: string;
  deduction: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async summary(userId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const settings = await this.settings.get(userId);
    const drives = await this.prisma.drive.findMany({
      where: {
        userId,
        startedAt: { gte: fromDate, lte: toDate },
        endedAt: { not: null },
      },
      include: { category: true },
    });

    let businessMiles = 0;
    let personalMiles = 0;
    let unclassifiedMiles = 0;
    let businessDriveCount = 0;

    for (const d of drives) {
      const miles = d.distanceMiles ?? 0;
      const deductible = d.category?.deductible ?? d.status === 'BUSINESS';
      if (!d.categoryId && d.status === 'UNCLASSIFIED') {
        unclassifiedMiles += miles;
      } else if (deductible) {
        businessMiles += miles;
        businessDriveCount += 1;
      } else {
        personalMiles += miles;
      }
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      businessMiles: Number(businessMiles.toFixed(2)),
      personalMiles: Number(personalMiles.toFixed(2)),
      unclassifiedMiles: Number(unclassifiedMiles.toFixed(2)),
      mileageRate: settings.mileageRate,
      deductionDollars: Number(
        (businessMiles * settings.mileageRate).toFixed(2),
      ),
      businessDriveCount,
    };
  }

  async exportRows(
    userId: string,
    from: string,
    to: string,
  ): Promise<ExportRow[]> {
    const settings = await this.settings.get(userId);
    const drives = await this.prisma.drive.findMany({
      where: {
        userId,
        startedAt: { gte: new Date(from), lte: new Date(to) },
        endedAt: { not: null },
      },
      include: { vehicle: true, category: true },
      orderBy: { startedAt: 'asc' },
    });

    return drives.map((d) => {
      const miles = d.distanceMiles ?? 0;
      const isBusiness = d.category?.deductible ?? d.status === 'BUSINESS';
      return {
        date: d.startedAt.toISOString().slice(0, 10),
        vehicle: d.vehicle?.displayName ?? d.vehicle?.vin ?? 'Manual entry',
        startAddress: d.startAddress ?? '',
        endAddress: d.endAddress ?? '',
        startOdometer: d.startOdometer ?? '',
        endOdometer: d.endOdometer ?? '',
        totalMiles: miles,
        purpose: d.category?.name ?? d.status,
        purposeNote: d.purposeNote ?? '',
        notes: d.notes ?? '',
        deduction: isBusiness
          ? Number((miles * settings.mileageRate).toFixed(2))
          : 0,
      };
    });
  }

  toCsv(rows: ExportRow[]): string {
    const headers = [
      'Date',
      'Vehicle',
      'Start',
      'End',
      'Start Odometer',
      'End Odometer',
      'Total Miles',
      'Category',
      'Purpose Note',
      'Notes',
      'Deduction ($)',
    ];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.date,
          r.vehicle,
          r.startAddress,
          r.endAddress,
          r.startOdometer,
          r.endOdometer,
          r.totalMiles,
          r.purpose,
          r.purposeNote,
          r.notes,
          r.deduction,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    return lines.join('\n');
  }

  async toPdf(
    rows: ExportRow[],
    meta: { mileageRate: number; from: string; to: string },
  ): Promise<Buffer> {
    const businessMiles = rows
      .filter((r) => r.purpose === 'BUSINESS')
      .reduce((s, r) => s + r.totalMiles, 0);
    const deduction = Number((businessMiles * meta.mileageRate).toFixed(2));

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('MileTriage Mileage Report', { underline: false });
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .fillColor('#444')
        .text(`Period: ${meta.from.slice(0, 10)} → ${meta.to.slice(0, 10)}`)
        .text(`Rate: $${meta.mileageRate.toFixed(2)} / mile`)
        .text(
          `Business miles: ${businessMiles.toFixed(1)} · Deduction: $${deduction.toFixed(2)}`,
        );
      doc.moveDown();
      doc.fillColor('#000');

      for (const r of rows) {
        if (doc.y > 720) doc.addPage();
        doc
          .fontSize(11)
          .text(
            `${r.date}  ·  ${r.totalMiles.toFixed(1)} mi  ·  ${r.purpose}`,
            { continued: false },
          );
        doc
          .fontSize(9)
          .fillColor('#333')
          .text(`${r.startAddress || 'Start'} → ${r.endAddress || 'End'}`);
        doc.text(
          `Odometer ${r.startOdometer}${r.endOdometer !== '' ? ` → ${r.endOdometer}` : ''}  ·  $${r.deduction.toFixed(2)}`,
        );
        if (r.purposeNote) doc.text(`Purpose: ${r.purposeNote}`);
        if (r.notes) doc.text(`Notes: ${r.notes}`);
        doc.fillColor('#000').moveDown(0.55);
      }

      if (!rows.length) {
        doc.fontSize(11).text('No drives in this period.');
      }

      doc.end();
    });
  }
}
