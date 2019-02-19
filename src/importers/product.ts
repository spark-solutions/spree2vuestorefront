import {
  Document,
  JsonApiDocument,
  JsonApiResponse,
  OptionValueDocument,
  PositionedDocument,
  SpreeProductImage
} from '../interfaces'
import {
  findIncluded,
  findIncludedOfType,
  getImageUrl,
  getMediaGallery,
  logger
} from '../utils'

// productCustomAttributesPrefix is used as extra prefix to reduce the possibility of naming collisions with product
// options and standard product fields.
const productCustomAttributesPrefix = 'prodattr_'
const productOptionAttributePrefix = 'prodopt_'

const generateOptionAttributeCode = (attributeIdentifier) => `${productOptionAttributePrefix}${attributeIdentifier}`
const generateCustomAttributeCode = (attributeIdentifier) => `${productCustomAttributesPrefix}${attributeIdentifier}`

const sortyByPositionAttribute = (a: PositionedDocument, b: PositionedDocument) => {
  if (a.attributes.position > b.attributes.position) { return 1 }
  if (a.attributes.position < b.attributes.position) { return -1 }
  return 0
}

const findOptionTypeFromOptionValue = (optionTypes: any[], optionValueId): any | null => {
  return optionTypes.find((optionType) => {
    const optionValues = optionType.relationships.option_values.data
    return !!optionValues.find((optionValue: { id: string}) => {
      return optionValue.id === optionValueId
    })
  }) || null
}

const importProducts = (
  spreeClient: any,
  getElasticBulkQueue: any,
  preconfigMapPages: any
): void => {
  preconfigMapPages(
    (page: number, perPage: number) => (
      spreeClient.products.list({
        include: 'default_variant,images,option_types,product_properties,variants,variants.option_values',
        page,
        per_page: perPage
      })
    ),
    (response: JsonApiResponse) => {
      const product = response.data as JsonApiDocument
      const relationships = product.relationships
      const defaultVariantIdentifier = relationships.default_variant.data
      const defaultVariant = findIncluded(response, defaultVariantIdentifier.type, defaultVariantIdentifier.id)
      const categoryIds = relationships.taxons.data.map((taxon: { id: string }) => taxon.id)
      const images = findIncludedOfType(response, product, 'images')
      const mediaGallery = getMediaGallery(images as SpreeProductImage[])
      const hasOptions = relationships.option_types.data.length > 0
      const spreeProductProperies = findIncludedOfType(response, product, 'product_properties')
      const productProperties = spreeProductProperies.reduce((acc, propertyRecord) => {
        acc[generateCustomAttributeCode(propertyRecord.id)] = propertyRecord.attributes.value
        return acc
      }, {})

      const spreeVariants = findIncludedOfType(response, product, 'variants')
      const optionTypes = findIncludedOfType(response, product, 'option_types')

      const variants = spreeVariants.map((spreeVariant) => {
        const variantImages = findIncludedOfType(response, spreeVariant, 'images')

        const variantOptions = spreeVariant.relationships.option_values.data.reduce((acc, ov) => {
          const optionType = findOptionTypeFromOptionValue(optionTypes, ov.id)
          acc[generateOptionAttributeCode(optionType.id)] = ov.id
          return acc
        }, {})

        const variantPrice = parseFloat(spreeVariant.attributes.price)

        return {
          final_price: variantPrice,
          image: getImageUrl(variantImages[0] as SpreeProductImage, 800, 800) || '',
          priceInclTax: variantPrice,
          sku: spreeVariant.attributes.sku,
          status: 1,
          stock: {
            is_in_stock:
              spreeVariant.attributes.purchasable &&
              (spreeVariant.attributes.in_stock || spreeVariant.attributes.backorderable)
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
              .map((optionValue: { id: string }) => {
                // Some option values may not be provided when fetching a product - those which aren't used by the
                // product. Don't save them in ES for the product.
                return findIncluded(response, 'option_value', optionValue.id)
              })
              .filter((maybeOptionValueObj: OptionValueDocument | undefined): boolean => !!maybeOptionValueObj)
              .sort(sortyByPositionAttribute)
              .map((optionValueObj: OptionValueDocument) => {
                return {
                  label: optionValueObj.attributes.presentation,
                  value_index: optionValueObj.id
                }
              })
          }
        })

      const price = parseFloat(defaultVariant.attributes.price)

      const esProduct = {
        category: categoryIds,
        category_ids: categoryIds,
        configurable_children: variants,
        configurable_options: configurableOptions,
        description: defaultVariant.attributes.description,
        final_price: price, // 'final_price' field is used when filtering products in a category
        has_options: hasOptions, // easy way of checking if variants have selectable options
        id: product.id,
        image: getImageUrl(images[0] as SpreeProductImage, 800, 800) || '',
        media_gallery: images.length > 0 ? mediaGallery : null,
        name: defaultVariant.attributes.name,
        news_from_date: null, // start date for when product is "in the news" (featured)
        news_to_date: null, // end date for when product is "in the news" (featured)
        priceInclTax: price,
        sku: defaultVariant.attributes.sku,
        special_from_date: null, // promotion price start date
        special_price: null, // price during promotion (discounted product price)
        special_to_date: null, // promotion price end date
        // status. 1 - enabled , 2 - disabled, 3 - [LEGACY] out of stock, 0 - enabled (prob. just in case someone
        // uses 0 instead of 1)
        status: 1,
        stock: {
          is_in_stock:
            defaultVariant.attributes.purchasable &&
            (defaultVariant.attributes.in_stock || defaultVariant.attributes.backorderable)
        },
        // tax_class_id - Tax class from Magento. Can have the following values:
        // 0 - None, 2 - taxable Goods, 4 - Shipping, etc., depending on created tax classes.
        // In Magento, value of 1 is not used.
        tax_class_id: 2,
        thumbnail: getImageUrl(images[0] as SpreeProductImage, 800, 800) || '',
        type_id: variants.length === 0 ? 'simple' : 'configurable',
        // created_at - not required but can be used for sorting lists, ex. new products list on homepage
        updated_at: product.attributes.updated_at, // used for sorting and filtering
        // visibility. From Magento: 1 - Visible Individually, 2 - catalog, 3 - search, 4 - catalog & search
        visibility: 4,
        weight: parseFloat(defaultVariant.attributes.weight), // not sure if this should be float
        ...productProperties
      } as Document

      getElasticBulkQueue.pushIndex('product', esProduct)

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
        getElasticBulkQueue.pushIndex('attribute', attr)
      })
    }
  )
    .then(() => {
      return getElasticBulkQueue.flush()
      .then(({ errors }) => {
        if (errors.length > 0) {
          logger.error(['Some or all ES operations failed.', errors])
        }
      })
      .catch((error) => {
        logger.error(['Could not import product', error])
      })
    })
    .catch(logger.error)
}

export default importProducts
