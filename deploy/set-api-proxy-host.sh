#!/bin/sh
set -eu

: "${API_UPSTREAM:?API_UPSTREAM is required on the web service}"

PORT="${PORT:-80}"
API_PROXY_HOST=$(printf '%s' "${API_UPSTREAM}" | sed -E 's|^[a-zA-Z]+://([^/:]+).*|\1|')
export PORT API_UPSTREAM API_PROXY_HOST

envsubst '${PORT} ${API_UPSTREAM} ${API_PROXY_HOST}' \
  < /etc/miletriage/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
