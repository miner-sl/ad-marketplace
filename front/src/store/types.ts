export interface Condition {
  id?: number
  type:
    | 'jetton'
    | 'toncoin'
    | 'emoji'
    | 'nft_collection'
    | 'gift_collection'
    | 'sticker_collection'
    | 'premium'
    | 'whitelist'
  expected?: string | number
  title?: string
  category?: string
  model?: string
  pattern?: string
  backdrop?: string
  collection?: {
    title?: string
  }
  character?: {
    name?: string
  }
}
