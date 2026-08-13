import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MILEAGE_RATE } from '@mile-triage/shared';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_TESLA_API_BASE,
  DEFAULT_TESLA_AUTH_URL,
  DEFAULT_TESLA_TOKEN_URL,
} from '../tesla/tesla.constants';
import { AuthUser } from './auth.types';

const SESSION_COOKIE = 'mile_session';
const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  get cookieName() {
    return SESSION_COOKIE;
  }

  getAuthMode(): 'mock' | 'tesla' {
    return this.config.get<string>('AUTH_MODE') === 'tesla' ? 'tesla' : 'mock';
  }

  async createSession(userId: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.crypto.hashToken(token),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  async getUserFromSession(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.crypto.hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return {
      id: session.user.id,
      teslaUserId: session.user.teslaUserId,
      email: session.user.email,
      displayName: session.user.displayName,
    };
  }

  async logout(token?: string) {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: this.crypto.hashToken(token) },
    });
  }

  async loginWithMock(): Promise<{
    user: AuthUser;
    token: string;
    expiresAt: Date;
  }> {
    const user = await this.prisma.user.upsert({
      where: { teslaUserId: 'mock-tesla-user' },
      create: {
        teslaUserId: 'mock-tesla-user',
        email: 'demo@miletriage.local',
        displayName: 'Demo Driver',
        settings: {
          create: {
            mileageRate: Number(
              this.config.get('DEFAULT_MILEAGE_RATE') ?? DEFAULT_MILEAGE_RATE,
            ),
          },
        },
        vehicles: {
          create: [
            {
              vin: 'MOCK3VIN000000001',
              displayName: 'Demo Model 3',
              trackingEnabled: true,
              virtualKeyPaired: true,
              telemetryConfigured: true,
            },
            {
              vin: 'MOCKYVIN000000002',
              displayName: 'Demo Model Y',
              trackingEnabled: false,
              virtualKeyPaired: false,
              telemetryConfigured: false,
            },
          ],
        },
      },
      update: {
        email: 'demo@miletriage.local',
        displayName: 'Demo Driver',
      },
    });

    const existingSettings = await this.prisma.appSettings.findUnique({
      where: { userId: user.id },
    });
    if (!existingSettings) {
      await this.prisma.appSettings.create({
        data: {
          userId: user.id,
          mileageRate: Number(
            this.config.get('DEFAULT_MILEAGE_RATE') ?? DEFAULT_MILEAGE_RATE,
          ),
        },
      });
    }

    await this.ensureDefaultCategories(user.id);

    const { token, expiresAt } = await this.createSession(user.id);
    return {
      user: {
        id: user.id,
        teslaUserId: user.teslaUserId,
        email: user.email,
        displayName: user.displayName,
      },
      token,
      expiresAt,
    };
  }

  private async ensureDefaultCategories(userId: string) {
    const count = await this.prisma.category.count({ where: { userId } });
    if (count > 0) return;
    await this.prisma.category.createMany({
      data: [
        { userId, name: 'Business', deductible: true, sortOrder: 0 },
        { userId, name: 'Personal', deductible: false, sortOrder: 1 },
      ],
    });
  }

  getTeslaAuthorizeUrl(state: string): string {
    const clientId = this.config.getOrThrow<string>('TESLA_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('TESLA_REDIRECT_URI');
    const authUrl =
      this.config.get<string>('TESLA_AUTH_URL') ?? DEFAULT_TESLA_AUTH_URL;
    const scopes =
      this.config.get<string>('TESLA_SCOPES') ??
      'openid offline_access user_data vehicle_device_data vehicle_location';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
      // Tesla otherwise reuses an account's existing consent and reissues the
      // old scope set, so signing in again after enabling a scope would keep
      // handing back a token without it.
      prompt_missing_scopes: 'true',
    });
    return `${authUrl}?${params.toString()}`;
  }

  async handleTeslaCallback(code: string): Promise<{
    user: AuthUser;
    token: string;
    expiresAt: Date;
  }> {
    const clientId = this.config.getOrThrow<string>('TESLA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('TESLA_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('TESLA_REDIRECT_URI');
    const tokenUrl =
      this.config.get<string>('TESLA_TOKEN_URL') ?? DEFAULT_TESLA_TOKEN_URL;
    const audience =
      this.config.get<string>('TESLA_AUDIENCE') ?? DEFAULT_TESLA_API_BASE;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      audience,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Tesla token exchange failed: ${text}`);
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      id_token?: string;
    };

    const teslaUserId =
      this.decodeSub(tokens.id_token) ??
      this.crypto.hashToken(tokens.access_token).slice(0, 24);
    const email = this.decodeEmail(tokens.id_token);

    const user = await this.prisma.user.upsert({
      where: { teslaUserId },
      create: {
        teslaUserId,
        email,
        accessTokenEncrypted: this.crypto.encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? this.crypto.encrypt(tokens.refresh_token)
          : null,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        settings: {
          create: {
            mileageRate: Number(
              this.config.get('DEFAULT_MILEAGE_RATE') ?? DEFAULT_MILEAGE_RATE,
            ),
          },
        },
      },
      update: {
        email: email ?? undefined,
        accessTokenEncrypted: this.crypto.encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? this.crypto.encrypt(tokens.refresh_token)
          : undefined,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    await this.ensureDefaultCategories(user.id);

    const { token, expiresAt } = await this.createSession(user.id);
    return {
      user: {
        id: user.id,
        teslaUserId: user.teslaUserId,
        email: user.email,
        displayName: user.displayName,
      },
      token,
      expiresAt,
    };
  }

  private decodeSub(idToken?: string): string | null {
    if (!idToken) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  private decodeEmail(idToken?: string): string | null {
    if (!idToken) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { email?: string };
      return payload.email ?? null;
    } catch {
      return null;
    }
  }
}
