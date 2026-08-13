import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { webOriginFromEnv } from '../common/web-origin';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('mode')
  mode() {
    return { mode: this.auth.getAuthMode() };
  }

  @Get('tesla')
  async startTesla(@Res() res: Response) {
    // In mock/dev mode there is no Tesla app yet — log in as demo user.
    // Do not redirect to a relative /auth/mock path: via the Vite proxy that
    // lands on the web origin and shows a blank page.
    if (this.auth.getAuthMode() === 'mock') {
      return this.mockLogin(res);
    }
    const state = randomBytes(16).toString('hex');
    res.cookie('mile_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.auth.getTeslaAuthorizeUrl(state));
  }

  @Get('tesla/callback')
  async teslaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const expected = req.cookies?.mile_oauth_state as string | undefined;
    if (!code || !state || !expected || state !== expected) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
    const { token, expiresAt } = await this.auth.handleTeslaCallback(code);
    this.setSessionCookie(res, token, expiresAt);
    res.clearCookie('mile_oauth_state');
    const webOrigin = webOriginFromEnv(this.config.get<string>('WEB_ORIGIN'));
    return res.redirect(`${webOrigin}/onboarding`);
  }

  @Get('mock')
  async mockLogin(@Res() res: Response) {
    const { token, expiresAt } = await this.auth.loginWithMock();
    this.setSessionCookie(res, token, expiresAt);
    const webOrigin = webOriginFromEnv(this.config.get<string>('WEB_ORIGIN'));
    return res.redirect(`${webOrigin}/triage`);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.mile_session as string | undefined);
    res.clearCookie(this.auth.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
    });
    return { ok: true };
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.auth.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
    });
  }
}
