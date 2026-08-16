import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DrivesModule } from './drives/drives.module';
import { GeocodeModule } from './geocode/geocode.module';
import { PollingModule } from './polling/polling.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { RoutesModule } from './routes/routes.module';
import { SettingsModule } from './settings/settings.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TeslaModule } from './tesla/tesla.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TeslaModule,
    VehiclesModule,
    CategoriesModule,
    DrivesModule,
    TelemetryModule,
    GeocodeModule,
    PollingModule,
    SettingsModule,
    ReportsModule,
    RoutesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
