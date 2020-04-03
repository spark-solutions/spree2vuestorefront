import { Http } from "@spree/storefront-api-v2-sdk"
import { IToken } from "@spree/storefront-api-v2-sdk/types/interfaces/Token"
import { IOrderResult } from "@spree/storefront-api-v2-sdk/types/interfaces/Order"
import { UpdateCurrencyQuery, CreateCartQuery } from "../interfaces/endpoints/CurrencyClass"

export class Currency extends Http {
  private storefrontPath = `api/v2/storefront`

  private getSetCurrencyPath() {
    return `${this.storefrontPath}/cart/set_currency`
  }
  
  private getCartPath() {
    return `${this.storefrontPath}/cart`
  }

  public async update(token: IToken, params: UpdateCurrencyQuery): Promise<IOrderResult> {
    return await this.spreeResponse('patch', this.getSetCurrencyPath(), token, params) as IOrderResult
  }

  public async createCartWithCurrency(token: IToken, params: CreateCartQuery = {}): Promise<IOrderResult> {
    return await this.spreeResponse('post', this.getCartPath(), token, params) as IOrderResult
  }
}
