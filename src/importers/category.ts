import { JsonApiDocument, JsonApiResponse } from '../interfaces'
import { logger } from '../utils'

const importCategories = (
  spreeClient: any, getElasticBulkQueue: any, preconfigMapPages: any
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
      const included = response.included

      const taxonChilds = () => {
        return relationships.children.data.map(obj => {
          const children = included.find(item => {
            return item.id === obj.id && item.type === 'taxon'
          })

          if (!children) return []

          return {
            parent_id: children.relationships.parent.data.id,
            position: children.attributes.position,
            children_count: children.relationships.children.data.length,
            include_in_menu: 1,
            name: children.attributes.name,
            url_key: children.attributes.permalink,
            id: children.id,
            children_data: []
          }
        })
      }

      const esCategory = () => {
        const categoryChilds = taxonChilds()

        return {
          parent_id: relationships.parent.data && relationships.parent.data.id || 1,
          is_active: true,
          position: category.attributes.position,
          level: category.attributes.depth + 2,
          children_count: relationships.children.data.length,
          product_count: relationships.products.data.length,
          available_sort_by: null,
          include_in_menu: 1,
          name: category.attributes.name,
          id: category.id,
          children_data: categoryChilds,
          url_key: `${category.attributes.permalink.replace('-', '_')}_${category.id}`
        }
      }

      getElasticBulkQueue.pushIndex('category', esCategory())
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
