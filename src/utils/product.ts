import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'

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

export {
  findOptionTypeFromOptionValue,
  generateOptionAttributeCode,
  generateCustomAttributeCode
}
