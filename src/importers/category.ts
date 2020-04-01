import Client from '@spree/storefront-api-v2-sdk/types/Client'
import { JsonApiDocument } from '../interfaces'
import { getCategories, getCategoriesOnPath, logger, passFatal } from '../utils'
import { FatalError } from '../utils/errors'

const convertToESCategory = (category, categories, cursor) => {
  const relationships = category.relationships

  const getChildrenProps = (categoryNode) => {
    const children = categoryNode.relationships.children.data.map((childRef) => {
      const child = categories.find((candidateChildCategory) => candidateChildCategory.id === childRef.id)

      return {
        id: +childRef.id,
        ...getChildrenProps(child)
      }
    })

    if (children.length === 0) {
      return {}
    }

    return {
      children_count: children.length,
      children_data: children
    }
  }

  return {
    ...getChildrenProps(category),
    id: +category.id,
    cursor,
    is_active: true,
    level: category.attributes.depth + 2,
    name: category.attributes.name,
    // default value for parent_id must be an id not generated by Spree
    parent_id: relationships.parent.data && +relationships.parent.data.id || -42,
    path: getCategoriesOnPath(categories, [category.id]).map(({id}) => id).join('/'),
    position: category.attributes.position,
    product_count: relationships.products.data.length,
    url_key: category.attributes.permalink
  }
}

const importCategories = (
  spreeClient: Client,
  elasticBulkOperations: any,
  preconfigMapPages: any,
  cursor: string,
  updatedSinceDate: Date | null
): Promise<void> => {
  return getCategories(spreeClient, preconfigMapPages)
    .then((categories) => {
      let updates: number = 0
      let replacements: number = 0

      logger.info('Downloaded categories from Spree, converting to ES format')
      categories.forEach((category: JsonApiDocument) => {
        if (new Date(category.attributes.updated_at) < updatedSinceDate) {
          updates += 1
          elasticBulkOperations.pushUpdate('category', {
            id: +category.id,
            cursor
          })
        } else {
          replacements += 1
          const convertedCategory = convertToESCategory(category, categories, cursor)
          elasticBulkOperations.pushIndex('category', convertedCategory)
        }
      })

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
            throw new FatalError('Categories import failed.')
          }
          logger.info(`Categories imported. Removing unused products ('cursor' !== ${cursor}). `)
          return elasticBulkOperations.elasticBulkDelete('category', cursor)
        })
        .then((elasticResponse) => {
          if (elasticResponse.failures.length > 0) {
            logger.error(['Some or all ES operations failed.', elasticResponse.failures])
            throw new FatalError('Categories deletion failed.')
          }
          logger.info(`Removed ${elasticResponse.total} unused categories.`)
        })
    })
    .catch(passFatal((error) => {
      logger.error(['Could not fully process categories.', error])
      throw new FatalError('Categories import failed.')
    }))
}

export default importCategories
