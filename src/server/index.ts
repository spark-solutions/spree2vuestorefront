import cors from 'cors'
import * as express from 'express'
import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import { IOrderResult } from 'spree-storefront-api-v2-js-sdk/src/interfaces/Order'
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
        if (spreeResponse.isSuccess()) {
          logger.info('New token for guest user fetched.')
          const spreeToken = spreeResponse.success().data.attributes.token
          response.json({
            code: 200,
            result: spreeToken
          })
        } else {
          logger.error(['Could not create a new cart.', spreeResponse.fail()])
          response.json({
            code: 500,
            result: null
          })
        }
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
      .then((spreeResponse) => {
        if (spreeResponse.isSuccess()) {
          logger.info('Cart fetched')

          const successResponse = spreeResponse.success()
          const lineItems = findIncludedOfType(successResponse, successResponse.data, 'line_items')
          const result = lineItems.map((lineItem) => {
            return getLineItem(successResponse, lineItem, cartId)
          })
          response.json({
            code: 200,
            result
          })
        } else {
          logger.error([`Could not get Spree cart for cartId = ${cartId}.`, spreeResponse.fail()])
          response.json({
            code: 500,
            result: null
          })
        }
      })
  })

  app.get('/api/cart/payment-methods', (request, response) => {
    logger.info('Fetching payment methods')

    spreeClient.checkout.paymentMethods(getTokenOptions(request))
      .then((spreeResponse) => {
        if (spreeResponse.isSuccess()) {
          const paymentMethods = spreeResponse.success().data.map((paymentMethod) => {
            return {
              code: paymentMethod.id,
              title: paymentMethod.attributes.name
            }
          })

          response.json({
            code: 200,
            result: paymentMethods
          })
        } else {
          logger.error(['Cannot get payment methods.', spreeResponse.fail()])
          response.statusCode = 500
          response.json({
            code: 500,
            result: null
          })
        }
      })
  })

  app.post('/api/cart/update', (request, response) => {
    enum CartOperationType { Add, Update }

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

    let cartUpdateRequest: Promise<IOrderResult>

    if (operationType === CartOperationType.Add) {
      logger.info(`Finding variant with sku = ${variantSku}`)
      cartUpdateRequest = variantFromSku(spreeClient, variantSku)
        .then((spreeResponse: JsonApiSingleResponse) => {
          logger.info(`Variant with sku = ${variantSku} found.`)
          const variant = spreeResponse.data
          logger.info(`Adding qty = ${quantity} to variant.id = ${variant.id}`)
          return spreeClient.cart.addItem(
            getTokenOptions(request),
            {
              include: spreeResponseIncludes,
              quantity,
              variant_id: variant.id
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
      .then((spreeResponse) => {
        if (spreeResponse.isSuccess()) {
          const order = spreeResponse.success()
          logger.info(`Line item for variant sku = ${variantSku} added to cart.`)
          const cart = order.data
          const lineItems = findIncludedOfType(order, cart, 'line_items')
          const addedLineItem = lineItems.find((lineItem) => {
            const { id, type } = lineItem.relationships.variant.data
            const variant = findIncluded(order, type, id)
            return variant.attributes.sku === variantSku
          })
          const convertedLineItem = getLineItem(order, addedLineItem, cartId)
          response.json({
            code: 200,
            result: convertedLineItem
          })
        } else {
          logger.error(['Error adding new item to cart', spreeResponse.fail()])
          response.statusCode = 500
          response.json({
            code: 500,
            result: null
          })
        }
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
      .then((spreeResponse) => {
        if (spreeResponse.isSuccess()) {
          logger.info(`Removed item for variant sku = ${variantSku} from cart.`)
          response.json({
            code: 200,
            result: true
          })
        } else {
          logger.error([`Error when removing item from cart.`, spreeResponse.fail()])
          response.statusCode = 500
          response.json({
            code: 500,
            result: null
          })
        }
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
