import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { TeslaApiService } from './tesla-api.service';

@Controller('setup')
export class SetupController {
  constructor(
    private readonly config: ConfigService,
    private readonly tesla: TeslaApiService,
  ) {}

  @Get('status')
  status() {
    const authMode = this.config.get<string>('AUTH_MODE') ?? 'mock';
    const domain = this.config.get<string>('TESLA_DOMAIN') ?? '';
    const publicKeyPath =
      this.config.get<string>('TESLA_PUBLIC_KEY_PATH') ??
      join(process.cwd(), 'keys', 'public-key.pem');
    const hasPublicKey =
      existsSync(publicKeyPath) ||
      existsSync(join(process.cwd(), '..', '..', 'keys', 'public-key.pem'));

    const checks = [
      {
        id: 'auth_mode',
        label: 'Auth mode',
        ok: true,
        detail: authMode,
      },
      {
        id: 'client_credentials',
        label: 'Tesla client ID/secret',
        ok: this.tesla.isConfigured(),
        detail: this.tesla.isConfigured()
          ? 'Configured'
          : 'Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET',
      },
      {
        id: 'domain',
        label: 'Public domain',
        ok: Boolean(domain && domain !== 'localhost'),
        detail: domain || 'Set TESLA_DOMAIN to your public hostname',
      },
      {
        id: 'public_key',
        label: 'Public key file',
        ok: hasPublicKey,
        detail: hasPublicKey
          ? 'Found keys/public-key.pem'
          : 'Run npm run tesla:keys',
      },
      {
        id: 'redirect_uri',
        label: 'OAuth redirect URI',
        ok: Boolean(this.config.get('TESLA_REDIRECT_URI')),
        detail: this.config.get('TESLA_REDIRECT_URI') ?? 'Missing',
      },
    ];

    return {
      authMode,
      pairingUrl: domain ? `https://tesla.com/_ak/${domain}` : null,
      publicKeyUrl: '/.well-known/appspecific/com.tesla.3p.public-key.pem',
      readyForTeslaOauth:
        authMode === 'tesla' &&
        this.tesla.isConfigured() &&
        hasPublicKey,
      checks,
    };
  }
}
