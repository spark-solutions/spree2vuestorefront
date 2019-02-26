import cors from 'cors'
import express from 'express'
import Instance from 'spree-storefront-api-v2-js-sdk/src/Instance'
import {
  logger,
} from '../utils'

const app = express()

export default (_: Instance) => {
  app.use(cors())
  app.use(express.json())

  app.all('*', (request, response) => {
    logger.info(`Request for ${request.path} could not be handled`)
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json')
    response.json({
      code: 500
    })
  })

  app.listen(8889, () => {
    logger.info('API listening on port 8889')
  })
}
