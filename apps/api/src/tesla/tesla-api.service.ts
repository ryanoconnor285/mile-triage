import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_TESLA_API_BASE,
  DEFAULT_TESLA_TOKEN_URL,
} from './tesla.constants';

export type TeslaVehicleDto = {
  vin: string;
  displayName: string | null;
};

@Injectable()
export class TeslaApiService {
  private readonly logger = new Logger(TeslaApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('TESLA_CLIENT_ID') &&
        this.config.get('TESLA_CLIENT_SECRET'),
    );
  }

  async getAccessToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.accessTokenEncrypted) {
      throw new UnauthorizedException('No Tesla tokens for user');
    }

    const expiresAt = user.tokenExpiresAt?.getTime() ?? 0;
    const stillValid = expiresAt - Date.now() > 60_000;
    if (stillValid) {
      return this.crypto.decrypt(user.accessTokenEncrypted);
    }

    if (!user.refreshTokenEncrypted) {
      throw new UnauthorizedException('Tesla refresh token missing');
    }

    return this.refreshTokens(userId, this.crypto.decrypt(user.refreshTokenEncrypted));
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<string> {
    const clientId = this.config.getOrThrow<string>('TESLA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('TESLA_CLIENT_SECRET');
    const tokenUrl =
      this.config.get<string>('TESLA_TOKEN_URL') ?? DEFAULT_TESLA_TOKEN_URL;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Tesla refresh failed: ${text}`);
      throw new UnauthorizedException('Tesla token refresh failed');
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accessTokenEncrypted: this.crypto.encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? this.crypto.encrypt(tokens.refresh_token)
          : undefined,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  }

  async listVehicles(userId: string): Promise<TeslaVehicleDto[]> {
    if (this.config.get('AUTH_MODE') !== 'tesla') {
      throw new ServiceUnavailableException(
        'Tesla API only available when AUTH_MODE=tesla',
      );
    }
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Tesla client credentials missing');
    }

    const accessToken = await this.getAccessToken(userId);
    const base =
      this.config.get<string>('TESLA_API_BASE') ?? DEFAULT_TESLA_API_BASE;

    const res = await fetch(`${base}/api/1/vehicles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Tesla vehicles list failed: ${text}`);
      throw new ServiceUnavailableException('Failed to list Tesla vehicles');
    }

    const json = (await res.json()) as {
      response?: Array<{
        vin?: string;
        display_name?: string;
        vehicle_id?: number;
      }>;
    };

    return (json.response ?? [])
      .filter((v) => Boolean(v.vin))
      .map((v) => ({
        vin: v.vin as string,
        displayName: v.display_name ?? null,
      }));
  }

  /**
   * Placeholder for Fleet Telemetry configure call.
   * Requires vehicle-command proxy + signed config in production.
   */
  async configureTelemetryStub(vin: string): Promise<{
    ok: boolean;
    message: string;
    vin: string;
  }> {
    return {
      ok: false,
      vin,
      message:
        'Fleet Telemetry configure is not wired yet. After Tesla app approval, point vehicles at your telemetry host via the vehicle-command proxy.',
    };
  }
}
