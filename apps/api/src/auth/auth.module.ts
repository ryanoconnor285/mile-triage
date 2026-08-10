import { Module } from '@nestjs/common';
import { CryptoService } from '../common/crypto.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { MeController } from './me.controller';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, CryptoService, SessionGuard],
  exports: [AuthService, SessionGuard, CryptoService],
})
export class AuthModule {}
