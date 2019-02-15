import * as winston from 'winston'
import {
  Document,
  ESImage,
  ImageStyle,
  JsonApiDocument,
  JsonApiResponse,
  SpreeProductImage
} from '../interfaces'

const logger = winston.createLogger({
  exceptionHandlers: [
    new winston.transports.File({ filename: 'unhandled-exceptions.log' }),
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json({ space: 2 })
  ),
  level: 'info',
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
})

const sendToElastic = (elasticClient, index: string, type: string, document: Document) => {
  console.log('send', document.id)
  return elasticClient.index({
    body: document,
    id: document.id,
    index,
    type
  })
}

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
      logger.info(['Using image: ', styles[bestStyleIndex]])
      return styles[bestStyleIndex].url
    }
  }
  return null
}

const getESMediaGallery = (images: SpreeProductImage[]): ESImage[] => {
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
): any[] => {
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

// TODO: makePaginationRequest returns commands for ES that are optimized before sending
const mapPages = (
  makePaginationRequest: (page: number, perPage: number) => Promise<JsonApiResponse>,
  resourceCallback: (response: JsonApiResponse) => any,
  perPage: number,
  maxPages: number
): Promise<any[]> => {
  return new Promise((resolve, _) => {
    // Assume new requests don't need old 'included' from old responses.
    const handlePage = (page: number) => {
      if (page >= maxPages) {
        logger.info(`Pagination finished, total resources <= ${page * perPage}`)
        resolve()
      } else {
        makePaginationRequest(page, perPage)
          .then((response) => {
            logger.info(`Page nr ${page} downloaded, processing`)
            const responseResources = response.data as JsonApiDocument[]
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
      }
    }
    handlePage(0)
  })
}

// optimizeESBulk

export { sendToElastic, getImageUrl, getESMediaGallery, findIncluded, findIncludedOfType, logger, mapPages }
