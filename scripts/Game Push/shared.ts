import { fetchFreeGamesFromNetwork } from "./api"
import { type FreeGame } from "./types"


const CACHE_TTL_MS = 30 * 60 * 1000
const WIDGET_ROTATE_MS = 15 * 60 * 1000

const CACHE_PATH = `${FileManager.appGroupDocumentsDirectory}/game_push_cache.json`
const STATE_PATH = `${FileManager.appGroupDocumentsDirectory}/game_push_state.json`

type CacheFile = {
  fetchedAt: number
  games: FreeGame[]
  warnings: string[]
}

type StateFile = {
  index: number
  rotatedAt: number
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const exists = await FileManager.exists(path)
    if (!exists) return null
    const raw = await FileManager.readAsString(path)
    return JSON.parse(raw) as T
  } catch (_error) {
    return null
  }
}

async function writeJsonFile(path: string, value: unknown) {
  try {
    await FileManager.writeAsString(path, JSON.stringify(value))
  } catch (_error) {}
}


export async function loadFreeGames({ noCache }: { noCache: boolean }): Promise<{ games: FreeGame[]; warnings: string[] }> {
  const nowMs = Date.now()

  const cache = await readJsonFile<CacheFile>(CACHE_PATH)
  const cacheFresh = Boolean(cache && typeof cache.fetchedAt === "number" && nowMs - cache.fetchedAt < CACHE_TTL_MS)
  if (!noCache && cacheFresh && cache) {
    return { games: cache.games ?? [], warnings: cache.warnings ?? [] }
  }

  const res = await fetchFreeGamesFromNetwork(nowMs)
  await writeJsonFile(
    CACHE_PATH,
    {
      fetchedAt: nowMs,
      games: res.games,
      warnings: res.warnings,
    } satisfies CacheFile
  )

  if (!res.games.length && cache?.games?.length) {
    const fallbackWarnings = [...(cache.warnings ?? []), ...res.warnings, "本次请求未返回内容，已使用上次缓存（可能已过期）。"]
    return { games: cache.games, warnings: fallbackWarnings }
  }

  return res
}

export function formatRemainingText(endDate: number | null) {
  if (!endDate) return "有效期未知"
  const now = Date.now()
  const diff = endDate - now
  if (diff <= 0) return "已结束"
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  if (days > 0) return `剩余 ${days} 天 ${hours} 小时`
  if (hours > 0) return `剩余 ${hours} 小时`
  return `剩余 ${Math.max(1, totalMinutes)} 分钟`
}

export function buildWidgetReloadDate() {
  return new Date(Date.now() + WIDGET_ROTATE_MS)
}

export async function getWidgetState(): Promise<StateFile> {
  const state = await readJsonFile<StateFile>(STATE_PATH)
  const index = typeof state?.index === "number" && Number.isFinite(state.index) ? Math.max(0, Math.floor(state.index)) : 0
  const rotatedAt = typeof state?.rotatedAt === "number" && Number.isFinite(state.rotatedAt) ? state.rotatedAt : 0
  return { index, rotatedAt }
}

export async function setWidgetIndex(index: number) {
  const safe = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  const nowMs = Date.now()
  await writeJsonFile(STATE_PATH, { index: safe, rotatedAt: nowMs } satisfies StateFile)
}

export async function stepWidgetIndex(total: number) {
  if (!Number.isFinite(total) || total <= 0) {
    await setWidgetIndex(0)
    return 0
  }

  const nowMs = Date.now()
  const state = await getWidgetState()
  const nextIndex = (state.index + 1) % total
  await writeJsonFile(STATE_PATH, { index: nextIndex, rotatedAt: nowMs } satisfies StateFile)
  return nextIndex
}

export async function rotateWidgetIndexIfNeeded(total: number) {
  if (!Number.isFinite(total) || total <= 1) {
    await setWidgetIndex(0)
    return 0
  }

  const nowMs = Date.now()
  const state = await getWidgetState()
  if (nowMs - state.rotatedAt < WIDGET_ROTATE_MS) {
    return state.index % total
  }

  const nextIndex = (state.index + 1) % total
  await writeJsonFile(STATE_PATH, { index: nextIndex, rotatedAt: nowMs } satisfies StateFile)
  return nextIndex
}
