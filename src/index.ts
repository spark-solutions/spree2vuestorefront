import { makeClient } from '@spree/storefront-api-v2-sdk'
import Client from '@spree/storefront-api-v2-sdk/types/Client'
import { ResultResponse } from '@spree/storefront-api-v2-sdk/types/interfaces/ResultResponse'
import * as program from 'commander'
import { config } from 'dotenv'
import elasticsearch from 'elasticsearch'
import { partial, _ } from 'lodash'
import importers from './importers'
import * as singleCurrencyExtensionPoints from './importers/single-currency-extension-points'
import * as multiCurrencyExtensionPoints from './importers/multi-currency-extension-points'
import { JsonApiListResponse, JsonApiResponse, ElasticClient, ElasticSearchOptions, StoreConfiguration } from './interfaces'
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
  url: process.env.SPREE_URL,
  imagesHost: process.env.SPREE_IMAGES_HOST,
  path: process.env.SPREE_PATH
}

const serverOptions = {
  port: process.env.SERVER_PORT
}













// const elasticSearchOptions: ElasticSearchOptions = {
//   bulkSize: +process.env.ES_BULK_SIZE,
//   url: process.env.ES_URL,
//   index: process.env.ES_INDEX,
//   logLevel: process.env.ES_LOG_LEVEL,
//   requestTimeout: +process.env.ES_REQUEST_TIMEOUT
// }

const getStoresConfiguration = (): StoreConfiguration[] => {
  const storesEnv = process.env.STORES

  if (!storesEnv) {
    return []
  }

  const storeIdentifiers = storesEnv.split(',')

  const parsedStores = storeIdentifiers.map((identifier) => {
    return {
      identifier,
      elasticIndex: process.env[`ES_INDEX_${identifier.toUpperCase()}`],
      spreeCurrency: process.env[`SPREE_CURRENCY_${identifier.toUpperCase()}`]
    }
  })

  return parsedStores
}

const getGenericElasticSearchConfiguration = (): ElasticSearchOptions => {
  return {
    bulkSize: +process.env.ES_BULK_SIZE,
    url: process.env.ES_URL,
    index: process.env.ES_INDEX,
    logLevel: process.env.ES_LOG_LEVEL,
    requestTimeout: +process.env.ES_REQUEST_TIMEOUT
  }
}

const getSingleElasticSearchConfiguration = getGenericElasticSearchConfiguration

const getFullElasticSearchConfigForStore = (
  storesConfigurations: StoreConfiguration[],
  storeIdentifier: string
): ElasticSearchOptions => {
  const storeConfiguration = storesConfigurations.find((storeConfiguration) => {
    return storeConfiguration.identifier === storeIdentifier
  })

  const elasticSearchSharedConfiguration = getGenericElasticSearchConfiguration()

  return {
    ...elasticSearchSharedConfiguration,
    index: storeConfiguration.elasticIndex
  }
}















const paginationOptions = {
  maxPages: +process.env.MAX_PAGES,
  perPage: +process.env.PER_PAGE
}

const getElasticClient = (storeElasticConfiguration: ElasticSearchOptions): ElasticClient => (
  elasticsearch.Client({
    host: storeElasticConfiguration.url,
    log: storeElasticConfiguration.logLevel
  })
)

const createIndex = (storeElasticConfiguration: ElasticSearchOptions) => {
  const settings = {
    analysis: {
      analyzer: {
        ngram_analyzer: {
          tokenizer: 'ngram_tokenizer',
          filter: 'lowercase'
        }
      },
      tokenizer: {
        ngram_tokenizer: {
          type: 'ngram',
          min_gram: 2,
          max_gram: 8,
          token_chars: [
            'letter', 'digit'
          ]
        }
      }
    }
  }
  const mappings = {
    product: {
      properties: {
        sku: {
          type: 'keyword'
        },
        size: {
          type: 'keyword'
        },
        color: {
          type: 'keyword'
        },
        name: {
          type: 'text',
          index: 'analyzed',
          analyzer: 'ngram_analyzer'
        }
      }
    },
    category: {
      properties: {
        url_key: {
          type: 'keyword'
        }
      }
    }
  }

  logger.info('Creating index.')

  return getElasticClient(storeElasticConfiguration).indices.create({
    index: storeElasticConfiguration.index,
    body: {
      settings,
      mappings
    }
  })
}

const getElasticBulkOperations = (elasticClient: ElasticClient, elasticSearchOptions: ElasticSearchOptions) => {
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

const getSpreeClient = (): Client => (
  makeClient({
    host: spreeOptions.url
  })
)

const preconfigMapPages = (
  makePaginationRequest: (page: number, perPage: number) => Promise<ResultResponse<JsonApiListResponse>>,
  resourceCallback: (response: JsonApiResponse) => any
): Promise<any> =>
  mapPages(makePaginationRequest, resourceCallback, paginationOptions.perPage, paginationOptions.maxPages)


























program.command('remove-everything')
  .action(() => {
    const storesConfigurations = getStoresConfiguration()
    
    if (storesConfigurations.length > 0) {
      logger.info('Removing indices.')

      storesConfigurations.reduce((accumulated, currentStoreConfiguration) => {
        const storeIdentifier = currentStoreConfiguration.identifier

        const storeElasticConfiguration = getFullElasticSearchConfigForStore(
          storesConfigurations,
          storeIdentifier
        )
        
        return accumulated.then(() => {
          const index = storeElasticConfiguration.index

          return getElasticClient(storeElasticConfiguration).indices.delete({ index })
            .then(() => {
              logger.info(`Index ${index} removed.`)
            })
            .catch((error) => {
              logger.error(['Error: Cannot remove index!', error])
            })
        })
      }, Promise.resolve())
    } else {
      logger.info('Removing index.')

      const singleElasticSearchConfiguration = getSingleElasticSearchConfiguration()
      const index = singleElasticSearchConfiguration.index

      getElasticClient(singleElasticSearchConfiguration).indices.delete({ index })
        .then(() => {
          logger.info(`Index ${index} removed.`)
        })
        .catch((error) => {
          logger.error(['Error: Cannot remove index!', error])
        })
      }
  })

program.command('create-indices')
  .action(() => {
    const storesConfigurations = getStoresConfiguration()

    if (storesConfigurations.length > 0) {
      logger.info('Creating indices.')

      storesConfigurations.reduce((accumulated, currentStoreConfiguration) => {
        const storeIdentifier = currentStoreConfiguration.identifier

        const storeElasticConfiguration = getFullElasticSearchConfigForStore(
          storesConfigurations,
          storeIdentifier
        )

        return accumulated.then(() => {
          return createIndex(storeElasticConfiguration)
            .then(() => {
              logger.info(`Index ${storeElasticConfiguration.index} created.`)
            })
            .catch((error) => {
              logger.error(['Error: Cannot create indices or set proper settings and mapping.', error])
            })
        })
      }, Promise.resolve())
    } else {
      logger.info('Creating index.') 

      const singleElasticSearchConfiguration = getSingleElasticSearchConfiguration()

      createIndex(singleElasticSearchConfiguration)
        .then(() => {
          logger.info('Index created.')
        })
        .catch((error) => {
          logger.error(['Error: Cannot create indices or set proper settings and mapping.', error])
        })
    }
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

    const importProducts = partial(
      importers.product,
      getSpreeClient(),
      _,
      preconfigMapPages,
      cursor,
      updatedSinceDate,
      _,
      _,
      _
    )

    const storesConfigurations = getStoresConfiguration()

    if (storesConfigurations.length > 0) {
      logger.info('Importing products from multiple stores.')

      const {
        getVariantPrice,
        getMasterVariantPrice,
        getProductsListIncludes
      } = multiCurrencyExtensionPoints

      const importStoreProducts = partial(
        importProducts,
        _,
        _,
        _,
        getProductsListIncludes
      )
  
      storesConfigurations.reduce((accumulated, currentStoreConfiguration) => {
        const storeIdentifier = currentStoreConfiguration.identifier

        logger.info(`Importing store with identifier = ${storeIdentifier}. Full store configuration is ${JSON.stringify(currentStoreConfiguration)}.`)
  
        const storeElasticConfiguration = getFullElasticSearchConfigForStore(
          storesConfigurations,
          storeIdentifier
        )
        logger.info(`Elastic Search configuration for store is ${JSON.stringify(storeElasticConfiguration)}.`)

        const storeCurrency = currentStoreConfiguration.spreeCurrency

        logger.info(`Currency for store is ${storeCurrency}.`)
  
        return accumulated.then(() => {
          return importStoreProducts(
            getElasticBulkOperations(
              getElasticClient(storeElasticConfiguration),
              storeElasticConfiguration
            ),
            partial(getVariantPrice, storeCurrency, _, _),
            partial(getMasterVariantPrice, storeCurrency, _, _),
          ).then(() => {
            logger.info(`Products for store ${storeIdentifier} imported.`)
          })
        })
      }, Promise.resolve())
        .then(() => {
          logger.info('All products for all stores imported.')
        })
        .catch(() => {
          process.exit(1)
        })
    } else {
      logger.info('Importing products for a single store configuration.')

      const singleElasticSearchConfiguration = getSingleElasticSearchConfiguration()

      logger.info(`Elastic Search configuration for store is ${JSON.stringify(singleElasticSearchConfiguration)}.`)

      const {
        getVariantPrice,
        getMasterVariantPrice,
        getProductsListIncludes
      } = singleCurrencyExtensionPoints

      const importSingleProducts = importProducts(
        getElasticBulkOperations(
          getElasticClient(singleElasticSearchConfiguration),
          singleElasticSearchConfiguration
        ),
        getVariantPrice,
        getMasterVariantPrice,
        getProductsListIncludes
      )

      importSingleProducts
        .then(() => {
          logger.info('All products for store imported.')
        })
        .catch(() => {
          process.exit(1)
        })
    }
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

    const storesConfigurations = getStoresConfiguration()

    const importCategories = partial(
      importers.category,
      getSpreeClient(),
      _,
      preconfigMapPages,
      cursor,
      updatedSinceDate
    )

    if (storesConfigurations.length > 0) {
      logger.info('Importing categories from multiple stores.')

      storesConfigurations.reduce((accumulated, currentStoreConfiguration) => {
        const storeIdentifier = currentStoreConfiguration.identifier

        logger.info(`Importing store with identifier = ${storeIdentifier}. Full store configuration is ${JSON.stringify(currentStoreConfiguration)}.`)

        const storeElasticConfiguration = getFullElasticSearchConfigForStore(
          storesConfigurations,
          storeIdentifier
        )
        logger.info(`Elastic Search configuration for store is ${JSON.stringify(storeElasticConfiguration)}.`)

        const storeCurrency = currentStoreConfiguration.spreeCurrency

        logger.info(`Currency for store is ${storeCurrency}.`)

        return accumulated.then(() => {
          return importCategories(
            getElasticBulkOperations(
              getElasticClient(storeElasticConfiguration),
              storeElasticConfiguration
            )
          ).then(() => {
            logger.info(`Categories for store ${storeIdentifier} imported.`)
          })
        })
      }, Promise.resolve())
      .then(() => {
        logger.info('All categories for all stores imported.')
      })
      .catch(() => {
        process.exit(1)
      })
    } else {
      logger.info('Importing categories for a single store configuration.')

      const singleElasticSearchConfiguration = getSingleElasticSearchConfiguration()

      logger.info(`Elastic Search configuration for store is ${JSON.stringify(singleElasticSearchConfiguration)}.`)

      const importSingleCategories = importCategories(
        getElasticBulkOperations(
          getElasticClient(singleElasticSearchConfiguration),
          singleElasticSearchConfiguration
        )
      )

      importSingleCategories
        .then(() => {
          logger.info('All categories for store imported.')
        })
        .catch(() => {
          process.exit(1)
        })
    }
  })

// program.command('product [ids...]')
//   .action((ids: string[]) => {
//     if (ids.length === 0) {
//       logger.error('at least one id required')
//       process.exit(1)
//     }
//     getElasticClient().search({
//       body: {
//         query: {
//           terms: {
//             id: ids
//           }
//         }
//       },
//       index: 'vue_storefront_catalog',
//       type: 'product'
//     })
//       .then((products: any) => {
//         logger.info(products.hits.hits)
//       })
//   })

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
