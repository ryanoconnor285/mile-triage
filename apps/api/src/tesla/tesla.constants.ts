/**
 * Token exchanges must go through fleet-auth rather than auth.tesla.com —
 * Tesla applies different rate limits to server-side calls.
 */
export const DEFAULT_TESLA_TOKEN_URL =
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';

export const DEFAULT_TESLA_AUTH_URL =
  'https://auth.tesla.com/oauth2/v3/authorize';

export const DEFAULT_TESLA_API_BASE =
  'https://fleet-api.prd.na.vn.cloud.tesla.com';
