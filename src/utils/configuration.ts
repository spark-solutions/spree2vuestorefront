import { StoreConfiguration, ElasticSearchOptions } from '../interfaces'

export const spreeOptions = {
  url: process.env.SPREE_URL,
  imagesHost: process.env.SPREE_IMAGES_HOST,
  path: process.env.SPREE_PATH
}

export const serverOptions = {
  port: process.env.SERVER_PORT
}

export const paginationOptions = () => ({
  maxPages: parseInt(process.env.MAX_PAGES),
  perPage: parseInt(process.env.PER_PAGE)
})

export const getStoresConfiguration = (): StoreConfiguration[] => {
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

export const getDefaultStoreIdentifier = (): string | null => {
  return process.env['STORES_DEFAULT'] || null
}

export const getGenericElasticSearchConfiguration = (): ElasticSearchOptions => {
  return {
    bulkSize: parseInt(process.env.ES_BULK_SIZE),
    url: process.env.ES_URL,
    index: process.env.ES_INDEX,
    logLevel: process.env.ES_LOG_LEVEL,
    requestTimeout: parseInt(process.env.ES_REQUEST_TIMEOUT)
  }
}

export const getSingleElasticSearchConfiguration = getGenericElasticSearchConfiguration

export const getFullElasticSearchConfigForStore = (
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
