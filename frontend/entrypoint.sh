#!/bin/sh
set -e

# Generate htpasswd from env vars
htpasswd -bc /etc/nginx/.htpasswd "${BASIC_AUTH_USER}" "${BASIC_AUTH_PASS}"

# Substitute BACKEND_URL into nginx config template
envsubst '${BACKEND_URL} ${INTERNAL_TOKEN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
