import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeslaApiService } from './tesla-api.service';
import { WellKnownController } from './well-known.controller';

@Module({
  imports: [AuthModule],
  controllers: [WellKnownController],
  providers: [TeslaApiService],
  exports: [TeslaApiService],
})
export class TeslaModule {}
