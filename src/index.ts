import { makeClient } from '@spree/storefront-api-v2-sdk'
import Instance from '@spree/storefront-api-v2-sdk/types/Instance'
import { ResultResponse } from '@spree/storefront-api-v2-sdk/types/interfaces/ResultResponse'
import * as program from 'commander'
import { config } from 'dotenv'
import elasticsearch from 'elasticsearch'
import importers from './importers'
import { JsonApiListResponse, JsonApiResponse } from './interfaces'
import server from './server'
import {
  flushElastic,
  logger,
  mapPages,
  pushElasticIndex
} from './utils'

config()

const spreeOptions = {
  host: process.env.SPREE_HOST,
  imagesHost: process.env.SPREE_IMAGES_HOST,
  path: process.env.SPREE_PATH
}

const serverOptions = {
  port: process.env.SERVER_PORT
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

const createIndices = () => {
  getElasticClient().indices.create({
    index: elasticSearchOptions.index
  })
    .then(() => {
      logger.info('Indices created.')
      setMapping()
    })
    .catch(() => {
      logger.error('Error: Cannot create indices!')
    })
}

const setMapping = () => {
  const indexName = elasticSearchOptions.index
  const productMapping = {
    properties: {
      sku: {
        index: 'not_analyzed',
        type: 'string'
      }
    }
  }
  const categoryMapping = {
    properties: {
      url_key: {
        index: 'not_analyzed',
        type: 'string'
      }
    }
  }
  const elasticClient = getElasticClient()

  elasticClient.indices.putMapping({
    body: productMapping,
    index: indexName,
    type: 'product'
  })
    .then(() => {
      logger.info('Product mapping set. Setting category mapping.')
      return elasticClient.indices.putMapping({
        body: categoryMapping,
        index: indexName,
        type: 'category'
      })
    })
    .then(() => {
      logger.info('Category mapping set.')
    })
    .catch(() => {
      logger.error('Error: Cannot set mapping!')
    })
}

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

const getSpreeClient = (): Instance => (
  makeClient({
    host: spreeOptions.host + '/'
  })
)

const preconfigMapPages = (
  makePaginationRequest: (page: number, perPage: number) => Promise<ResultResponse<JsonApiListResponse>>,
  resourceCallback: (response: JsonApiResponse) => any
): Promise<any> =>
  mapPages(makePaginationRequest, resourceCallback, paginationOptions.perPage, paginationOptions.maxPages)

program.command('create-indices')
  .action(() => {
    createIndices()
  })

program.command('remove-everything')
  .action(() => {
    getElasticClient().indices.delete({
      index: elasticSearchOptions.index
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

program.command('api-server')
  .action(() => {
    logger.info('Starting API server')
    server(getSpreeClient(), serverOptions)
  })

program.on('command:*', () => {
  logger.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '))
  process.exit(1)
})

program
  .parse(process.argv)
