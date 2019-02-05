import { Document, JsonApiDocument } from '../interfaces'
import { sendToElastic, spreeProduct } from '../utils'

// TODO: make importing resilient - try/catch any issues with product parsing and continue with next products or retry
// TODO: ensure importing works when some relationships are missing
// TODO: should elastic search be completely cleared on import?

// productCustomAttributesPrefix is used as extra prefix to reduce the possibility of naming collisions with product
// options and standard product fields.
const productCustomAttributesPrefix = 'prodattr_'
const productOptionAttributePrefix = 'prodopt_'

const generateOptionAttributeCode = (attributeIdentifier) => `${productOptionAttributePrefix}${attributeIdentifier}`
const generateCustomAttributeCode = (attributeIdentifier) => `${productCustomAttributesPrefix}${attributeIdentifier}`

const sortyByPositionAttribute = (a, b) => {
  if (a.attributes.position > b.attributes.position) { return 1 }
  if (a.attributes.position < b.attributes.position) { return -1 }
  return 0
}

// Looks for a resource included with primary resource, returned as a JSON:API 'included' item.
const findIncluded = (jsonApiObject, objectType: string, objectId: string): (JsonApiDocument|null) => {
  if (!jsonApiObject.included) {
    return null
  }
  return jsonApiObject.included.find(
    (includedObject) => includedObject.type === objectType && includedObject.id === objectId
  ) || null
}

const findIncludedOfType = (jsonApiObject, singlePrimaryRecord, objectType: string) => {
  if (!jsonApiObject.included) {
    return []
  }
  const typeRelationships = singlePrimaryRecord.relationships[objectType]
  if (!typeRelationships) {
    return []
  }
  return typeRelationships.data
    .map((typeObject) => findIncluded(jsonApiObject, typeObject.type, typeObject.id))
    .filter((typeRecord) => !!typeRecord)
}

const findOptionTypeFromOptionValue = (optionTypes: any[], optionValueId): (any|null) => {
  return optionTypes.find((optionType) => {
    const optionValues = optionType.relationships.option_values.data
    return !!optionValues.find((optionValue) => {
      return optionValue.id === optionValueId
    })
  }) || null
}

const importProducts = (spreeClient: any, elasticClient: any, elasticSearchOptions: any): Promise<any> => {
  // TODO: connect with Spree JS SDK
  const promises = []
  return spreeClient.products.list({
    include: 'default_variant,images,option_types,product_properties,variants,variants.option_values',
    page: 0,
    per_page: 50 //TODO: process all products on all pages
  })
    .then(async (response: any) => {
      // NORMALIZATION STEP (adapting to ES)
      const products = response.data

      products.forEach((product) => {
        const relationships = product.relationships
        const defaultVariantIdentifier = relationships.default_variant.data
        const defaultVariant = findIncluded(response, defaultVariantIdentifier.type, defaultVariantIdentifier.id)
        const categoryIds = relationships.taxons.data.map((taxon) => taxon.id)

        const images = findIncludedOfType(response, product, 'images')

        const mediaGallery = spreeProduct.getESMediaGallery(images)

        const hasOptions = relationships.option_types.data.length > 0
        const spreeProductProperies = findIncludedOfType(response, product, 'product_properties')
        const productProperties = spreeProductProperies.reduce(
          (acc, propertyRecord) => (
            {
              ...acc,
              [generateCustomAttributeCode(propertyRecord.id)]: propertyRecord.attributes.value
            }
          ),
          {}
        )

        const spreeVariants = findIncludedOfType(response, product, 'variants')

        const optionTypes = findIncludedOfType(response, product, 'option_types')

        const variants = spreeVariants.map((spreeVariant) => {

          const variantImages = findIncludedOfType(response, spreeVariant, 'images')

          const variantOptions = spreeVariant.relationships.option_values.data.reduce((acc, ov) => {
            const optionType = findOptionTypeFromOptionValue(optionTypes, ov.id)

            return {
              ...acc,
              [generateOptionAttributeCode(optionType.id)]: ov.id
            }
          }, {})

          return {
            image: spreeProduct.getImageUrl(variantImages, 0, 3, 0, null) || '',
            priceInclTax: parseFloat(spreeVariant.attributes.price),
            sku: spreeVariant.attributes.sku,
            status: 1,
            stock: {
              is_in_stock: spreeVariant.attributes.in_stock
            },
            ...variantOptions
          }
        })

        const configurableOptions = optionTypes
          .sort(sortyByPositionAttribute)
          .map((optionType) => {
            return {
              attribute_code: generateOptionAttributeCode(optionType.id),
              label: optionType.attributes.presentation,
              values: optionType.relationships.option_values.data
                .map((optionValue) => {
                  // Some option values may not be provided when fetching a product - those which aren't used by the
                  // product. Don't save them in ES for the product.
                  return findIncluded(response, 'option_value', optionValue.id)
                })
                .filter((maybOptionValueObj) => !!maybOptionValueObj)
                .sort(sortyByPositionAttribute)
                .map((optionValueObj) => {
                  return {
                    label: optionValueObj.attributes.presentation,
                    value_index: optionValueObj.id
                  }
                })
            }
          })

        const esProduct = {
          category_ids: categoryIds,
          configurable_children: variants,
          configurable_options: configurableOptions,
          description: defaultVariant.attributes.description,
          has_options: hasOptions, // easy way of checking if variants have selectable options
          id: product.id,
          image: spreeProduct.getImageUrl(images, 0, 3, 0, null) || '',
          media_gallery: images.length > 0 ? mediaGallery : null,
          name: defaultVariant.attributes.name,
          news_from_date: null, // start date for when product is "in the news" (featured)
          news_to_date: null, // end date for when product is "in the news" (featured)
          priceInclTax: parseFloat(defaultVariant.attributes.price),
          sku: defaultVariant.attributes.sku,
          special_from_date: null, // promotion price start date
          special_price: null, // price during promotion (discounted product price)
          special_to_date: null, // promotion price end date
          // status. 1 - enabled , 2 - disabled, 3 - [LEGACY] out of stock, 0 - enabled (prob. just in case someone
          // uses 0 instead of 1)
          status: 1,
          stock: {
            // TODO: decide if backorderable should make is_in_stock: true
            is_in_stock: defaultVariant.attributes.in_stock
          },
          // tax_class_id - Tax class from Magento. Can have the following values:
          // 0 - None, 2 - taxable Goods, 4 - Shipping, etc., depending on created tax classes.
          // In Magento, value of 1 is not used. Requires adding 'taxrule' type in Elastic Search.
          tax_class_id: 2,
          thumbnail: spreeProduct.getImageUrl(images, 0, 3, 0, null) || '',
          type_id: 'configurable',
          // created_at - not currently returned by Spree and not used by VS by default
          updated_at: product.attributes.updated_at, // used for sorting and filtering
          // visibility. From Magento: 1 - Visible Individually, 2 - catalog, 3 - search, 4 - catalog & search
          visibility: 4,
          weight: parseFloat(defaultVariant.attributes.weight), // not sure if this should be float
          ...productProperties
        } as Document

        promises.push(sendToElastic(elasticClient, elasticSearchOptions.index, 'product', esProduct))

        // FIXME: fields in Spree not used in VS: currency (determined from i18n), display_price, available_on,
        // meta_description & meta_keywords(not natively implemented in VS), purchasable, backorderable. Decide what
        // to do with them.

        const esAttributes = spreeProductProperies.map((propertyRecord) => {
          const id = generateCustomAttributeCode(propertyRecord.id)
          return {
            attribute_code: id,
            attribute_id: id,
            default_frontend_label: propertyRecord.attributes.name,
            id,
            is_user_defined: true,
            is_visible: true,
            is_visible_on_front: true
          } as Document
        })

        esAttributes.forEach((attr) => {
          promises.push(sendToElastic(elasticClient, elasticSearchOptions.index, 'attribute', attr))
        })
      })

      await Promise.all(promises)
    })
}

export default importProducts
