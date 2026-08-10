import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly config: ConfigService) {}

  @Get('appspecific/com.tesla.3p.public-key.pem')
  publicKey(@Res() res: Response) {
    const configured = this.config.get<string>('TESLA_PUBLIC_KEY_PATH');
    const candidates = [
      configured,
      join(process.cwd(), 'keys', 'public-key.pem'),
      join(process.cwd(), '..', '..', 'keys', 'public-key.pem'),
    ].filter(Boolean) as string[];

    const path = candidates.find((p) => existsSync(p));
    if (!path) {
      throw new NotFoundException(
        'Tesla public key not found. Generate keys/public-key.pem (see README).',
      );
    }

    res.setHeader('Content-Type', 'application/x-pem-file');
    res.send(readFileSync(path, 'utf8'));
  }
}
