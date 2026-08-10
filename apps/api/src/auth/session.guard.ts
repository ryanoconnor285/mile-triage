import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.mile_session as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.auth.getUserFromSession(token);
    if (!user) {
      throw new UnauthorizedException('Session expired');
    }
    req.user = user;
    return true;
  }
}
