import { Module } from '@nestjs/common';
import { TeslaModule } from '../tesla/tesla.module';
import { PollingService } from './polling.service';

@Module({
  imports: [TeslaModule],
  providers: [PollingService],
  exports: [PollingService],
})
export class PollingModule {}
