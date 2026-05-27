import { type FreeGame } from "./types"

import { fetch } from "scripting"

async function fetchJson(url: string, init?: any): Promise<any> {
  try {
    const res = await fetch(url, {
      ...(init ?? {}),
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res?.json() ?? null
  } catch (err) {
    throw err
  }
}

function normalizeTimestamp(input: any): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null
  if (input <= 0) return null
  return input < 1e12 ? input * 1000 : input
}

function uniqueGames(games: FreeGame[]) {
  const seen = new Set<string>()
  const out: FreeGame[] = []
  for (const g of games) {
    const key = `${g.source}:${g.url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(g)
  }
  return out
}

function sortGames(games: FreeGame[]) {
  return [...games].sort((a, b) => {
    const ae = a.endDate ?? Number.MAX_SAFE_INTEGER
    const be = b.endDate ?? Number.MAX_SAFE_INTEGER
    if (ae !== be) return ae - be
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    return a.title.localeCompare(b.title)
  })
}

function pickEpicImage(images: any[]): string | null {
  if (!Array.isArray(images)) return null
  const preferred = ["OfferImageWide", "DieselStoreFrontWide", "Thumbnail", "OfferImageTall", "DieselStoreFrontTall"]
  for (const type of preferred) {
    const hit = images.find((i) => i && typeof i === "object" && i.type === type && typeof i.url === "string")
    if (hit) return hit.url
  }
  const anyUrl = images.find((i) => i && typeof i === "object" && typeof i.url === "string")?.url
  return typeof anyUrl === "string" ? anyUrl : null
}

function buildEpicUrl(productSlug: string | null, urlSlug: string | null) {
  const slug = productSlug || urlSlug
  if (!slug) return null
  return `https://store.epicgames.com/zh-CN/p/${encodeURIComponent(slug)}`
}

export async function fetchEpicFreeGames(nowMs: number): Promise<FreeGame[]> {
  const url =
    "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN"
  const json = await fetchJson(url)
  const elements = json?.data?.Catalog?.searchStore?.elements
  if (!Array.isArray(elements)) return []
  
  const games: FreeGame[] = []
  for (const el of elements) {
    if (!el || typeof el !== "object") continue
    const title = typeof el.title === "string" ? el.title : null
    if (!title) continue
    
    const promotions = el.promotions
    const promotionalOffers = promotions?.promotionalOffers?.[0]?.promotionalOffers
    const upcomingOffers = promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers
    const offers = Array.isArray(promotionalOffers) ? promotionalOffers : Array.isArray(upcomingOffers) ? upcomingOffers : []
    if (!offers.length) continue

    const offer =
      offers.find((o) => {
        const s = Date.parse(o?.startDate)
        const e = Date.parse(o?.endDate)
        return Number.isFinite(s) && Number.isFinite(e) && nowMs >= s && nowMs < e
      }) ?? offers[0]

    const startDate = Number.isFinite(Date.parse(offer?.startDate)) ? Date.parse(offer.startDate) : null
    const endDate = Number.isFinite(Date.parse(offer?.endDate)) ? Date.parse(offer.endDate) : null
    
    const originalPrice = el?.price?.totalPrice?.originalPrice
    const discountPrice = el?.price?.totalPrice?.discountPrice
    const isFree = discountPrice === 0 && typeof originalPrice === "number" && originalPrice >= 0
    if (!isFree) continue

    const urlSlug = typeof el.urlSlug === "string" ? el.urlSlug : null
    const productSlug = typeof el.productSlug === "string" ? el.productSlug : null
    const storeUrl = buildEpicUrl(productSlug, urlSlug)
    if (!storeUrl) continue

    const imageUrl = pickEpicImage(el.keyImages)
    const description = typeof el.description === "string" ? el.description : null
    
    games.push({
      id: `epic:${typeof el.id === "string" ? el.id : storeUrl}`,
      source: "epic",
      title,
      url: storeUrl,
      imageUrl,
      description,
      startDate,
      endDate,
      originalPriceText: typeof originalPrice === "number" ? `${(originalPrice / 100).toFixed(2)}` : null,
      finalPriceText: "0",
    })
  }

  return games
}

export async function fetchSteamGiveaways(): Promise<FreeGame[]> {
  const url = "https://store.steampowered.com/api/featuredcategories?cc=cn&l=schinese"
  const json = await fetchJson(url)
  const items = json?.specials?.items
  if (!Array.isArray(items)) return []

  const games: FreeGame[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const id = typeof item.id === "number" ? item.id : typeof item.id === "string" ? Number(item.id) : null
    if (!id || !Number.isFinite(id)) continue

    const title = typeof item.name === "string" ? item.name : null
    if (!title) continue

    const discountPercent = typeof item.discount_percent === "number" ? item.discount_percent : null
    const originalPrice = typeof item.original_price === "number" ? item.original_price : null
    const finalPrice = typeof item.final_price === "number" ? item.final_price : null
    const expirationMs = normalizeTimestamp(item.discount_expiration)

    // const isGiveaway = discountPercent === 100 || finalPrice === 0 && typeof originalPrice === "number" && originalPrice >= 0
    // console.log(isGiveaway, discountPercent, finalPrice, originalPrice);
    // if (!isGiveaway) continue

    const storeUrl = `https://store.steampowered.com/app/${id}/?l=schinese`
    const imageUrl =
      (typeof item.header_image === "string" && item.header_image) ||
      (typeof item.large_capsule_image === "string" && item.large_capsule_image) ||
      (typeof item.small_capsule_image === "string" && item.small_capsule_image) ||
      null

    games.push({
      id: `steam:${id}`,
      source: "steam",
      title,
      url: storeUrl,
      imageUrl,
      description: null,
      startDate: null,
      endDate: expirationMs,
      originalPriceText: typeof originalPrice === "number" ? `${(originalPrice / 100).toFixed(2)}` : null,
      finalPriceText: "0",
    })
  }

  return games
}

export async function fetchFreeGamesFromNetwork(nowMs: number): Promise<{ games: FreeGame[]; warnings: string[] }> {
  const warnings: string[] = []
  let steam: FreeGame[] = []
  let epic: FreeGame[] = []

  try {
    steam = await fetchSteamGiveaways()
  } catch (_error: any) {
    console.log(_error.message)
    warnings.push(`Steam 获取失败：${_error?.message || "未知错误"}`)
  }

  try {
    epic = await fetchEpicFreeGames(nowMs)
  } catch (_error: any) {
    console.log(_error.message)
    warnings.push(`Epic 获取失败：${_error?.message || "未知错误"}`)
  }

  const games = sortGames(uniqueGames([...steam, ...epic]))
  return { games, warnings }
}

