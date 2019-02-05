/* tslint:disable:no-console */

require('dotenv').config()
const program = require('commander')
import elasticsearch from 'elasticsearch'
import { Client } from 'spree-storefront-api-v2-js-sdk'
import importers from './importers'

const spreeOptions = {
  host: process.env.S_HOST,
  imagesHost: process.env.S_IMAGES_HOST,
  path: process.env.S_PATH
}

const elasticSearchOptions = {
  host: process.env.ES_HOST,
  index: process.env.ES_INDEX,
  logLevel: process.env.ES_LOG_LEVEL,
  requestTimeout: process.env.ES_REQUEST_TIMEOUT
}

const getElasticClient = () => (
  elasticsearch.Client({
    host: elasticSearchOptions.host,
    log: elasticSearchOptions.logLevel
  })
)

const getSpreeClient = () => (
  Client({
    host: spreeOptions.host + '/'
  })
)

program.command('remove-everything')
  .action(() => {
    getElasticClient().indices.delete({
      index: 'vue_storefront_catalog'
    })
  })

program.command('products')
  .action(() => {
    importers.product(getSpreeClient(), getElasticClient(), elasticSearchOptions)
      .catch(console.error)
  })

program.command('product [ids...]')
  .action((ids) => {
    if (ids.length === 0) {
      console.error('at least one id requied')
      process.exit(1)
    }
    getElasticClient().search({
      body: {
        query: {
          terms: {
            id: ids
          }
        }
      },
      index: 'vue_storefront_catalog',
      type: 'tax'
    })
      .then((products) => {
        console.log(JSON.stringify(products.hits.hits, null, 2))
      })
  })

program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '))
  process.exit(1)
})

// TODO: program.command('attributes')
// TODO: program.command('categories')
// TODO: command to fetch single product

program
  .parse(process.argv)
