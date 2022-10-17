import { findIncludedOfType, logger } from '../../utils'

export const getPrice = (currency, variant, response) => {
  const variantPrices = findIncludedOfType(response, variant, 'prices')
  const price = variantPrices.find((variantPrice) => variantPrice.attributes.currency === currency)

  if (price) {
    return parseFloat(price.attributes.amount)
  } else {
    logger.warn(
      `No price in currency ${currency} found for variant with id ${variant.id}. Using fallback price for currency - ${Number.MAX_SAFE_INTEGER}.`
    )

    return Number.MAX_SAFE_INTEGER
  }
}

export const getVariantPrice = getPrice

export const getMasterVariantPrice = getPrice

export const getProductsListIncludes = () =>
  'default_variant,images,option_types,product_properties,variants,variants.option_values,taxons' +
  ',default_variant.prices,variants.prices'

// TODO: ensure prices for variants get imported properly too (that Spree returns them via APIv2)
