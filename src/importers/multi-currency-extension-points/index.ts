import {
  findIncluded,
  findIncludedOfType
} from '../../utils'

export const getPrice = (_currency: string, _variant, _response) => {
  // return parseFloat(variant.attributes.price)
  // TODO: need to get includes here as getPrice function param
  return 1234

  // const defaultVariant = findIncluded(response, defaultVariantIdentifier.type, defaultVariantIdentifier.id)
}

export const getVariantPrice = getPrice

export const getMasterVariantPrice = getPrice

export const getProductsListIncludes = () => (
  'default_variant,images,option_types,product_properties,variants,variants.option_values,taxons' +
    ',default_variant.prices,variants.prices'
)

// TODO: ensure prices for variants get imported properly too (that Spree returns them via APIv2)