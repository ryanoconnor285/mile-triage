import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SimulateController } from './simulate.controller';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [AuthModule],
  controllers: [TelemetryController, SimulateController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
