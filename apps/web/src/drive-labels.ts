type EndpointDrive = {
  startAddress?: string | null;
  endAddress?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  source?: string;
};

function formatEndpoint(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  fallback: string,
): string {
  const text = address?.trim();
  if (text) return text;
  if (lat != null && lng != null) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return fallback;
}

export function formatDriveRoute(d: EndpointDrive): string {
  const start = formatEndpoint(d.startAddress, d.startLat, d.startLng, 'Start');
  const end = formatEndpoint(d.endAddress, d.endLat, d.endLng, 'End');
  return `${start} → ${end}`;
}

/** True when a car-recorded drive has neither addresses nor coordinates yet. */
export function driveMissingLocation(d: EndpointDrive): boolean {
  if (d.source !== 'POLLED') return false;
  const hasStart =
    Boolean(d.startAddress?.trim()) ||
    (d.startLat != null && d.startLng != null);
  const hasEnd =
    Boolean(d.endAddress?.trim()) || (d.endLat != null && d.endLng != null);
  return !hasStart && !hasEnd;
}
