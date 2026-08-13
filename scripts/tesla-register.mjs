#!/usr/bin/env node
// One-time Tesla Fleet API partner registration. Must be re-run per region.
//
// Usage: npm run tesla:register
// Reads TESLA_CLIENT_ID, TESLA_CLIENT_SECRET, TESLA_DOMAIN from .env or the shell.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';
const KEY_PATH = '/.well-known/appspecific/com.tesla.3p.public-key.pem';

function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function getPartnerToken({ clientId, clientSecret, audience, scope }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope,
    }),
  });
  const text = await res.text();
  if (!res.ok) fail(`Partner token request failed (${res.status}): ${text}`);
  const { access_token: token } = JSON.parse(text);
  if (!token) fail(`No access_token in token response: ${text}`);
  return token;
}

// Tesla rejects registration when the key is unreachable, so check first.
async function verifyHostedKey(domain) {
  const url = `https://${domain}${KEY_PATH}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    fail(`Could not reach ${url}\n  ${err.message}`);
  }
  if (!res.ok) {
    fail(
      `${url} returned ${res.status}.\n` +
        '  Set TESLA_PUBLIC_KEY_PEM on the api service and redeploy.',
    );
  }

  const hosted = (await res.text()).trim();
  if (!hosted.includes('-----BEGIN PUBLIC KEY-----')) {
    fail(`${url} did not return a PEM public key. Got:\n${hosted.slice(0, 200)}`);
  }

  const localPath = join(ROOT, 'keys', 'public-key.pem');
  if (existsSync(localPath)) {
    const local = readFileSync(localPath, 'utf8').trim();
    if (local !== hosted) {
      console.warn(
        '⚠ Hosted key differs from local keys/public-key.pem.\n' +
          '  Pairing will fail if the deployed key is not the one you hold the private key for.',
      );
    }
  }
  console.log(`✓ Public key reachable at ${url}`);
}

async function register(token, audience, domain) {
  const res = await fetch(`${audience}/api/1/partner_accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domain }),
  });
  const text = await res.text();
  if (!res.ok) fail(`Registration failed (${res.status}): ${text}`);
  console.log(`✓ Registered ${domain}`);
}

async function confirm(token, audience, domain) {
  const url = `${audience}/api/1/partner_accounts/public_key?domain=${encodeURIComponent(domain)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`⚠ Could not confirm registration (${res.status}): ${text}`);
    return;
  }
  console.log(`✓ Tesla has the key on file: ${text}`);
}

async function main() {
  loadEnvFile();

  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;
  const domain = process.env.TESLA_DOMAIN;
  const audience =
    process.env.TESLA_AUDIENCE ?? 'https://fleet-api.prd.na.vn.cloud.tesla.com';
  const scope = process.env.TESLA_PARTNER_SCOPES ?? 'openid vehicle_device_data';

  if (!clientId || !clientSecret) {
    fail('Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET (from developer.tesla.com).');
  }
  if (!domain || domain === 'localhost') {
    fail('Set TESLA_DOMAIN to your public domain, e.g. miletriage.example.com');
  }
  if (domain.includes('://') || domain.includes('/')) {
    fail(`TESLA_DOMAIN must be a bare hostname, not a URL. Got: ${domain}`);
  }

  console.log(`\nRegistering ${domain} with ${audience}\n`);
  await verifyHostedKey(domain);
  const token = await getPartnerToken({ clientId, clientSecret, audience, scope });
  console.log('✓ Got partner token');
  await register(token, audience, domain);
  await confirm(token, audience, domain);

  console.log(
    '\nNext: set AUTH_MODE=tesla, then pair your car at ' +
      `https://tesla.com/_ak/${domain}\n`,
  );
}

await main();
