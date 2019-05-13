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
  elasticBulkDelete,
  flushElastic,
  logger,
  mapPages,
  pushElasticIndex,
  pushElasticUpdate
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
      logger.info('Indices created. Mapping fields.')
      return setMapping()
    })
    .catch((error) => {
      logger.error(['Error: Cannot create indices or set mapping.', error])
    })
}

const setMapping = () => {
  const indexName = elasticSearchOptions.index
  const productMapping = {
    properties: {
      sku: {
        type: 'keyword'
      }
    }
  }
  const categoryMapping = {
    properties: {
      url_key: {
        type: 'keyword'
      }
    }
  }
  const elasticClient = getElasticClient()

  return elasticClient.indices.putMapping({
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
}

const getElasticBulkOperations = () => {
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
    },
    pushUpdate: (type, documentPatch) => {
      pendingOperations = pushElasticUpdate(
        elasticClient,
        pendingOperations,
        elasticSearchOptions.bulkSize,
        elasticSearchOptions.index,
        type,
        documentPatch
      )
    },
    elasticBulkDelete: (type, currentCursor) => {
      return elasticBulkDelete(elasticClient, elasticSearchOptions.index, type, currentCursor)
    }
  }
}

const getSpreeClient = (): Instance => (
  makeClient({
    host: spreeOptions.host
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
    logger.info('Removing index')
    getElasticClient().indices.delete({
      index: elasticSearchOptions.index
    })
      .then(() => {
        logger.info('Index removed')
      })
      .catch((error) => {
        logger.error(['Error: Cannot create indices!', error])
      })
  })

program.command('products')
  .option(
    '-d, --date [date]',
    'Only replace products updated_at since this date (all products receive a new \'cursor\' anyway).'
  )
  .action((command) => {
    logger.info('Importing products and removing unused')
    let updatedSinceDate: Date | null
    let cursor: string
    if (command.date) {
      updatedSinceDate = new Date(command.date)
      cursor = updatedSinceDate.getTime().toString()
      logger.info(
        `Replacing products with updated_at date greater than ${updatedSinceDate} (--date "${command.date}")` +
        ` and setting cursor to ${cursor}.`
      )
      logger.warn(
        'The --date param is an optimization.' +
        ' Make sure to provide a --date appropriate to the current Elastic Search state.' +
        ' Avoid using too recent --date. If unsure when Elastic Search was updated last time - skip this param.'
      )
    } else {
      updatedSinceDate = null
      cursor = new Date().getTime().toString()
      logger.info(`No date provided. Updating all products and setting cursor to ${cursor}.`)
    }
    importers.product(getSpreeClient(), getElasticBulkOperations(), preconfigMapPages, cursor, updatedSinceDate)
      .catch(() => {
        process.exit(1)
      })
  })

program.command('categories')
  .option(
    '-d, --date [date]',
    'Only replace categories updated_at since this date (all categories receive a new \'cursor\' anyway).'
  )
  .action((command) => {
    logger.info('Importing categories')
    let updatedSinceDate: Date | null
    let cursor: string
    if (command.date) {
      updatedSinceDate = new Date(command.date)
      cursor = updatedSinceDate.getTime().toString()
      logger.info(
        `Replacing categories with updated_at date greater than ${updatedSinceDate} (--date "${command.date}")` +
        ` and setting cursor to ${cursor}.`
      )
      logger.warn(
        'The --date param is an optimization.' +
        ' Make sure to provide a --date appropriate to the current Elastic Search state.' +
        ' Avoid using too recent --date. If unsure when Elastic Search was updated last time - skip this param.'
      )
    } else {
      updatedSinceDate = null
      cursor = new Date().getTime().toString()
      logger.info(`No date provided. Updating all categories and setting cursor to ${cursor}.`)
    }

    importers.category(getSpreeClient(), getElasticBulkOperations(), preconfigMapPages, cursor, updatedSinceDate)
      .catch(() => {
        process.exit(1)
      })
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
