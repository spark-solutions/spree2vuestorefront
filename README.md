# Spree2VueStorefront

Intermediary layer for importing Spree catalogue and interacting with Spree. Placed between [Spree](http://spreecommerce.org) and [vue-storefront-api](https://github.com/DivanteLtd/vue-storefront-api).

-------------------

# Instructions For Using Spree2VS During Development Using Docker

## Ports used

- 8889

## Daily Development

1. Run `./docker-bin/start.sh`. This starts the Docker container but does not run any server or process. It's up to the developer to decide which scripts to run. Logs can be accessed with `docker-compose logs -f`.
1. Run the following commands:
  1. `./docker-bin/spree2vs.sh yarn install` installs npm modules.
  1. `./docker-bin/spree2vs.sh yarn watch` starts a Webpack server which continuously rebuilds the project from source files.
  1. `./docker-bin/spree2vs.sh ./dist/index.js remove-everything` (or `./docker-bin/spree2vs.sh node ./dist/index.js  remove-everything` in case of "permission denied" error) clears catalog in Elastic Search.
  1. `./docker-bin/spree2vs.sh ./dist/index.js create-indices` (or `./docker-bin/spree2vs.sh node ./dist/index.js create-indices` in case of "permission denied" error) adds type mappings to ES columns.
  1. `./docker-bin/spree2vs.sh yarn import:all` (or `./docker-bin/spree2vs.sh node ./dist/index.js products` then `./docker-bin/spree2vs.sh node ./dist/index.js categories` in case of "permission denied" error) imports products, attributes and categories from Spree to the ES catalog. In production mode, this script runs as a cron job in intervals.
  1. `./docker-bin/spree2vs.sh yarn server` starts a Node server which allows cart, order and account management in Spree when using Vue Storefront.
1. Make changes in files.
1. Run `./docker-bin/stop.sh`.

 ## All Available Docker Development Scripts

`./docker-bin/start.sh` - Starts the development environment. Joins a Docker network called `spree_vue_storefront_shared_development_network`. `yarn server`, when running, is available at `localhost:8889`. `./docker-bin/spree2vs.sh` - Runs any interactive command inside the Spree Docker container. Examples:

- `./docker-bin/spree.sh yarn install` installs npm modules.
- `./docker-bin/spree.sh /bin/bash` will open an interactive shell inside the Docker Spree container.

`./docker-bin/stop.sh` - Stops all servers but doesn't remove them. This script can be used to free up system resources for a time. Run `./docker-bin/start.sh` later to unpause the servers.

`./docker-bin/remove.sh` - Stops all servers and removes them.

# Production

**Important:** Running the project in Docker without using Docker Compose will remove the Elastic Search index used for spree2vs. To override this behavior, run the Docker image with a different CMD than the default.

Create a .env file based on .env.sample.

Using Docker:

```sh
docker build spark-solutions/spree2vs .
docker run --env-file .env spark-solutions/spree2vs
```

**Note:** When the `SERVER_PORT` env is unavailable, `PORT` is used instead.

The production image runs two processes simultaneously:
1. A HTTP server for handling user management (cart, order, etc.). It's restarted automatically on critical errors.
2. Scheduler which regularly imports the Spree catalog.