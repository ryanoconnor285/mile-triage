/**
 * Turning Nominatim output into the short label a mileage log needs: enough to
 * identify where you went, not a postal address. "123 Main St, Doylestown"
 * beats "123 Main Street, Doylestown, Bucks County, Pennsylvania, 18901, USA".
 */

export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
};

export type NominatimReverse = {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

/** Coordinate placeholders written before a real address was available. */
const COORD_LABEL = /^(?:Start|End|Location)\s*\(-?\d+\.\d+,\s*-?\d+\.\d+\)$/;

/**
 * True when an address is a coordinate placeholder rather than something a
 * person typed or a geocoder returned. Used to find rows worth upgrading
 * without touching hand-entered addresses.
 */
export function isCoordinateLabel(address: string | null): boolean {
  if (!address) return false;
  return COORD_LABEL.test(address.trim());
}

function localityOf(a: NominatimAddress): string | undefined {
  return a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.county;
}

/**
 * Prefers a street address, falls back to a place name, then to the first parts
 * of Nominatim's display_name. Returns null when there is nothing usable.
 */
export function formatAddress(result: NominatimReverse): string | null {
  const address = result.address;

  if (address) {
    // OSM sometimes carries several numbers for one building ("20;28").
    const houseNumber = address.house_number?.split(';')[0]?.trim();
    const street = [houseNumber, address.road].filter(Boolean).join(' ').trim();
    // A business name identifies a destination better than its street number,
    // which is what a mileage log is for. Nominatim returns '' for plain houses,
    // so this only wins where there is a real place.
    const primary =
      result.name?.trim() ||
      street ||
      address.road ||
      address.neighbourhood ||
      address.suburb;
    const locality = localityOf(address);
    // Deduped because a suburb can serve as both primary and locality.
    const label = [...new Set([primary, locality].filter(Boolean))].join(', ');
    if (label) return label;
  }

  const display = result.display_name?.trim();
  if (display) {
    return display.split(',').slice(0, 2).join(',').trim() || null;
  }

  return null;
}
