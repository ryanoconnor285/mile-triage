#!/bin/sh
set -eu

PORT="${PORT:-80}"
API_UPSTREAM="${API_UPSTREAM:-http://api:3001}"
export PORT API_UPSTREAM

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
