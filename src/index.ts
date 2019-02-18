require('dotenv').config()
const program = require('commander')
import elasticsearch from 'elasticsearch'
import { Client } from 'spree-storefront-api-v2-js-sdk'
import importers from './importers'
import { logger, mapPages } from './utils'

const spreeOptions = {
  host: process.env.S_HOST,
  imagesHost: process.env.S_IMAGES_HOST,
  path: process.env.S_PATH
}

const elasticSearchOptions = {
  host: process.env.ES_HOST,
  index: process.env.ES_INDEX,
  logLevel: process.env.ES_LOG_LEVEL,
  requestTimeout: process.env.ES_REQUEST_TIMEOUT
}

const paginationOptions = {
  maxPages: +process.env.MAX_PAGES,
  perPage: +process.env.PER_PAGE
}

const getElasticClient = () => (
  elasticsearch.Client({
    host: elasticSearchOptions.host,
    log: elasticSearchOptions.logLevel
  })
)

const getSpreeClient = () => (
  Client({
    host: spreeOptions.host + '/'
  })
)

const preconfigMapPages = () => {
  return (makePaginationRequest, resourceCallback) =>
    mapPages(makePaginationRequest, resourceCallback, paginationOptions.perPage, paginationOptions.maxPages)
}

program.command('remove-everything')
  .action(() => {
    getElasticClient().indices.delete({
      index: 'vue_storefront_catalog'
    })
  })

program.command('products')
  .action(() => {
    logger.info('Importing products')
    importers.product(getSpreeClient(), getElasticClient(), elasticSearchOptions, preconfigMapPages())
  })

program.command('categories')
  .action(() => {
    logger.info('Importing categories')
    importers.category(getSpreeClient(), getElasticClient(), elasticSearchOptions, preconfigMapPages())
  })

program.command('product [ids...]')
  .action((ids: string[]) => {
    if (ids.length === 0) {
      logger.error('at least one id requied')
      process.exit(1)
    }
    getElasticClient().search({
      body: {
        query: {
          terms: {
            id: ids
          }
        }
      },
      index: 'vue_storefront_catalog',
      type: 'product'
    })
      .then((products: any) => {
        logger.info(products.hits.hits)
      })
  })

program.on('command:*', () => {
  logger.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '))
  process.exit(1)
})

// TODO: program.command('attributes')
// TODO: program.command('categories')

program
  .parse(process.argv)
