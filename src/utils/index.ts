import serializeError from 'serialize-error'
import { IToken } from 'spree-storefront-api-v2-js-sdk/src/interfaces/Token'
import * as winston from 'winston'
import {
  Document,
  ElasticOperation,
  ESImage,
  ImageStyle,
  JsonApiDocument,
  JsonApiListResponse,
  JsonApiResponse,
  SpreeProductImage
} from '../interfaces'

const makeLogger = () => {
  const { format: { combine, json, timestamp } } = winston
  const replacer = (_: string, logValue: any) => logValue instanceof Error ? serializeError(logValue) : logValue

  return winston.createLogger({
    exceptionHandlers: [
      new winston.transports.File({ filename: 'unhandled-exceptions.log' }),
      new winston.transports.Console()
    ],
    format: combine(
      timestamp(),
      json({ replacer, space: 2 })
    ),
    level: 'info',
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' }),
      new winston.transports.Console()
    ]
  })
}

const logger = makeLogger()

const getImageUrl = (image: SpreeProductImage, minWidth: number, _: number): string | null => {
  // every image is still resized in vue-storefront-api, no matter what getImageUrl returns
  if (image) {
    const { attributes: { styles } } = image
    const bestStyleIndex = styles.reduce((bSIndex: number | null, style: ImageStyle, styleIndex: number) => {
      // assuming all images are the same dimensions, just scaled
      if (bSIndex === null) {
        return 0
      }
      const bestStyle = styles[bSIndex]
      const widthDiff = (+bestStyle.width) - minWidth
      const minWidthDiff = (+style.width) - minWidth
      if (widthDiff < 0 && minWidthDiff > 0) {
        return styleIndex
      }
      if (widthDiff > 0 && minWidthDiff < 0) {
        return bSIndex
      }
      return Math.abs(widthDiff) < Math.abs(minWidthDiff) ? bSIndex : styleIndex
    }, null)

    if (bestStyleIndex !== null) {
      return styles[bestStyleIndex].url
    }
  }
  return null
}

const getMediaGallery = (images: SpreeProductImage[]): ESImage[] => {
  return images.reduce(
    (acc, _, imageIndex) => {
      const imageUrl = getImageUrl(images[imageIndex], 800, 800)
      if (imageUrl) {
        return [
          ...acc,
          {
            image: imageUrl,
            lab: null,
            pos: imageIndex,
            typ: 'image'
          } as ESImage
        ]
      }
      return acc
    },
    []
  )
}

// Looks for a resource included with primary resource, returned as a JSON:API 'included' item.
const findIncluded = (response: JsonApiResponse, objectType: string, objectId: string): JsonApiDocument | null => {
  if (!response.included) {
    return null
  }
  return response.included.find(
    (includedObject) => includedObject.type === objectType && includedObject.id === objectId
  ) || null
}

const findIncludedOfType = (
  response: JsonApiResponse, singlePrimaryRecord: JsonApiDocument, objectType: string
): JsonApiDocument[] => {
  if (!response.included) {
    return []
  }
  const typeRelationships = singlePrimaryRecord.relationships[objectType]
  if (!typeRelationships) {
    return []
  }
  return typeRelationships.data
    .map((typeObject: JsonApiDocument) => findIncluded(response, typeObject.type, typeObject.id))
    .filter((typeRecord: JsonApiDocument | null) => !!typeRecord)
}

const mapPages = (
  makePaginationRequest: (page: number, perPage: number) => Promise<JsonApiListResponse>,
  resourceCallback: (response: JsonApiResponse) => any,
  perPage: number,
  maxPages: number
): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Assume new requests don't need old 'included' from old responses.
    const handlePage = (page: number) => {
      if (page >= maxPages) {
        logger.info(`Pagination finished, total resources <= ${page * perPage}`)
        resolve()
      } else {
        makePaginationRequest(page, perPage)
          .then((response) => {
            const responseResources = response.data as JsonApiDocument[]
            logger.info(`Downloaded page ${page} containing ${responseResources.length} resources, processing`)
            responseResources.map((resource: JsonApiDocument, resourceIndex: number) => {
              try {
                resourceCallback({
                  data: resource,
                  included: response.included
                })
              } catch (error) {
                logger.error(
                  ['Resource import error', { page, per_page: perPage, resourcePageIndex: resourceIndex }, error]
                )
              }
            })

            if (page < response.meta.total_pages) {
              handlePage(page + 1)
            } else {
              logger.info(`Pagination finished, total resources <= ${page * perPage}`)
              resolve()
            }
          })
          .catch(reject)
      }
    }
    handlePage(0)
  })
}

type ESBulkPromise = Promise<{ errors: any[], operations: ElasticOperation[], operationsCount: number }>

const pushElasticIndex = (
  elasticClient,
  pendingOperations: ESBulkPromise,
  maxOperationsPerBulk: number,
  index: string,
  type: string,
  document: Document
): ESBulkPromise => {
  return pendingOperations
    .then(({ errors, operations, operationsCount}) => {
      const expectedOperationsCount = operationsCount + 1
      if (expectedOperationsCount > maxOperationsPerBulk) {
        return pushElasticIndex(
          elasticClient,
          Promise.resolve({
            errors,
            operations: operations.slice(0, maxOperationsPerBulk),
            operationsCount
          }),
          maxOperationsPerBulk,
          index,
          type,
          document
        )
          .then(({ errors: updatedErrors }) => {
            return pushElasticIndex(
              elasticClient,
              Promise.resolve({
                errors: updatedErrors,
                operations: operations.slice(maxOperationsPerBulk),
                operationsCount: operationsCount - maxOperationsPerBulk
              }),
              maxOperationsPerBulk,
              index,
              type,
              document
            )
          })
      }
      const updatedOperations = [
        ...operations,
        {
          index: {
            _id: document.id,
            _index: index,
            _type: type
          }
        },
        document
      ] as ElasticOperation[]
      if (expectedOperationsCount === maxOperationsPerBulk) {
        return flushElastic(
          elasticClient,
          Promise.resolve({
            errors,
            operations: updatedOperations,
            operationsCount: expectedOperationsCount
          })
        )
      }
      return Promise.resolve({
        errors,
        operations: updatedOperations,
        operationsCount: expectedOperationsCount
      })
    })
}

const flushElastic = (
  elasticClient,
  pendingOperations: ESBulkPromise
): ESBulkPromise => {
  return pendingOperations
    .then(({ errors, operations, operationsCount }) => {
      if (operationsCount === 0) {
        return pendingOperations
      }
      return elasticClient.bulk({ body: operations })
        .then((response) => {
          return {
            errors: response.errors ?
              [...errors, response.items.filter((item: any) => !!item[Object.keys(item)[0]].error)]
              : errors,
            operations: [],
            operationsCount: 0
          }
        })
    })
}

const getTokenOptions = (request): IToken => {
  const tokenOptions: IToken = {}

  const bearerToken = request.query.token
  const orderToken = request.query.cartId

  if (bearerToken) {
    tokenOptions.bearerToken = bearerToken
  }

  if (orderToken) {
    tokenOptions.orderToken = orderToken
  }

  return tokenOptions
}

export {
  findIncluded,
  findIncludedOfType,
  flushElastic,
  getImageUrl,
  getMediaGallery,
  getTokenOptions,
  logger,
  mapPages,
  pushElasticIndex
}

export * from './product'
