#!/bin/sh
set -eu

# Derive Host header from API_UPSTREAM so public and private URLs both work.
API_PROXY_HOST=$(printf '%s' "${API_UPSTREAM}" | sed -E 's|^[a-zA-Z]+://([^/:]+).*|\1|')
export API_PROXY_HOST
