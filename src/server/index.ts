import { errors, result } from '@spree/storefront-api-v2-sdk'
import { SpreeSDKError } from '@spree/storefront-api-v2-sdk/types/errors'
import { NestedAttributes } from '@spree/storefront-api-v2-sdk/types/interfaces/endpoints/CheckoutClass'
import { JsonApiResponse } from '@spree/storefront-api-v2-sdk/types/interfaces/JsonApi'
import { IOrder, IOrderResult } from '@spree/storefront-api-v2-sdk/types/interfaces/Order'
import { RelationType } from '@spree/storefront-api-v2-sdk/types/interfaces/Relationships'
import { Result as ResultType } from '@spree/storefront-api-v2-sdk/types/interfaces/Result'
import { ResultResponse } from '@spree/storefront-api-v2-sdk/types/interfaces/ResultResponse'
import { IShippingMethodsResult } from '@spree/storefront-api-v2-sdk/types/interfaces/ShippingMethod'
import { IToken } from '@spree/storefront-api-v2-sdk/types/interfaces/Token'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import { JsonApiSingleResponse, ShippingMethodsDescription, StoreConfiguration, StoreCodeRequest } from '../interfaces'
import { findIncluded, findIncludedOfType, getLineItem, getTokenOptions, logger, variantFromSku } from '../utils'
import { MultiCurrencySpreeClient } from '../utils/MultiCurrencySpreeClient'
import { storeCode, createEnsureStore } from './middlewares/multiStore'

export default (spreeClient: MultiCurrencySpreeClient, serverOptions: any) => {
  type MaybePromiseResult = Promise<ResultResponse<JsonApiResponse>> | ResultResponse<JsonApiResponse>

  class ShippingMethodMissingError extends Error {}

  const getTotals = (tokenOptions, cartId): Promise<ResultType<any, any>> => {
    const extraParams = {
      include: [
        'line_items',
        'line_items.variant',
        'line_items.variant.product',
        'line_items.variant.product.option_types'
      ].join(',')
    }

    return spreeClient.cart.show(tokenOptions, extraParams).then((spreeResponse) => {
      if (spreeResponse.isSuccess()) {
        const successResponse: any = spreeResponse.success()
        const resultAttr: any = successResponse.data.attributes
        const lineItems = findIncludedOfType(successResponse, successResponse.data, 'line_items')
        const items = lineItems.map((lineItem) => {
          return getLineItem(successResponse, lineItem, cartId)
        })

        const totalSegments = [
          {
            code: 'subtotal',
            title: 'Subtotal',
            value: resultAttr.item_total
          },
          {
            code: 'shipping',
            title: 'Shipping',
            value: resultAttr.ship_total
          },
          {
            code: 'grand_total',
            title: 'Grand Total',
            value: resultAttr.total
          }
        ]

        if (parseFloat(resultAttr.promo_total) !== 0) {
          totalSegments.push({ code: 'discount', title: 'Discount', value: resultAttr.promo_total })
        }

        if (parseFloat(resultAttr.tax_total) !== 0 && parseFloat(resultAttr.included_tax_total) === 0) {
          totalSegments.push({ code: 'tax', title: 'Tax', value: resultAttr.tax_total })
        } else if (parseFloat(resultAttr.included_tax_total) !== 0) {
          totalSegments.push({ code: 'tax', title: 'Included Tax', value: resultAttr.included_tax_total })
        }

        const resultValue = {
          coupon_code: parseFloat(resultAttr.promo_total) !== 0 ? '42' : '',
          discount_amount: resultAttr.promo_total,
          grand_total: resultAttr.total,
          items_qty: resultAttr.items_qty,
          shipping_amount: resultAttr.ship_total,
          subtotal: resultAttr.item_total,
          tax_amount: resultAttr.tax_total,
          total_segments: totalSegments,
          items
        }
        return result.makeSuccess(resultValue)
      } else {
        return spreeResponse
      }
    })
  }

  const generateStorefrontShippingMethods = (shippingRates: any[]) => {
    // TODO: Rename Spree SDK's EstimatedShippingMethodAttr to ShippingMethod. It's used in shipping rates and estimated
    // shipping rates endpoints.
    const shippingMethods = shippingRates.map((shippingRate) => {
      return {
        carrier_code: shippingRate.attributes.shipping_method_id.toString(),
        amount: +shippingRate.attributes.final_price,
        method_code: shippingRate.attributes.shipping_method_id.toString(),
        method_title: shippingRate.attributes.name
      }
    })

    return shippingMethods
  }

  /**
   * Create a Spree order update payload from order payload submitted by VS. Ignores shipping method from VS, because it
   * cannot be easily converted to Spree order shipments update.
   */
  const adaptOrder = (order): NestedAttributes => {
    const {
      billingAddress,
      shippingAddress,
      payment_method_code: paymentMethodCode,
      payment_method_additional: paymentMethodAdditional
    } = order.addressInformation
    let orderInformation: NestedAttributes = {}

    if (paymentMethodCode) {
      // TODO: Create a generic mechanism for extending payments.

      orderInformation = {
        ...orderInformation,
        order: {
          payments_attributes: [
            {
              payment_method_id: paymentMethodCode
            }
          ]
        }
      }

      switch (paymentMethodAdditional.storefront_payment_method_type) {
        case 'spree/spree_gateway':
          // Recognize use of Spree Gateway (https://github.com/spree/spree_gateway).
          orderInformation = {
            ...orderInformation,
            payment_source: {
              [paymentMethodCode]: {
                name: `${billingAddress.firstname} ${billingAddress.lastname}`,
                ...paymentMethodAdditional
              }
            }
          }
          break
        case 'spree-contrib/spree_braintree_vzero':
          // Recognize use of Braintree v.zero (https://github.com/spree-contrib/spree_braintree_vzero).
          orderInformation = {
            ...orderInformation,
            order: {
              ...orderInformation.order,
              payments_attributes: [
                {
                  ...orderInformation.order.payments_attributes[0],
                  ...paymentMethodAdditional
                }
              ]
            }
          } as NestedAttributes
          break
      }
    }

    if (shippingAddress) {
      orderInformation = {
        ...orderInformation,
        order: {
          ...orderInformation.order,
          email: shippingAddress.email,
          ship_address_attributes: {
            firstname: shippingAddress.firstname,
            lastname: shippingAddress.lastname,
            address1: shippingAddress.street[0],
            address2: shippingAddress.street[1],
            city: shippingAddress.city,
            zipcode: shippingAddress.postcode,
            state_name: shippingAddress.region,
            country_iso: shippingAddress.country_id,
            phone: shippingAddress.telephone
          }
        }
      }
    }

    if (billingAddress) {
      orderInformation = {
        ...orderInformation,
        order: {
          ...orderInformation.order,
          bill_address_attributes: {
            firstname: billingAddress.firstname,
            lastname: billingAddress.lastname,
            address1: billingAddress.street[0],
            address2: billingAddress.street[1],
            city: billingAddress.city,
            zipcode: billingAddress.postcode,
            state_name: billingAddress.region,
            country_iso: billingAddress.country_id,
            phone: billingAddress.telephone
          }
        }
      }
    }
    return orderInformation
  }

  const spreeErrorToString = (error: SpreeSDKError): string => {
    // TODO: Provide nicer names for fields and nicer string format
    if (error instanceof errors.BasicSpreeError) {
      return error.summary
    }
    return error.message
  }

  // TODO: Consider clearing resolved promises in lastShippingMethods.
  const lastShippingMethods: ShippingMethodsDescription[] = []

  /**
   * Limits the number of calls to spreeClient.checkout.shippingMethods to mitigate duplicated shipments. Spree doesn't
   * clear old shipments when shipping_rates endpoint is called rapidly for same order.
   */
  const adjustLastShippingMethodsCallForOrder = (
    token: IToken,
    shippingMethodsCallGenerator: () => Promise<IShippingMethodsResult>
  ): Promise<any> => {
    const lastDescription = lastShippingMethods.find((shippingMethodDescription) => {
      const { orderToken } = shippingMethodDescription
      return orderToken === token.orderToken
    })

    if (lastDescription) {
      logger.info(`Order with order token id = ${token.orderToken} already has shipping methods calls waiting.`)
      const updatedShippingMethodsDeferred = lastDescription.deferred
        .then(shippingMethodsCallGenerator)
        .catch(shippingMethodsCallGenerator)
      lastDescription.deferred = updatedShippingMethodsDeferred
      return updatedShippingMethodsDeferred
    }

    logger.info(`Order with order token id = ${token.orderToken} has no shipping methods calls waiting.`)

    const shippingMethodsDeferred = shippingMethodsCallGenerator()

    const newShippingMethodsCallDescription = {
      orderToken: token.orderToken,
      deferred: shippingMethodsDeferred
    }

    lastShippingMethods.push(newShippingMethodsCallDescription)

    return shippingMethodsDeferred
  }

  const updateShippingMethod = (token: IToken, shippingRateId: string) => {
    return adjustLastShippingMethodsCallForOrder(token, () => {
      return spreeClient.checkout.shippingMethods(token, { include: 'shipping_rates' })
    }).then((shippingResponse): MaybePromiseResult => {
      if (shippingResponse.isSuccess()) {
        logger.info(`Shipping rates fetched for order with order token = ${token.orderToken}.`)
        const shipments = shippingResponse.success().data
        if (shipments.length > 0) {
          logger.info('At least one shipment choice available for order.')
          logger.info(`Searching for shipment with shipping method id = ${shippingRateId}.`)
          const pickedShipment = shipments[0]
          const shippingRates = pickedShipment.relationships.shipping_rates.data as RelationType[]
          const shippingRate = shippingRates.find((element) => {
            return (
              shippingRateId ===
              findIncluded(
                shippingResponse.success(),
                element.type,
                element.id
              ).attributes.shipping_method_id.toString()
            )
          })
          if (typeof shippingRate !== 'undefined') {
            logger.info(`Found match for chosen shipping method with id = ${shippingRateId} in Spree.`)
            const shippingOrderInformation = {
              order: {
                shipments_attributes: [
                  {
                    id: pickedShipment.id,
                    selected_shipping_rate_id: shippingRate.id
                  }
                ]
              }
            }
            logger.info('Updating shipping method for order in Spree.')
            return spreeClient.checkout.orderUpdate(token, shippingOrderInformation)
          } else {
            logger.info(`Shipping method with id = ${shippingRateId} not found for order token ${token.orderToken}.`)
          }
        } else {
          logger.info('No shipment choices available for order.')
        }
        return result.makeFail(new ShippingMethodMissingError('Estimated shipping method is not available.'))
      } else {
        logger.error(['Shipping rates could not be fetched.', shippingResponse.fail()])
        return shippingResponse
      }
    })
  }

  const app = express()

  app.use(cors())
  app.use(bodyParser.json())
  app.use(storeCode)

  const ensureStore = createEnsureStore(spreeClient)

  app.post('/api/cart/create', (request: StoreCodeRequest, response) => {
    logger.info('Fetching new cart token for guest user.')

    let createCartRequest

    if (request.multiStore) {
      const storeConfiguration: StoreConfiguration = request.storeConfiguration

      createCartRequest = spreeClient.currency.createCartWithCurrency(undefined, {
        currency: storeConfiguration.spreeCurrency
      })
    } else {
      createCartRequest = spreeClient.cart.create()
    }

    createCartRequest.then((spreeResponse) => {
      if (spreeResponse.isSuccess()) {
        logger.info('New token for guest user fetched.')

        const spreeToken = spreeResponse.success().data.attributes.token
        response.json({
          code: 200,
          result: spreeToken
        })
      } else {
        logger.error(['Could not create a new cart.', spreeResponse.fail()])

        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      }
    })
  })

  app.get('/api/cart/pull', ensureStore, (request, response) => {
    //TODO: add ensureStore to more places
    logger.info('Fetching cart')
    const cartId = `${request.query.cartId}`

    const extraParams = {
      include: [
        'line_items',
        'line_items.variant',
        'line_items.variant.product',
        'line_items.variant.product.option_types'
      ].join(',')
    }

    spreeClient.cart.show(getTokenOptions(request), extraParams).then((spreeResponse) => {
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

    spreeClient.checkout.paymentMethods(getTokenOptions(request)).then((spreeResponse) => {
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
    enum CartOperationType {
      Add,
      Update
    }

    const cartId = `${request.query.cartId}`
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
      cartUpdateRequest = variantFromSku(spreeClient, variantSku).then((spreeResponse: JsonApiSingleResponse) => {
        logger.info(`Variant with sku = ${variantSku} found.`)
        const variant = spreeResponse.data
        logger.info(`Adding qty = ${quantity} to variant.id = ${variant.id}`)
        return spreeClient.cart.addItem(getTokenOptions(request), {
          include: spreeResponseIncludes,
          quantity,
          variant_id: variant.id
        })
      })
    } else if (operationType === CartOperationType.Update) {
      logger.info(`Updating line item quantity for lineItemId = ${lineItemId}`)
      cartUpdateRequest = spreeClient.cart.setQuantity(getTokenOptions(request), {
        include: spreeResponseIncludes,
        line_item_id: lineItemId,
        quantity
      })
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

    spreeClient.cart.removeItem(getTokenOptions(request), lineItemId).then((spreeResponse) => {
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

  app.post('/api/cart/apply-coupon', (request, response) => {
    const coupon = `${request.query.coupon}`

    spreeClient.cart.applyCouponCode(getTokenOptions(request), { coupon_code: coupon }).then((spreeResponse) => {
      if (spreeResponse.isSuccess()) {
        logger.info(`Add coupon code = ${coupon}.`)
        response.json({
          code: 200,
          result: true
        })
      } else {
        logger.error([`Could not add coupon code.`, spreeResponse.fail()])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      }
    })
  })

  app.post('/api/cart/delete-coupon', (request, response) => {
    spreeClient.cart.removeCouponCode(getTokenOptions(request)).then((spreeResponse) => {
      if (spreeResponse.isSuccess()) {
        logger.info(`Remove coupon code.`)

        response.json({
          code: 200,
          result: true
        })
      } else {
        logger.error([`Error removing coupon code.`, spreeResponse.fail()])
        response.statusCode = 500
        response.json({
          code: 500,
          result: null
        })
      }
    })
  })

  app.post('/api/cart/shipping-methods', (request, response) => {
    logger.info('Fetching shipping methods.')
    const orderToken = getTokenOptions(request)
    adjustLastShippingMethodsCallForOrder(orderToken, () => {
      return spreeClient.checkout.shippingMethods(orderToken)
    }).then((shippingMethodsResult: IShippingMethodsResult) => {
      let handled = false
      if (shippingMethodsResult.isSuccess()) {
        const shippingMethodsResponse = shippingMethodsResult.success()
        if (shippingMethodsResponse.data.length > 0) {
          // TODO: Support multiple shipments.
          const shipmentShippingMethods = findIncludedOfType(
            shippingMethodsResponse,
            shippingMethodsResponse.data[0],
            'shipping_rates'
          )
          const shippingMethods = generateStorefrontShippingMethods(shipmentShippingMethods)
          response.json({
            code: 200,
            result: shippingMethods
          })
          handled = true
        }
      }

      if (!handled) {
        logger.info('Shipments not available yet. Serving dummy shipping methods.')
        const dummyShippingMethods = [
          {
            amount: 0,
            carrier_code: '-42',
            method_code: '-42',
            method_title: 'Dummy to prevent front-end error'
          }
        ]
        response.json({
          code: 200,
          result: dummyShippingMethods
        })
      }
    })
  })

  app.post('/api/cart/shipping-information', (request, response) => {
    logger.info('Fetching shipping information.')
    const cartId = request.query.cartId
    const orderToken = getTokenOptions(request)
    const selectedShippingRateId = request.body.addressInformation.shippingMethodCode
    logger.info(`Updating shipping method.`)

    updateShippingMethod(orderToken, selectedShippingRateId)
      .then((shippingResponse) => {
        // If a shipping method doesn't exist, still provide totals, but don't update shipping method in checkout. This
        // is to prevent errors before user fills shipping address (VS calls shipping-information earlier as well).
        if (shippingResponse.isSuccess() || shippingResponse.fail() instanceof ShippingMethodMissingError) {
          logger.info('Order shipping method updated or update skipped due to issues. Fetching totals.')
          return getTotals(orderToken, cartId)
        }
        return shippingResponse
      })
      .then((totalsResponse) => {
        if (totalsResponse.isSuccess()) {
          logger.info('Totals fetched.')
          response.json({
            code: 200,
            result: { totals: totalsResponse.success() }
          })
        } else {
          logger.error([`Could not get shipping information for cartId = ${cartId}.`, totalsResponse.fail()])
          response.json({
            code: 500,
            result: null
          })
        }
      })
  })

  app.get('/api/cart/totals', (request, response) => {
    logger.info('Fetching totals.')

    const cartId = request.query.cartId

    getTotals(getTokenOptions(request), cartId).then((spreeResponse) => {
      if (spreeResponse.isSuccess()) {
        response.json({
          code: 200,
          result: spreeResponse.success()
        })
      } else {
        logger.error([`Could not get totals for cartId = ${cartId}.`, spreeResponse.fail()])
        response.json({
          code: 500,
          result: null
        })
      }
    })
  })

  app.get('/api/stock/check', (request, response) => {
    const sku = `${request.query.sku}`

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

  app.post('/api/order', (request, response) => {
    // /api/order requests provide cart_id inside the body instead of the query string.
    const orderToken = { orderToken: request.body.cart_id }

    const orderInformation = adaptOrder(request.body)

    spreeClient.checkout
      .orderUpdate(orderToken, orderInformation)
      .then((orderAddressResponse): MaybePromiseResult => {
        if (orderAddressResponse.isSuccess()) {
          logger.info('Order addresses updated.')

          const selectedShipingRateId = request.body.addressInformation.shipping_method_code
          return updateShippingMethod(orderToken, selectedShipingRateId)
        }

        logger.error(['Order addresses could not be updated.', orderAddressResponse.fail()])

        return orderAddressResponse
      })
      .then((orderShippingResponse): MaybePromiseResult => {
        if (orderShippingResponse.isSuccess()) {
          logger.info('Order shipping rate updated.')

          return spreeClient.checkout.complete(orderToken)
        }

        logger.error(['Order shipping rate could not be updated.', orderShippingResponse.fail()])

        return orderShippingResponse
      })
      .then((completeResponse) => {
        if (completeResponse.isSuccess()) {
          logger.info('Order completed.')

          const successResponse = completeResponse.success() as IOrder
          response.json({
            code: 200,
            result: {
              backendOrderId: successResponse.data.attributes.number,
              transferedAt: successResponse.data.attributes.updated_at
            }
          })
        } else {
          logger.error(['Order could not be completed.', completeResponse.fail()])

          response.statusCode = 500
          response.json({
            code: 500,
            result: spreeErrorToString(completeResponse.fail())
          })
        }
      })
      .catch((error) => {
        logger.error(['Something went wrong.', error])
      })
  })

  app.post('/api/update-order', (request, response) => {
    const orderToken = { orderToken: request.body.cart_id }
    const orderInformation = adaptOrder(request.body)

    spreeClient.checkout.orderUpdate(orderToken, orderInformation).then((updateResponse) => {
      if (updateResponse.isSuccess()) {
        logger.info('Order updated.')
        const successResponse = updateResponse.success()
        response.json({
          code: 200,
          result: {
            backendOrderId: successResponse.data.attributes.number,
            transferedAt: successResponse.data.attributes.updated_at
          }
        })
      } else {
        logger.error(['Order could not be updated.', updateResponse.fail()])
        response.statusCode = 500
        response.json({
          code: 500,
          result: spreeErrorToString(updateResponse.fail())
        })
      }
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
