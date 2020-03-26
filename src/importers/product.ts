import Client from '@spree/storefront-api-v2-sdk/types/Client'
import {
  Document,
  ESProductType,
  JsonApiDocument,
  JsonApiResponse,
  OptionValueDocument,
  PositionedDocument,
  SpreeProductImage,
  GetProductsListIncludes,
  GetVariantPrice,
  GetMasterVariantPrice
} from '../interfaces'
import {
  FatalError,
  findIncluded,
  findIncludedOfType,
  findOptionTypeFromOptionValue,
  generateCustomAttributeCode,
  generateOptionAttributeCode,
  getCategories,
  getCategoriesOnPath,
  getImageUrl,
  getMediaGallery,
  logger,
  passFatal
} from '../utils'

const sortyByPositionAttribute = (a: PositionedDocument, b: PositionedDocument) => {
  if (a.attributes.position > b.attributes.position) { return 1 }
  if (a.attributes.position < b.attributes.position) { return -1 }
  return 0
}

const importProducts = (
  spreeClient: Client,
  elasticBulkOperations: any,
  preconfigMapPages: any,
  cursor: string,
  updatedSinceDate: Date,
  getVariantPrice: GetVariantPrice,
  getMasterVariantPrice: GetMasterVariantPrice,
  getProductsListIncludes: GetProductsListIncludes
): Promise<void> => {
  let updates: number = 0
  let replacements: number = 0

  return getCategories(spreeClient, preconfigMapPages)
    .then((categories: JsonApiDocument[]) => {
      logger.info('Categories fetched. Importing products.')

      return preconfigMapPages(
        (page: number, perPage: number) => (
          spreeClient.products.list({
            include: getProductsListIncludes(),
            page,
            per_page: perPage
          })
        ),
        (response: JsonApiResponse) => {
          const product = response.data as JsonApiDocument

          if (new Date(product.attributes.updated_at) < updatedSinceDate) {
            updates += 1
            elasticBulkOperations.pushUpdate('product', {
              id: +product.id,
              cursor
            })
          } else {
            replacements += 1
            const relationships = product.relationships
            const defaultVariantIdentifier = relationships.default_variant.data
            const defaultVariant = findIncluded(response, defaultVariantIdentifier.type, defaultVariantIdentifier.id)
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

              const variantMediaGallery = getMediaGallery(variantImages as SpreeProductImage[])
                .reduce((accumulatedImages, { image }, variantIndex) => {
                  if (variantIndex === 0) {
                    return accumulatedImages
                  }
                  return {
                    ...accumulatedImages,
                    [`image${variantIndex}`]: image
                  }
                },
                {}
              )

              const variantPrice = getVariantPrice(spreeVariant, response)

              return {
                final_price: variantPrice,
                image: getImageUrl(variantImages[0] as SpreeProductImage, 800, 800) || '',
                priceInclTax: variantPrice,
                regular_price: variantPrice,
                sku: spreeVariant.attributes.sku,
                status: 1,
                stock: {
                  is_in_stock:
                    spreeVariant.attributes.purchasable &&
                    (spreeVariant.attributes.in_stock || spreeVariant.attributes.backorderable)
                },
                ...variantOptions,
                ...variantMediaGallery
              }
            })

            const configurableOptions = optionTypes
              .sort(sortyByPositionAttribute)
              .map((optionType) => {
                return {
                  attribute_code: generateOptionAttributeCode(optionType.id),
                  attribute_name: optionType.attributes.name,
                  // attribute_id - only required when setConfigurableProductOptions: true, should equal attribute_code
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

            const filterObject = {}

            configurableOptions.forEach((filterType) => {
              const filterOptionArray = []

              variants.forEach((variant) => {
                if (filterOptionArray.indexOf(variant[filterType.attribute_code]) === -1) {
                  filterOptionArray.push(variant[filterType.attribute_code])
                }
              })

              filterObject[filterType.attribute_name] = filterOptionArray
            })

            const price = getMasterVariantPrice(defaultVariant, response)
            const productCategories = getCategoriesOnPath(categories, relationships.taxons.data.map(({ id }) => id))

            const esProduct = {
              // category - used for product lists (query.newProducts in config),
              // such as default "Everything new" on homepage when filterFieldMapping has
              // "category.name": "category.name.keyword" and for limiting search to category.
              category: productCategories.map((category) => (
                {
                  category_id: +category.id,
                  name: category.attributes.name
                }
              )),
              ...filterObject,
              category_ids: productCategories.map((category) => +category.id),
              configurable_children: variants,
              configurable_options: configurableOptions,
              // created_at - Spree doesn't return created date, use available_on as replacement
              created_at: product.attributes.available_on,
              cursor,
              description: defaultVariant.attributes.description,
              final_price: price, // 'final_price' field is used when filtering products in a category
              has_options: hasOptions, // easy way of checking if variants have selectable options
              id: +product.id,
              image: getImageUrl(images[0] as SpreeProductImage, 800, 800) || '',
              media_gallery: images.length > 0 ? mediaGallery : null,
              name: defaultVariant.attributes.name,
              news_from_date: null, // start date for when product is "in the news" (featured)
              news_to_date: null, // end date for when product is "in the news" (featured)
              price,
              priceInclTax: price,
              regular_price: price,
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
              type_id: variants.length === 0 ? ESProductType.Simple : ESProductType.Configurable,
              updated_at: product.attributes.updated_at, // used for sorting and filtering
              // visibility. From Magento: 1 - Visible Individually, 2 - catalog, 3 - search, 4 - catalog & search
              visibility: 4,
              weight: parseFloat(defaultVariant.attributes.weight), // not sure if this should be float
              ...productProperties
            } as Document

            elasticBulkOperations.pushIndex('product', esProduct)

            const esAttributes = spreeProductProperies.map((propertyRecord) => {
              const id = generateCustomAttributeCode(propertyRecord.id)
              return {
                attribute_code: id,
                attribute_id: id,
                default_frontend_label: propertyRecord.attributes.name,
                id: +propertyRecord.id,
                is_user_defined: true,
                is_visible: true,
                is_visible_on_front: true
              } as Document
            })

            const esOptionTypes = configurableOptions.map((optionRecord) => {
              return {
                id: +optionRecord.attribute_code,
                is_user_defined: true,
                is_visible: true,
                attribute_code: optionRecord.attribute_name,
                options: optionRecord.values.map((optionValue) => {
                  return {
                    label: optionValue.label,
                    value: optionValue.value_index
                  }
                })
              }
            })

            // TODO: Attributes are always replaced. Unused attributes are never removed. Consider patching instead,
            // same way products are.
            esAttributes.forEach((attr) => {
              elasticBulkOperations.pushIndex('attribute', attr)
            })

            esOptionTypes.forEach((attr) => {
              elasticBulkOperations.pushIndex('attribute', attr)
            })
          }
        }
      )
    })
    .then(() => {
      logger.info(`Products' cursor updates requested: ${updates}.` +
        ` Products' content updates requested: ${replacements}.`)

      return elasticBulkOperations.flush()
        .then(({ errors }) => {
          if (errors.length > 0) {
            logger.error(['Some or all ES operations failed.', errors])
            const probablyUpdatedSinceDateWrong = errors.some((error) => (
              'update' in error && error.update.status === 404
            ))
            if (probablyUpdatedSinceDateWrong) {
              logger.warn(
                'Tried updating non-existent products in Elastic Search.' +
                ` Are you sure updatedSinceDate (= ${updatedSinceDate}) is appropriate?` +
                ' Try updatedSinceDate = null instead.'
              )
            }
            throw new FatalError('Products import failed.')
          }

          logger.info(`Products imported. Removing unused products ('cursor' !== ${cursor}). `)
          return elasticBulkOperations.elasticBulkDelete('product', cursor)
        })
        .then((elasticResponse) => {
          if (elasticResponse.failures.length > 0) {
            logger.error(['Some or all ES operations failed.', elasticResponse.failures])
            throw new FatalError('Products deletion failed.')
          }
          logger.info(`Removed ${elasticResponse.total} unused products.`)
        })
    })
    .catch(passFatal((error) => {
      logger.error(['Could not fully process products.', error])
      throw new FatalError('Products import failed.')
    }))
}

export default importProducts
