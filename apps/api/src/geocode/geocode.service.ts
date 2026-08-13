import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { formatAddress, type NominatimReverse } from './address-format';

const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Nominatim's usage policy: at most one request per second, a User-Agent that
 * identifies the app, and cache the results. All three are honoured here. At
 * real volume the answer is to self-host Nominatim or move to a paid geocoder,
 * which is why the base URL is configurable.
 */
const MIN_REQUEST_GAP_MS = 1_100;
const REQUEST_TIMEOUT_MS = 8_000;

/** ~11 m. Fine enough to tell neighbours apart, coarse enough to cache well. */
const COORD_PRECISION = 4;

function round(value: number): number {
  return Number(value.toFixed(COORD_PRECISION));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  /** Serialises outbound requests so the rate limit holds under concurrency. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  enabled(): boolean {
    return this.config.get('GEOCODE_ENABLED') !== 'false';
  }

  /**
   * Coordinates to a short human label, or null when unavailable. Cached
   * permanently: a road name is not going to change under a parked car.
   */
  async reverse(lat: number, lng: number): Promise<string | null> {
    if (!this.enabled()) return null;

    const key = { lat: round(lat), lng: round(lng) };
    const cached = await this.prisma.geocodeCache.findUnique({
      where: { lat_lng: key },
    });
    if (cached) return cached.label;

    const label = await this.fetchLabel(key.lat, key.lng);
    if (!label) return null;

    // Two drives can resolve the same spot concurrently; the unique index makes
    // the loser a no-op rather than an error.
    await this.prisma.geocodeCache.upsert({
      where: { lat_lng: key },
      create: { ...key, label },
      update: {},
    });
    return label;
  }

  private async fetchLabel(lat: number, lng: number): Promise<string | null> {
    const base = (
      this.config.get<string>('NOMINATIM_URL') ?? DEFAULT_NOMINATIM_URL
    ).replace(/\/+$/, '');
    // zoom=18 resolves to building level rather than the whole neighbourhood.
    const url =
      `${base}/reverse?format=jsonv2&zoom=18&addressdetails=1` +
      `&lat=${lat}&lon=${lng}`;

    return this.schedule(async () => {
      try {
        const res = await fetch(url, {
          headers: {
            // Nominatim rejects or throttles anonymous traffic.
            'User-Agent': 'MileTriage/1.0 (+https://miletriage.com)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) {
          this.logger.warn(
            `Reverse geocode failed (${res.status}) for ${lat},${lng}`,
          );
          return null;
        }
        const json = (await res.json()) as NominatimReverse;
        return formatAddress(json);
      } catch (err) {
        this.logger.warn(
          `Reverse geocode errored for ${lat},${lng}: ${String(err)}`,
        );
        return null;
      }
    });
  }

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = MIN_REQUEST_GAP_MS - (Date.now() - this.lastRequestAt);
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      return task();
    });
    // Keep the chain alive regardless of individual failures.
    this.queue = run.catch(() => undefined);
    return run;
  }
}
