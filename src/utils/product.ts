import Instance from '@spree/storefront-api-v2-sdk/types/Instance'
import { IProducts } from '@spree/storefront-api-v2-sdk/types/interfaces/Product'
import { findIncluded, findIncludedOfType } from '.'
import { ESProductType, JsonApiDocument, JsonApiResponse, JsonApiSingleResponse } from '../interfaces'

// productCustomAttributesPrefix is used as extra prefix to reduce the possibility of naming collisions with product
// options and standard product fields.
const productOptionAttributePrefix = ''
const productCustomAttributesPrefix = 'prodattr_'

const generateOptionAttributeCode = (attributeIdentifier) => `${productOptionAttributePrefix}${attributeIdentifier}`
const generateCustomAttributeCode = (attributeIdentifier) => `${productCustomAttributesPrefix}${attributeIdentifier}`

const findOptionTypeFromOptionValue = (optionTypes: any[], optionValueId): any | null => {
  return optionTypes.find((optionType) => {
    const optionValues = optionType.relationships.option_values.data
    return !!optionValues.find((optionValue: { id: string }) => {
      return optionValue.id === optionValueId
    })
  }) || null
}

const getLineItem = (response: JsonApiResponse, lineItem: JsonApiDocument, cartId: string) => {
  // TODO: roundabout way of figuring out if product has variants. find better?
  const variantIdentifier = lineItem.relationships.variant.data
  const variant = findIncluded(response, variantIdentifier.type, variantIdentifier.id)
  const productIdentifier = variant.relationships.product.data
  const product = findIncluded(response, productIdentifier.type, productIdentifier.id)
  const optionTypes = findIncludedOfType(response, product, 'option_types')
  const productVariants = findIncludedOfType(response, product, 'variants')

  const productOption: any = {}
  if (productVariants.length > 0) {// TODO: also check if there are options
    const configurableItemOptions = variant.relationships.option_values.data.map((ov) => {
        const optionType = findOptionTypeFromOptionValue(optionTypes, ov.id)

        return {
          option_id: generateOptionAttributeCode(optionType.id),
          option_value: ov.id
        }
    })
    // TODO: productOption.extension_attributes can probably be removed when setConfigurableProductOptions: false in VS
    // config. Try to remove.
    productOption.extension_attributes = { configurable_item_options: configurableItemOptions }
  }

  return {
    item_id: lineItem.id,
    name: lineItem.attributes.name,
    price: lineItem.attributes.price,
    price_incl_tax: lineItem.attributes.price, // not used in /cart/pull
    discount_amount: Math.abs(lineItem.attributes.promo_total), // not used in /cart/pull
    row_total: lineItem.attributes.price, // not used in /cart/pull
    row_total_incl_tax: lineItem.attributes.price, // not used in /cart/pull
    product_type: productVariants.length === 0 ? ESProductType.Simple : ESProductType.Configurable,
    qty: lineItem.attributes.quantity,
    quote_id: cartId,
    sku: variant.attributes.sku,
    ...productOption
  }
}

const variantFromSku = (spreeClient: Instance, sku: string): Promise<JsonApiSingleResponse | null> => {
  return spreeClient.products.list({
    filter: {
      skus: sku
    },
    include: 'default_variant,variants',
    page: 1,
    per_page: 1
  })
    .then((response) => {
      if (response.isSuccess()) {
        const products: IProducts = response.success()
        if (products.data.length === 0) {
          throw Error(`Cannot find product with sku = ${sku}`)
        }
        const variant = products.included.find((resource) => {
          return resource.type === 'variant' && resource.attributes.sku === sku
        })
        return {
          data: variant,
          included: products.included
        }
      } else {
        throw response.fail()
      }
    })
}

export {
  findOptionTypeFromOptionValue,
  generateOptionAttributeCode,
  generateCustomAttributeCode,
  getLineItem,
  variantFromSku
}
