const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export function normalizeAddress(text: string | null | undefined): string {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

/** Any pipe-separated keyword appears in the normalized address. */
export function keywordsMatch(
  address: string | null | undefined,
  keywords: string | null | undefined,
): boolean {
  if (!keywords?.trim()) return false;
  const hay = normalizeAddress(address);
  if (!hay.trim()) return false;
  return keywords
    .split('|')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => hay.includes(k));
}

export type RouteAnchor = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  radiusMiles: number;
  startKeywords: string | null;
  endKeywords: string | null;
};

export type DriveEndpoints = {
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  startAddress: string | null;
  endAddress: string | null;
};

export function matchRouteScore(
  route: RouteAnchor,
  drive: DriveEndpoints,
): number | null {
  const hasCoords =
    drive.startLat != null &&
    drive.startLng != null &&
    drive.endLat != null &&
    drive.endLng != null;

  if (hasCoords) {
    const forward =
      haversineMiles(
        drive.startLat!,
        drive.startLng!,
        route.startLat,
        route.startLng,
      ) <= route.radiusMiles &&
      haversineMiles(
        drive.endLat!,
        drive.endLng!,
        route.endLat,
        route.endLng,
      ) <= route.radiusMiles;
    if (forward) {
      const d1 = haversineMiles(
        drive.startLat!,
        drive.startLng!,
        route.startLat,
        route.startLng,
      );
      const d2 = haversineMiles(
        drive.endLat!,
        drive.endLng!,
        route.endLat,
        route.endLng,
      );
      return 1 / (1 + d1 + d2);
    }

    const reverse =
      haversineMiles(
        drive.startLat!,
        drive.startLng!,
        route.endLat,
        route.endLng,
      ) <= route.radiusMiles &&
      haversineMiles(
        drive.endLat!,
        drive.endLng!,
        route.startLat,
        route.startLng,
      ) <= route.radiusMiles;
    if (reverse) {
      const d1 = haversineMiles(
        drive.startLat!,
        drive.startLng!,
        route.endLat,
        route.endLng,
      );
      const d2 = haversineMiles(
        drive.endLat!,
        drive.endLng!,
        route.startLat,
        route.startLng,
      );
      return 1 / (1 + d1 + d2);
    }
  }

  const kwForward =
    keywordsMatch(drive.startAddress, route.startKeywords) &&
    keywordsMatch(drive.endAddress, route.endKeywords);
  if (kwForward) return 0.5;

  const kwReverse =
    keywordsMatch(drive.startAddress, route.endKeywords) &&
    keywordsMatch(drive.endAddress, route.startKeywords);
  if (kwReverse) return 0.5;

  return null;
}

/** Derive pipe-separated keywords from a street address for route storage. */
export function keywordsFromAddress(address: string | null | undefined): string {
  const norm = normalizeAddress(address);
  const tokens = norm.split(/\s+/).filter((t) => t.length > 3);
  return tokens.slice(0, 3).join('|');
}
