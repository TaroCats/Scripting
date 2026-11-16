/**
 * 图标的两条来源，都指向 magpie 的**网页端**（`magpie web`，默认 3430）。
 *
 * 查 magpie 源码（`internal/gui/app.js` 的 `icon()`）后按它的规则对齐：
 *   1. `file:<hash>.<ext>` —— 用户给自己 provider 抓的图，页面从
 *      `/api/icons/<hash>.<ext>` 取；取不到就画 generic 占位。
 *   2. 内置资源名（`claude-color`、`zcode`…）—— 页面从 `icons/<name>.<svg|png>`
 *      取；内联表里没有的，这里同样去网页端拉一次。
 *   3. 名字里带 `:` 或 `/`（URL、路径）—— magpie 自己也不当图片画，直接 generic。
 *   4. 空字符串 —— magpie 画空白，我们统一给 generic，比空白有用。
 *
 * 网页端整体在 key 后面（`web.go` 的 `webGuard`）。**注意**：链接里的
 * `?k=<key>` 不是直接放行，而是 303 跳转 + `Set-Cookie`；fetch 跟随后会掉进 401。
 * 所以这里直接按 cookie 发：`magpie_web_<port>=<key>`（源码 `webGuard("magpie_web_"+port, …)`）。
 *
 * 拉到就落盘缓存（哈希/资源名都是内容稳定的，永久有效），小组件直接读本地文件。
 */
import { fetch } from "scripting"
import { normalizeBaseURL } from "./api"
import { hasBuiltinIcon, iconAssetExtensions } from "./icons"
import type { PanelCard, PanelConfig } from "./types"

/** 与 magpie 的 provider.IconFile 同一套命名规则，别让它拼出目录外的路径 */
const ICON_NAME_RE = /^[0-9a-f]{16}\.(png|jpe?g|gif|webp|ico|svg)$/i
/** 内置资源名只允许这些字符，避免拼出 ../ */
const ASSET_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
// v2：v1 缓存里的 SVG 可能还是 currentColor（深色下看不见），换目录强制重下
const CACHE_FOLDER = "magpanel_icons_v2"
const FETCH_TIMEOUT_MS = 4000
const MAX_ICON_BYTES = 1 << 20

export type IconCacheResult = { fetched: number; failed: number; error: string }

/** 一次取图：URL 与落盘用的文件名 */
export type IconAttempt = { cacheName: string; url: string }

function cacheDir(): string | null {
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    return dir ? `${dir}/${CACHE_FOLDER}` : null
  } catch {
    return null
  }
}

function ensureCacheDir(): string | null {
  const dir = cacheDir()
  if (!dir) return null
  try {
    if (!FileManager.existsSync(dir)) FileManager.createDirectorySync(dir, true)
  } catch {
    return null
  }
  return dir
}

/** "file:4636929b8040eb80.png" → "4636929b8040eb80.png"；别的返回 "" */
export function iconFileNameOf(rawIcon: string): string {
  const raw = (rawIcon || "").trim()
  if (!raw.toLowerCase().startsWith("file:")) return ""
  const name = raw.slice(5).trim()
  return ICON_NAME_RE.test(name) ? name : ""
}

/** 图标来源：手填优先，否则网关主机 + 3430（magpie web 的默认端口） */
export function iconBaseOf(cfg: PanelConfig): string {
  const explicit = normalizeBaseURL(cfg.iconBaseURL ?? "")
  if (explicit) return explicit
  const base = normalizeBaseURL(cfg.baseURL)
  const m = /^https?:\/\/[^/:]+(?::\d+)?/i.exec(base)
  if (!m) return ""
  const origin = m[0]
  if (/:3430$/i.test(origin)) return origin
  return `${origin.replace(/:\d+$/, "")}:3430`
}

/**
 * 网页端的 cookie 名是 `magpie_web_<port>`（magpie `web.go`:
 * `webGuard("magpie_web_"+port, …)`）。key 一定 cookie 安全（magpie 自己就这么种）。
 */
export function iconCookie(base: string, key: string): string {
  const k = (key || "").trim()
  if (!k) return ""
  const port = /:(\d+)\s*$/.exec(base)?.[1] ?? "3430"
  return `magpie_web_${port}=${k}`
}

/** 一张卡要试的取图地址（内置名按 svg/png 顺序试） */
export function iconAttempts(base: string, rawIcon: string): IconAttempt[] {
  const file = iconFileNameOf(rawIcon)
  if (file) return [{ cacheName: file, url: `${base}/api/icons/${file}` }]

  const asset = (rawIcon || "").trim()
  if (!asset || asset === "generic") return []
  // 带冒号或斜杠的是 URL / 路径，magpie 也不当图（app.js: 直接 generic）
  if (/[:/\\]/.test(asset) || !ASSET_NAME_RE.test(asset)) return []
  if (hasBuiltinIcon(asset)) return [] // 已经内联在脚本里，不用联网

  return iconAssetExtensions(asset).map(ext => ({
    cacheName: `${asset}.${ext}`,
    url: `${base}/icons/${asset}.${ext}`,
  }))
}

/** 已缓存的本地路径；没缓存过返回 "" */
export function cachedIconPath(name: string): string {
  const dir = cacheDir()
  if (!dir) return ""
  const path = `${dir}/${name}`
  try {
    return FileManager.existsSync(path) ? path : ""
  } catch {
    return ""
  }
}

/** 把 SVG 根节点的宽高固定成 64，避免 `1em` 这种相对单位在不同环境下算成 0 */
function sizedSvgText(text: string): string {
  return text.replace(/<svg\b([^>]*)>/i, (_m, attrs) => {
    let a = String(attrs)
    a = /\swidth\s*=/i.test(a) ? a.replace(/\swidth\s*=\s*"[^"]*"/i, ' width="64"') : ` width="64"${a}`
    a = /\sheight\s*=/i.test(a) ? a.replace(/\sheight\s*=\s*"[^"]*"/i, ' height="64"') : ` height="64"${a}`
    return `<svg${a}>`
  })
}

async function fetchOne(base: string, key: string, attempt: IconAttempt): Promise<{ path: string; error: string }> {
  const cookie = iconCookie(base, key)
  const headers: Record<string, string> = { Accept: "image/*" }
  if (cookie) headers.Cookie = cookie
  try {
    const res = await fetch(attempt.url, { method: "GET", headers, timeout: FETCH_TIMEOUT_MS })
    if (res.status === 401) return { path: "", error: "401（网页 Key 不对）" }
    if (res.status === 403) return { path: "", error: "403（网页端不允许这台设备）" }
    if (res.status === 404) return { path: "", error: "404" }
    if (res.status < 200 || res.status >= 300) return { path: "", error: `HTTP ${res.status}` }
    const bytes = await res.bytes()
    if (!bytes || bytes.length === 0 || bytes.length > MAX_ICON_BYTES) return { path: "", error: "空图或超过 1MB" }
    const dir = ensureCacheDir()
    if (!dir) return { path: "", error: "App Group 目录不可写" }
    const path = `${dir}/${attempt.cacheName}`
    // SVG 里的 `currentColor` 在 SVG 视图里不跟随系统，深色桌面上会变成黑底黑图，
    // 下载时就烤成中性灰，之后怎么渲染都看得见。烤不了（Data 不可用）就原样写。
    if (/\.svg$/i.test(attempt.cacheName)) {
      try {
        const text = Data.fromUint8Array(bytes)?.toRawString()
        if (text && text.includes("currentColor")) {
          FileManager.writeAsStringSync(path, sizedSvgText(text.replace(/currentColor/g, "#8E8E93")))
          return { path, error: "" }
        }
        if (text) {
          // 统一给个明确尺寸：渲染时不叠 resizable，靠 svg 自己的 width/height
          FileManager.writeAsStringSync(path, sizedSvgText(text))
          return { path, error: "" }
        }
      } catch {
        // 落到下面的原样写入
      }
    }
    FileManager.writeAsBytesSync(path, bytes)
    return { path, error: "" }
  } catch (e) {
    return { path: "", error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 给卡片补 iconPath：`file:` 的图、以及内联表里没有的内置资源，都从网页端拉一次。
 * 失败留空，由渲染层画 magpie 的 generic 占位，不抛错。
 */
export async function cacheCardIcons(cfg: PanelConfig, cards: PanelCard[]): Promise<IconCacheResult> {
  const result: IconCacheResult = { fetched: 0, failed: 0, error: "" }
  const base = iconBaseOf(cfg)
  if (!base) return result

  const pending = new Map<string, { attempts: IconAttempt[]; cards: PanelCard[] }>()
  for (const card of cards) {
    const attempts = iconAttempts(base, card.icon)
    if (attempts.length === 0) continue
    const hit = attempts.map(a => cachedIconPath(a.cacheName)).find(p => p !== "")
    if (hit) {
      card.iconPath = hit
      continue
    }
    const id = attempts.map(a => a.url).join("|")
    const job = pending.get(id) ?? { attempts, cards: [] }
    job.cards.push(card)
    pending.set(id, job)
  }
  if (pending.size === 0) return result

  await Promise.all(
    [...pending.values()].map(async job => {
      let path = ""
      let error = ""
      for (const attempt of job.attempts) {
        const got = await fetchOne(base, cfg.iconKey, attempt)
        if (got.path) {
          path = got.path
          break
        }
        error = got.error
      }
      if (!path) {
        result.failed++
        if (!result.error) result.error = error
        return
      }
      result.fetched++
      for (const card of job.cards) card.iconPath = path
    })
  )
  return result
}
