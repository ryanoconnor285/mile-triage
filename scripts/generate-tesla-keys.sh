#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="$ROOT/keys"
mkdir -p "$KEY_DIR"

if [[ -f "$KEY_DIR/private-key.pem" ]]; then
  echo "keys/private-key.pem already exists — refusing to overwrite"
  exit 1
fi

openssl ecparam -name prime256v1 -genkey -noout -out "$KEY_DIR/private-key.pem"
openssl ec -in "$KEY_DIR/private-key.pem" -pubout -out "$KEY_DIR/public-key.pem"

echo "Wrote:"
echo "  $KEY_DIR/private-key.pem  (keep secret)"
echo "  $KEY_DIR/public-key.pem   (serve at /.well-known/appspecific/com.tesla.3p.public-key.pem)"
