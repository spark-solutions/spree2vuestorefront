#!/bin/sh
set -e

export SERVER_PORT="${SERVER_PORT:-$PORT}"

./dist/index.js remove-everything
./dist/index.js create-indices

sed -i -e "s|\${CRON_SCHEDULE}|${CRON_SCHEDULE}|gI" "/app/pm2.json"

# Run cron and API server.
yarn run server-cron
