export interface BackendOptions { }
export interface SpreeProduct { }
export interface Document {
  id: string
}
export interface JsonApiResponse {
  data: JsonApiDocument | JsonApiDocument[],
  included?: JsonApiDocument[],
  meta?: {
    total_pages: number
  }
}
export interface JsonApiDocument {
  id: string,
  type: string,
  attributes: any,
  relationships: any | null
}

export interface ImageStyle {
  url: string,
  width: string,
  height: string
}

export interface SpreeProductImage {
  attributes: {
    styles: ImageStyle[]
  }
}

export interface ESImage {
  image: string,
  lab: string | null,
  pos: number,
  typ: 'image'
}
