import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { resolveTeslaPublicKey } from './public-key';

@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly config: ConfigService) {}

  @Get('appspecific/com.tesla.3p.public-key.pem')
  publicKey(@Res() res: Response) {
    const pem = resolveTeslaPublicKey(this.config);
    if (!pem) {
      throw new NotFoundException(
        'Tesla public key not found. Set TESLA_PUBLIC_KEY_PEM or provide keys/public-key.pem (see README).',
      );
    }

    res.setHeader('Content-Type', 'application/x-pem-file');
    res.send(pem);
  }
}
