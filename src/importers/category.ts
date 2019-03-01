import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import { JsonApiDocument, JsonApiResponse } from '../interfaces'
import { findIncluded, logger } from '../utils'

const importCategories = (
  spreeClient: Instance, getElasticBulkQueue: any, preconfigMapPages: any
): void => {
  preconfigMapPages(
    (page: number, perPage: number) => (
      spreeClient.taxons.list({
        include: 'parent,taxonomy,children,image,products',
        page,
        per_page: perPage
      })
    ),
    (response: JsonApiResponse) => {
      const category = response.data as JsonApiDocument
      logger.info(`Importing category id=${category.id} from Spree to ES`)

      const relationships = category.relationships

      const getChildrenProps = (categoryNode) => {
        const children = categoryNode.relationships.children.data.map((childRef) => {
          const child = findIncluded(response, 'taxon', childRef.id)

          return {
            id: childRef.id,
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

      const esCategory = {
        ...getChildrenProps(category),
        id: category.id,
        is_active: true,
        level: category.attributes.depth + 2,
        name: category.attributes.name,
        parent_id: relationships.parent.data && relationships.parent.data.id || '0',
        position: category.attributes.position,
        product_count: relationships.products.data.length,
        url_key: category.attributes.permalink.replace('-', '_')
      }

      getElasticBulkQueue.pushIndex('category', esCategory)
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
        logger.error(['Could not import category', error])
      })
    })
    .catch(logger.error)
}

export default importCategories
