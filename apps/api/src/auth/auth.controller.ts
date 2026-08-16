import {
  Controller,
  ForbiddenException,
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
  async startTesla(@Req() req: Request, @Res() res: Response) {
    // In mock/dev mode there is no Tesla app yet — log in as demo user.
    if (this.auth.getAuthMode() === 'mock') {
      return this.mockLogin(req, res);
    }
    const state = randomBytes(16).toString('hex');
    res.cookie('mile_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
      secure: this.isSecureRequest(req),
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
    const webOrigin = webOriginFromEnv(this.config.get<string>('WEB_ORIGIN'));
    try {
      const { token, expiresAt } = await this.auth.handleTeslaCallback(code);
      this.setSessionCookie(req, res, token, expiresAt);
      res.clearCookie('mile_oauth_state', { path: '/' });
      return res.redirect(`${webOrigin}/onboarding`);
    } catch (err) {
      res.clearCookie('mile_oauth_state', { path: '/' });
      if (err instanceof ForbiddenException) {
        return res.redirect(`${webOrigin}/?signup=blocked`);
      }
      throw err;
    }
  }

  @Get('mock')
  async mockLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('json') json?: string,
  ) {
    if (this.auth.getAuthMode() === 'tesla') {
      throw new ForbiddenException('Demo login is disabled');
    }
    const { token, expiresAt } = await this.auth.loginWithMock();
    this.setSessionCookie(req, res, token, expiresAt);
    if (json === '1') {
      return res.json({ ok: true });
    }
    const webOrigin = webOriginFromEnv(this.config.get<string>('WEB_ORIGIN'));
    return res.redirect(`${webOrigin}/triage`);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.mile_session as string | undefined);
    res.clearCookie(this.auth.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.isSecureRequest(req),
    });
    return { ok: true };
  }

  private isSecureRequest(req: Request): boolean {
    if (process.env.NODE_ENV !== 'production') return false;
    if (req.secure) return true;
    const proto = req.headers['x-forwarded-proto'];
    const value = Array.isArray(proto) ? proto[0] : proto;
    return value?.split(',')[0]?.trim() === 'https';
  }

  private setSessionCookie(
    req: Request,
    res: Response,
    token: string,
    expiresAt: Date,
  ) {
    res.cookie(this.auth.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isSecureRequest(req),
      path: '/',
      expires: expiresAt,
    });
  }
}
