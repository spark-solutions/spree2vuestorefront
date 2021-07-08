import { getStoresConfiguration, getDefaultStoreIdentifier } from '../../utils/configuration'
import { logger, getTokenOptions } from '../../utils'
import {
  NoDefaultStoreIdentifierError,
  NoDefaultStoreError,
  NoStoresError,
  BadStoreIdentifierError,
  CurrencyUpdateError
} from '../../utils/errors'
import { StoreCodeRequest } from '../../interfaces'
import { MultiCurrencySpreeClient } from '../../utils/MultiCurrencySpreeClient'

export const storeCode = (request, _response, next) => {
  logger.info('Retrieving store information based on storeCode in request (if available).')

  const requestStoreCode = request.query.storeCode
  const storesConfiguration = getStoresConfiguration()

  if (!requestStoreCode) {
    logger.info('No storeCode param provided, using default store.')

    if (storesConfiguration.length === 0) {
      logger.info('No multi store configuration provided.')

      request.storeConfiguration = null
      request.multiStore = false
      next()
      return
    }

    const defaultStoreIdentifier = getDefaultStoreIdentifier()

    if (!defaultStoreIdentifier) {
      logger.error('No default store identifier configured.')

      next(new NoDefaultStoreIdentifierError(`Default store identifier required when using multi store.`))
      return
    }

    const storeConfiguration = storesConfiguration.find(
      (storeConfiguration) => storeConfiguration.identifier === defaultStoreIdentifier
    )

    if (!storeConfiguration) {
      logger.error('No default store identifier configuration provided.')

      next(new NoDefaultStoreError('Default store identifier required when using multi store.'))
      return
    }

    request.storeConfiguration = storeConfiguration
    request.multiStore = true
    next()
    return
  }

  logger.info('storeCode param provided, searching for associated currency.')

  if (storesConfiguration.length === 0) {
    logger.error('No multi store configuration provided.')

    next(new NoStoresError('No multi store configuration.'))
    return
  }

  const storeConfiguration = storesConfiguration.find(
    (storeConfiguration) => storeConfiguration.identifier === requestStoreCode
  )

  if (!storeConfiguration) {
    logger.error(`storeCode ${requestStoreCode} not recognized.`)

    next(new BadStoreIdentifierError(`storeCode ${requestStoreCode} not recognized.`))
    return
  }

  request.storeConfiguration = storeConfiguration
  request.multiStore = true
  next()
}

export const createEnsureStore =
  (spreeClient: MultiCurrencySpreeClient) => (request: StoreCodeRequest, _response, next) => {
    logger.info('Updating order currency if needed based on storeCode in request.')

    if (!request.multiStore) {
      logger.info('Not multi store. Skipping store currency checks.')
      next()
      return
    }

    logger.info(
      `Multi store request. Comparing currency in request store ${request.storeConfiguration.identifier} with currency in order.`
    )

    const token = getTokenOptions(request)

    spreeClient.cart.show(token).then((spreeCartShowResponse) => {
      if (spreeCartShowResponse.isSuccess()) {
        logger.info('Cart fetched.')

        const successResponse = spreeCartShowResponse.success()
        const cartCurrency = successResponse.data.attributes.currency
        const cartNumber = successResponse.data.attributes.number

        logger.info(`Cart number is ${cartNumber} and current currency is ${cartCurrency}.`)

        if (request.storeConfiguration.spreeCurrency === cartCurrency) {
          logger.info('Cart currency same as orderCode currency. Not updating cart currency.')
          next()
          return
        }

        logger.info('Cart currency different than orderCode currency. Updating cart currency.')

        spreeClient.currency
          .update(token, { currency: request.storeConfiguration.spreeCurrency })
          .then((spreeCurrencyUpdateResponse) => {
            if (spreeCurrencyUpdateResponse.isSuccess()) {
              logger.info(`Currency updated for cart number ${cartNumber}.`)

              next()
              return
            }

            logger.error([
              `Couldn't update currency for cart number ${cartNumber}.`,
              spreeCurrencyUpdateResponse.fail()
            ])

            next(new CurrencyUpdateError(`Couldn't update currency for cart number ${cartNumber}.`))
          })
        return
      }

      logger.info([`Cannot retrieve cart for token ${JSON.stringify(token)}.`, spreeCartShowResponse.fail()])
      next(new CurrencyUpdateError(`Couldn't update currency for cart.`))
    })
  }
