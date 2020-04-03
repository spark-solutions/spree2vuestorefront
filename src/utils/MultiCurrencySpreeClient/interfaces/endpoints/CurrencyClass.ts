import { IQuery } from '@spree/storefront-api-v2-sdk/types/interfaces/Query'

export interface UpdateCurrencyQuery extends IQuery {
  currency: string
}

export interface CreateCartQuery extends IQuery {
  currency?: string
}
