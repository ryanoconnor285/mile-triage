import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
