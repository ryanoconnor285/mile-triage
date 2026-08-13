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

/**
 * A single observation of a car. `reachable: false` means the car was asleep or
 * offline, which is normal and carries no information — never a reason to treat
 * the car as parked.
 */
export type TeslaVehicleSnapshot = {
  reachable: boolean;
  odometer: number | null;
  lat: number | null;
  lng: number | null;
  /** 'D' | 'R' | 'N' | 'P', or null which Tesla also uses for a parked car. */
  shiftState: string | null;
  observedAt: Date;
};

/** Tesla returns 408 for a sleeping car; asking again will not change that. */
const VEHICLE_ASLEEP_STATUS = 408;

@Injectable()
export class TeslaApiService {
  private readonly logger = new Logger(TeslaApiService.name);
  private readonly regionCache = new Map<string, string>();

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

    return this.refreshTokens(
      userId,
      this.crypto.decrypt(user.refreshTokenEncrypted),
    );
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

  private configuredApiBase(): string {
    return (
      this.config.get<string>('TESLA_API_BASE') ?? DEFAULT_TESLA_API_BASE
    ).replace(/\/+$/, '');
  }

  /**
   * Fleet API is partitioned by region and rejects accounts queried through the
   * wrong base URL, so let the account tell us where it lives rather than
   * assuming the configured default is right.
   */
  private async resolveApiBase(
    userId: string,
    accessToken: string,
  ): Promise<string> {
    const cached = this.regionCache.get(userId);
    if (cached) return cached;

    const fallback = this.configuredApiBase();
    try {
      const res = await fetch(`${fallback}/api/1/users/region`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          response?: { fleet_api_base_url?: string };
        };
        const base = json.response?.fleet_api_base_url?.replace(/\/+$/, '');
        if (base) {
          if (base !== fallback) {
            this.logger.log(`Tesla account region resolved to ${base}`);
          }
          this.regionCache.set(userId, base);
          return base;
        }
      } else {
        this.logger.warn(
          `Tesla region lookup failed (${res.status}): ${await res.text()}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Tesla region lookup errored: ${String(err)}`);
    }

    return fallback;
  }

  /**
   * Tesla only grants scopes the app is registered for, silently dropping the
   * rest, so the scopes actually present on the token are what distinguish an
   * unconfigured app from a stale consent.
   */
  private grantedScopes(accessToken: string): string | null {
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { scp?: string[] | string };
      const scp = payload.scp;
      if (Array.isArray(scp)) return scp.join(' ');
      return typeof scp === 'string' ? scp : null;
    } catch {
      return null;
    }
  }

  /** Tesla nests the useful text differently per endpoint; dig it out. */
  private async failureDetail(res: Response): Promise<string> {
    const text = (await res.text()).trim();
    try {
      const json = JSON.parse(text) as {
        error?: string;
        error_description?: string;
        messages?: unknown;
      };
      return (
        json.error_description ||
        json.error ||
        (json.messages ? JSON.stringify(json.messages) : '') ||
        text
      );
    } catch {
      return text;
    }
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
    const base = await this.resolveApiBase(userId, accessToken);

    const res = await fetch(`${base}/api/1/vehicles`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const detail = await this.failureDetail(res);
      this.logger.error(
        `Tesla vehicles list failed (${res.status}): ${detail}`,
      );

      // A stale cached region survives past its usefulness; drop it so the next
      // attempt re-discovers instead of failing the same way forever.
      if (res.status === 412 || res.status === 421) {
        this.regionCache.delete(userId);
      }

      if (res.status === 401) {
        throw new UnauthorizedException(
          'Tesla rejected the saved token. Log out and reconnect Tesla.',
        );
      }
      if (res.status === 403) {
        const granted = this.grantedScopes(accessToken);
        throw new ServiceUnavailableException(
          `Tesla denied access to your vehicles. This login granted ${
            granted ? `"${granted}"` : 'no readable scopes'
          }, but listing vehicles needs vehicle_device_data. Enable "Vehicle Information" on your app at developer.tesla.com, then log out and reconnect. Details: ${detail}`,
        );
      }
      throw new ServiceUnavailableException(
        `Tesla vehicle list failed (${res.status}): ${detail}`,
      );
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
   * Read odometer, gear and location for one car.
   *
   * Deliberately never calls `wake_up`: a sleeping car costs battery to wake,
   * and park detection does not need the reading. A 408 is reported as
   * unreachable so the caller can back off and try later.
   */
  async getVehicleSnapshot(
    userId: string,
    vin: string,
  ): Promise<TeslaVehicleSnapshot> {
    const accessToken = await this.getAccessToken(userId);
    const base = await this.resolveApiBase(userId, accessToken);
    const url =
      `${base}/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data` +
      `?endpoints=${encodeURIComponent('drive_state;vehicle_state')}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const unreachable: TeslaVehicleSnapshot = {
      reachable: false,
      odometer: null,
      lat: null,
      lng: null,
      shiftState: null,
      observedAt: new Date(),
    };

    if (res.status === VEHICLE_ASLEEP_STATUS) {
      return unreachable;
    }

    if (!res.ok) {
      const detail = await this.failureDetail(res);
      if (res.status === 412 || res.status === 421) {
        this.regionCache.delete(userId);
      }
      if (res.status === 401) {
        throw new UnauthorizedException(
          'Tesla rejected the saved token. Log out and reconnect Tesla.',
        );
      }
      if (res.status === 403) {
        const granted = this.grantedScopes(accessToken);
        throw new ServiceUnavailableException(
          `Tesla denied vehicle data. This login granted ${
            granted ? `"${granted}"` : 'no readable scopes'
          }, but reading odometer and location needs vehicle_device_data and vehicle_location. Details: ${detail}`,
        );
      }
      throw new ServiceUnavailableException(
        `Tesla vehicle data failed (${res.status}): ${detail}`,
      );
    }

    const json = (await res.json()) as {
      response?: {
        state?: string;
        drive_state?: {
          shift_state?: string | null;
          latitude?: number;
          longitude?: number;
          timestamp?: number;
        };
        vehicle_state?: { odometer?: number };
      };
    };

    const drive = json.response?.drive_state;
    const odometer = json.response?.vehicle_state?.odometer;
    if (json.response?.state && json.response.state !== 'online') {
      return unreachable;
    }

    return {
      reachable: true,
      // Fleet API reports odometer in miles regardless of the car's display units.
      odometer: typeof odometer === 'number' ? odometer : null,
      lat: typeof drive?.latitude === 'number' ? drive.latitude : null,
      lng: typeof drive?.longitude === 'number' ? drive.longitude : null,
      shiftState: drive?.shift_state ?? null,
      observedAt: drive?.timestamp ? new Date(drive.timestamp) : new Date(),
    };
  }
}
