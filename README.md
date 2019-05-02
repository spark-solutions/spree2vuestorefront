# Spree2VueStorefront

Intermediary layer for importing Spree catalogue and interacting with Spree. Placed between [Spree](http://spreecommerce.org) and [vue-storefront-api](https://github.com/DivanteLtd/vue-storefront-api).

## Quickstart

### Development

Using Docker and Docker Compose:

```sh
docker-compose up -d # mount working directory to docker container
docker exec -ti spark-solutions_spree2vs yarn install # install node_modules
docker exec -ti spark-solutions_spree2vs yarn watch # constantly build ./dist, use "build" to build only once
docker exec -ti spark-solutions_spree2vs ./dist/index.js remove-everything # remove Elastic Search index and start fresh
docker exec -ti spark-solutions_spree2vs ./dist/index.js create-indices # apply mapping to ES records to prevent ambiguity when searching
docker exec -ti spark-solutions_spree2vs ./dist/index.js import:all # import Spree catalog to ES
docker exec -ti spark-solutions_spree2vs yarn server # run the HTTP server on port 8889 (default)
```

### Production

**Important:** Running the Docker image will remove the Elastic Search index used for spree2vs.

Create a .env file based on .env-sample.

Using Docker:

```sh
docker build spark-solutions/spree2vs .
docker run --env-file .env spark-solutions/spree2vs
```

**Note:** When the `SERVER_PORT` env is unavailable, `PORT` is used instead.

The image runs two processes simultaneously:
1. A HTTP server for handling user management (cart, order, etc.). It's restarted automatically on critical errors.
2. Scheduler which regularly imports the Spree catalog.
