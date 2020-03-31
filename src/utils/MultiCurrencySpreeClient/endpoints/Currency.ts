import { Http } from "@spree/storefront-api-v2-sdk"
import { IToken } from "@spree/storefront-api-v2-sdk/types/interfaces/Token"
import { IOrderResult } from "@spree/storefront-api-v2-sdk/types/interfaces/Order"
import { GET } from '@spree/storefront-api-v2-sdk/types/constants'
import { UpdateCurrencyQuery } from "../interfaces/endpoints/CurrencyClass"

export class Currency extends Http {
  private getSetCurrencyPath() {
    const storefrontPath = `api/v2/storefront`

    return `${storefrontPath}/cart/set_currency`
  }

  public async update(token: IToken, params: UpdateCurrencyQuery): Promise<IOrderResult> {
    return await this.spreeResponse(GET, this.getSetCurrencyPath(), token, params) as IOrderResult
  }
}
