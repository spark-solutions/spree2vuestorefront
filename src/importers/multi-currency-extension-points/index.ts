import { findIncludedOfType } from '../../utils'
import { JsonApiResponse, JsonApiDocument } from '../../interfaces'

export const getPrice = (currency, variant, response) => {
  // const relationships = variant.relationships.prices
  // const defaultVariantIdentifier = relationships.default_variant.data
  const variantPrices = findIncludedOfType(response, variant, 'prices')
  variantPrices.find((variantPrice) => variantPrice.attributes.currency === currency)
  console.log('aaaaaa', variantPrices, currency)
  // return parseFloat(variant.attributes.price)
  // TODO: need to get includes here as getPrice function param
  return 1234

}

export const getVariantPrice = getPrice

export const getMasterVariantPrice = getPrice

export const getProductsListIncludes = () => (
  'default_variant,images,option_types,product_properties,variants,variants.option_values,taxons' +
    ',default_variant.prices,variants.prices'
)

// TODO: ensure prices for variants get imported properly too (that Spree returns them via APIv2)