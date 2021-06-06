import { Client } from '@spree/storefront-api-v2-sdk'
import { IClientConfig } from '@spree/storefront-api-v2-sdk/types/Client'
import { Currency } from './endpoints/Currency'

export class MultiCurrencySpreeClient extends Client {
  public currency: Currency

  constructor(config: IClientConfig) {
    super(config)
    this.currency = new Currency(config.host)
  }
}
