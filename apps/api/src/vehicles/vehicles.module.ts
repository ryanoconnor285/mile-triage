import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeslaModule } from '../tesla/tesla.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AuthModule, TeslaModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
