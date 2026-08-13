import type { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PEM_HEADER = '-----BEGIN PUBLIC KEY-----';

/**
 * Hosts that only accept single-line env vars (Railway, Fly) force \n escapes,
 * and Tesla rejects a PEM that is not newline-delimited.
 */
function normalizePem(raw: string): string {
  const pem = raw.trim().replace(/\\n/g, '\n');
  return pem.endsWith('\n') ? pem : `${pem}\n`;
}

/**
 * Prefers TESLA_PUBLIC_KEY_PEM so deployments without a mounted volume can
 * still serve /.well-known, falling back to keys/public-key.pem locally.
 */
export function resolveTeslaPublicKey(config: ConfigService): string | null {
  const inline = config.get<string>('TESLA_PUBLIC_KEY_PEM');
  if (inline?.includes(PEM_HEADER)) {
    return normalizePem(inline);
  }

  const candidates = [
    config.get<string>('TESLA_PUBLIC_KEY_PATH'),
    join(process.cwd(), 'keys', 'public-key.pem'),
    join(process.cwd(), '..', '..', 'keys', 'public-key.pem'),
  ].filter(Boolean) as string[];

  const path = candidates.find((p) => existsSync(p));
  return path ? normalizePem(readFileSync(path, 'utf8')) : null;
}
