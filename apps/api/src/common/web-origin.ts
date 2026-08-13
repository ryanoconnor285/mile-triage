const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';

/** Strip whitespace/quotes Railway users often paste into env vars. */
export function webOriginFromEnv(value: string | undefined): string {
  const normalized = (value ?? DEFAULT_WEB_ORIGIN)
    .trim()
    .replace(/^["']|["']$/g, '');
  return normalized || DEFAULT_WEB_ORIGIN;
}
