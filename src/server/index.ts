import cors from 'cors'
import * as express from 'express'
import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import { JsonApiSingleResponse } from '../interfaces'
import {
  findIncluded,
  findIncludedOfType,
  getLineItem,
  getTokenOptions,
  logger,
  variantFromSku
} from '../utils'

export default (spreeClient: Instance, serverOptions: any) => {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.post('/api/cart/create', (_, response) => {
    logger.info('Fetching new cart token for guest user.')
    spreeClient.cart.create()
      .then((spreeResponse) => {
        logger.info('New token for guest user fetched.')
        const spreeToken = spreeResponse.data.attributes.token

        response.json({
          code: 200,
          result: spreeToken
        })
      })
      .catch((error) => {
        logger.error(['Cannot get new cart token for guest user.', error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  app.get('/api/cart/pull', (request, response) => {
    logger.info('Fetching cart')
    const cartId = request.query.cartId

    const extraParams = {
      include: [
        'line_items',
        'line_items.variant',
        'line_items.variant.product',
        'line_items.variant.product.option_types'
      ].join(',')
    }

    spreeClient.cart.show(getTokenOptions(request), extraParams)
      .then((spreeResponse: JsonApiSingleResponse) => {
        logger.info('Cart fetched')
        logger.info(spreeResponse)

        const lineItems = findIncludedOfType(spreeResponse, spreeResponse.data, 'line_items')
        const result = lineItems.map((lineItem) => {
          return getLineItem(spreeResponse, lineItem, cartId)
        })

        response.json({
          code: 200,
          result
        })
      })
      .catch((error) => {
        logger.error(['Cannot get cart.', error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  app.get('/api/cart/payment-methods', (request, response) => {
    logger.info('Fetching payment methods')

    spreeClient.checkout.paymentMethods(getTokenOptions(request))
      .then((spreeResponse) => {
        const paymentMethods = spreeResponse.data.map((paymentMethod) => {
          return {
            code: paymentMethod.id,
            title: paymentMethod.attributes.name
          }
        })

        response.json({
          code: 200,
          result: paymentMethods
        })
      })
      .catch((error) => {
        logger.error(['Cannot get payment methods.', error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  enum CartOperationType { Add, Update }

  app.post('/api/cart/update', (request, response) => {
    const cartId = request.query.cartId
    logger.info(`Updating cart for cartId = ${cartId}`)

    const { sku: variantSku, qty: quantity, item_id: lineItemId } = request.body.cartItem
    const operationType = lineItemId ? CartOperationType.Update : CartOperationType.Add

    const spreeResponseIncludes = [
      'line_items',
      'line_items.variant',
      'line_items.variant.product',
      'line_items.variant.product.option_types'
    ].join(',')

    let cartUpdateRequest

    if (operationType === CartOperationType.Add) {
      logger.info(`Finding variant with sku = ${variantSku}`)
      cartUpdateRequest = variantFromSku(spreeClient, variantSku)
        .then((spreeResponse: JsonApiSingleResponse) => {
          logger.info(`Variant with sku = ${variantSku} found.`)
          // TODO: do I have to react to configurable_item_options in cart/update payload??
          const variant = spreeResponse.data
          logger.info(`Adding qty = ${quantity} to variant.id = ${variant.id}`)
          return spreeClient.cart.addItem(
            getTokenOptions(request),
            {
              include: spreeResponseIncludes,
              quantity,
              variant_id: +variant.id
            }
          )
        })
    } else if (operationType === CartOperationType.Update) {
      logger.info(`Updating line item quantity for lineItemId = ${lineItemId}`)
      cartUpdateRequest = spreeClient.cart.setQuantity(
        getTokenOptions(request),
        {
          include: spreeResponseIncludes,
          line_item_id: lineItemId,
          quantity
        }
      )
    }

    cartUpdateRequest
      .then((spreeResponse: JsonApiSingleResponse) => {
        logger.info(`Line item for variant sku = ${variantSku} added to cart.`)
        const cart = spreeResponse.data
        const lineItems = findIncludedOfType(spreeResponse, cart, 'line_items')
        const addedLineItem = lineItems.find((lineItem) => {
          const { id, type } = lineItem.relationships.variant.data
          const variant = findIncluded(spreeResponse, type, id)
          return variant.attributes.sku === variantSku
        })
        const convertedLineItem = getLineItem(spreeResponse, addedLineItem, cartId)
        response.json({
          code: 200,
          result: convertedLineItem
        })
      })
      .catch((error) => {
        logger.error(['Error adding new item to cart', error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  app.post('/api/cart/delete', (request, response) => {
    const { sku: variantSku, item_id: lineItemId } = request.body.cartItem

    spreeClient.cart.removeItem(getTokenOptions(request), lineItemId)
      .then(() => {
        logger.info(`Remove item for variant sku = ${variantSku} from cart.`)

        response.json({
          code: 200,
          result: true
        })
      })
      .catch((error) => {
        logger.error([`Error removing item from cart.`, error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  app.get('/api/stock/check', (request, response) => {
    const sku = request.query.sku

    variantFromSku(spreeClient, sku)
      .then((spreeResponse: JsonApiSingleResponse) => {
        logger.info(`Variant with sku = ${sku} found.`)
        const variant = spreeResponse.data
        response.json({
          code: 200,
          result: {
            is_in_stock: variant.attributes.in_stock,
            product_id: variant.id // Used only for logging purposes in VS?
          }
        })
      })
      .catch((error) => {
        logger.error([`Error fetching stock for sku = ${sku}`, error])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      })
  })

  app.all('*', (request, response) => {
    logger.info(`Request for ${request.path} could not be handled`)
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json')
    response.json({
      code: 500
    })
  })

  app.listen(serverOptions.port, () => {
    logger.info(`API listening on port ${serverOptions.port}`)
  })
}
