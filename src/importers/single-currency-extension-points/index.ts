export const getPrice = (variant, _) => {
  return parseFloat(variant.attributes.price)
}

export const getVariantPrice = getPrice

export const getMasterVariantPrice = getPrice

export const getProductsListIncludes = () => (
  'default_variant,images,option_types,product_properties,variants,variants.option_values,taxons'
)
