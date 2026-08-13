import { Module } from '@nestjs/common';
import { AddressBackfillService } from './address-backfill.service';
import { GeocodeService } from './geocode.service';

@Module({
  providers: [GeocodeService, AddressBackfillService],
  exports: [GeocodeService],
})
export class GeocodeModule {}
