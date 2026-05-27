export type FreeGameSource = "steam" | "epic"

export type FreeGame = {
  id: string
  source: FreeGameSource
  title: string
  url: string
  imageUrl: string | null
  description: string | null
  startDate: number | null
  endDate: number | null
  originalPriceText: string | null
  finalPriceText: string | null
}

