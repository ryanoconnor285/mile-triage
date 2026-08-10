import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelemetryEventSchema } from '@mile-triage/shared';
import { z } from 'zod';
import { TelemetryService } from './telemetry.service';

const IngestBodySchema = z.object({
  events: z.array(TelemetryEventSchema).min(1),
});

@Controller('internal/telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async ingest(
    @Headers('x-telemetry-secret') secret: string | undefined,
    @Body() body: unknown,
  ) {
    const expected = this.config.get<string>('INTERNAL_TELEMETRY_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid telemetry secret');
    }
    const parsed = IngestBodySchema.parse(body);
    return this.telemetry.ingest(parsed.events);
  }
}
