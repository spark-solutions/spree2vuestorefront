import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import { findIncluded, findIncludedOfType, mapPages, logger } from '.'
import { JsonApiDocument, JsonApiSingleResponse, JsonApiResponse, ESProductType } from '../interfaces'

// productCustomAttributesPrefix is used as extra prefix to reduce the possibility of naming collisions with product
// options and standard product fields.
const productCustomAttributesPrefix = 'prodattr_'
const productOptionAttributePrefix = 'prodopt_'

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
    productOption.extension_attributes = { configurable_item_options: configurableItemOptions }
  }

  return {
    item_id: lineItem.id,
    name: lineItem.attributes.name,
    price: lineItem.attributes.price,
    product_type: productVariants.length === 0 ? ESProductType.Simple : ESProductType.Configurable,
    qty: lineItem.attributes.quantity,
    quote_id: cartId,
    sku: variant.attributes.sku,
    ...productOption
  }
}

// FIXME: will be replaced with dedicated APIv2 endpoint
const variantFromSku = (spreeClient: Instance, sku: string): Promise<JsonApiSingleResponse> => {
  return new Promise((resolve, reject) => {
    mapPages(
      (page: number, perPage: number): any => {
        return spreeClient.products.list({
          params: {
            include: 'default_variant,variants',
            page,
            per_page: perPage
          }
        })
      },
      (response: JsonApiSingleResponse) => {
        const product: JsonApiDocument = response.data
        const relationships = product.relationships
        const defaultVariantIdentifier = relationships.default_variant.data
        const defaultVariant = findIncluded(response, defaultVariantIdentifier.type, defaultVariantIdentifier.id)
        const allVariants = [defaultVariant, ...findIncludedOfType(response, product, 'variants')]
        const skuV = allVariants.find((v) => {
          return sku === v.attributes.sku
        })
        if (skuV) {
          resolve({
            data: skuV,
            included: response.included
          })
        }
      },
      100000,
      100000
    )
      .then(() => {
        reject(new Error('Cannot find sku = ' + sku))
      })
      .catch((error) => {
        console.error(error)
        reject(error)
      })
  })
}

export {
  findOptionTypeFromOptionValue,
  generateOptionAttributeCode,
  generateCustomAttributeCode,
  getLineItem,
  variantFromSku
}
