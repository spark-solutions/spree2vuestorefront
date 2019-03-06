import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import { JsonApiDocument, JsonApiResponse } from '../interfaces'

/**
 * Eager loading of all Spree categories
 */
const getCategories = (spreeClient: Instance, preconfigMapPages): Promise<JsonApiDocument[]> => {
  const categories: JsonApiDocument[] = []

  return preconfigMapPages(
    (page: number, perPage: number) => (
      spreeClient.taxons.list({
        page,
        per_page: perPage
      })
    ),
    (response: JsonApiResponse) => {
      categories.push(response.data as JsonApiDocument)
    }
  )
    .then(() => {
      return categories
    })
}

/**
 * Lists parent categories of leafCategoriesIds and leafCategoriesIds themselves.
 */
const getCategoriesOnPath = (categories: JsonApiDocument[], leafCategoriesIds: string[]) => {
  const categoriesOnPath = []
  leafCategoriesIds.forEach((leafCategoryId) => {
    let nodeCategoryId = leafCategoryId
    while (nodeCategoryId && categoriesOnPath.indexOf(nodeCategoryId) === -1) {
      const nodeCategory = categories.find(({ id }) => {
        return id === nodeCategoryId
      })
      categoriesOnPath.unshift(nodeCategory) // make sure topmost category id is on the left
      const parentCategoryRef = nodeCategory.relationships.parent.data
      nodeCategoryId = parentCategoryRef ? parentCategoryRef.id : null
    }
  })
  return categoriesOnPath
}

export {
  getCategories,
  getCategoriesOnPath
}
