import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { RoutesModule } from '../routes/routes.module';
import { DrivesController } from './drives.controller';
import { DrivesService } from './drives.service';

@Module({
  imports: [AuthModule, CategoriesModule, RoutesModule],
  controllers: [DrivesController],
  providers: [DrivesService],
  exports: [DrivesService],
})
export class DrivesModule {}
