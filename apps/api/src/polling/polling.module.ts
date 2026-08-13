import { Module } from '@nestjs/common';
import { GeocodeModule } from '../geocode/geocode.module';
import { TeslaModule } from '../tesla/tesla.module';
import { PollingService } from './polling.service';

@Module({
  imports: [TeslaModule, GeocodeModule],
  providers: [PollingService],
  exports: [PollingService],
})
export class PollingModule {}
