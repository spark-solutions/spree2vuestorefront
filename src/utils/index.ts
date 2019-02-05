import { Document } from '../interfaces'
import * as spreeProduct from './spreeProduct'

const sendToElastic = (elasticClient, index: string, type: string, document: Document) => {
  return elasticClient.index({
    body: document,
    id: document.id,
    index,
    type
  })
}

export { sendToElastic, spreeProduct }
