#!/bin/sh
set -e

export SERVER_PORT="${SERVER_PORT:-$PORT}"

sed -i -e "s|\${CRON_SCHEDULE}|${CRON_SCHEDULE}|gI" "/app/pm2.json"

# Run cron and API server.
yarn run server-cron
