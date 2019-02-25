import * as program from 'commander'
import { config } from 'dotenv'
import elasticsearch from 'elasticsearch'
import { makeClient } from 'spree-storefront-api-v2-js-sdk'
import importers from './importers'
import {
  flushElastic,
  logger,
  mapPages,
  pushElasticIndex
} from './utils'

config()

const spreeOptions = {
  host: process.env.S_HOST,
  imagesHost: process.env.S_IMAGES_HOST,
  path: process.env.S_PATH
}

const elasticSearchOptions = {
  bulkSize: +process.env.ES_BULK_SIZE,
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

const getElasticBulkQueue = () => {
  const elasticClient = getElasticClient()
  let pendingOperations = Promise.resolve({ errors: [], operations: [], operationsCount: 0 })
  return {
    flush: () => {
      pendingOperations = flushElastic(
        elasticClient,
        pendingOperations
      )
      return pendingOperations
    },
    pushIndex: (type, document) => {
      pendingOperations = pushElasticIndex(
        elasticClient,
        pendingOperations,
        elasticSearchOptions.bulkSize,
        elasticSearchOptions.index,
        type,
        document
      )
      return pendingOperations
    }
  }
}

const getSpreeClient = () => (
  makeClient({
    host: spreeOptions.host + '/'
  })
)

const preconfigMapPages = (makePaginationRequest, resourceCallback) =>
  mapPages(makePaginationRequest, resourceCallback, paginationOptions.perPage, paginationOptions.maxPages)

program.command('remove-everything')
  .action(() => {
    getElasticClient().indices.delete({
      index: 'vue_storefront_catalog'
    })
  })

program.command('products')
  .action(() => {
    logger.info('Importing products')
    importers.product(getSpreeClient(), getElasticBulkQueue(), preconfigMapPages)
  })

program.command('categories')
  .action(() => {
    logger.info('Importing categories')
    importers.category(getSpreeClient(), getElasticBulkQueue(), preconfigMapPages)
  })

program.command('product [ids...]')
  .action((ids: string[]) => {
    if (ids.length === 0) {
      logger.error('at least one id required')
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

program
  .parse(process.argv)
