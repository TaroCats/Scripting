import { Path, Script } from 'scripting'
import { TranslationKey, t } from './i18n'

/**
 * Hammer (Smartisan OS) icon library.
 *
 * The source project RANH-F/Smartisan-original-launcher publishes one PNG per
 * app at `icons/drawable/<name>.png` and a metadata catalogue describing 4720
 * identities (name, category, aliases, keywords, packages, pinyin). The full
 * catalogue is several megabytes, so a compact derived copy — one row per app:
 * `[iconName, displayName, category, ...searchTerms]` — is bundled with the
 * script as `smartisan_catalog.json` (about 430 KB).
 *
 * Images themselves stay on the mirrors and are cached by the app's normal
 * `cacheAppIcon` pass once an icon is selected, so no PNGs are bundled.
 */

/** Gitee first (fast in CN), GitHub as the canonical fallback. */
const MIRRORS = [
  'https://gitee.com/RANH-F/Smartisan-original-launcher-download/raw/master/icons/drawable/',
  'https://raw.githubusercontent.com/RANH-F/Smartisan-original-launcher/main/icons/drawable/'
]

export function smartisanIconUrl(name: string, mirror = 0): string {
  const base = MIRRORS[Math.min(Math.max(mirror, 0), MIRRORS.length - 1)]
  return `${base}${encodeURIComponent(name)}.png`
}

/** Returns the next mirror for a URL produced by `smartisanIconUrl`, if any. */
export function smartisanFallbackUrl(url: string): string | undefined {
  const index = MIRRORS.findIndex(base => url.startsWith(base))
  if (index < 0 || index + 1 >= MIRRORS.length) return undefined
  const name = decodeURIComponent(url.slice(MIRRORS[index].length, -4))
  return smartisanIconUrl(name, index + 1)
}

export const SMARTISAN_CATEGORIES = [
  'all',
  'social',
  'games',
  'productivity',
  'media',
  'lifestyle',
  'browser',
  'tools',
  'news',
  'education',
  'personalization',
  'travel',
  'shopping',
  'reading',
  'finance',
  'parenting',
  'system',
  'other'
] as const

export type SmartisanCategory = (typeof SMARTISAN_CATEGORIES)[number]

export function categoryLabel(category: string): string {
  const key = `smartisanCat_${category}` as TranslationKey
  const text = t(key)
  return text === key ? t('smartisanCat_other') : text
}

export interface SmartisanIcon {
  /** File base name in `icons/drawable` (with or without package dots). */
  name: string
  /** Human readable label from the catalogue. */
  label: string
  category: string
  terms: string[]
  url: string
}

let catalogCache: SmartisanIcon[] | null = null

/** Loads and parses the bundled catalogue once, then reuses it. */
export function loadSmartisanIcons(): SmartisanIcon[] {
  if (catalogCache) return catalogCache
  catalogCache = []
  try {
    const path = Path.join(Script.directory, 'smartisan_catalog.json')
    if (!FileManager.existsSync(path)) return catalogCache
    const rows = JSON.parse(
      FileManager.readAsStringSync(path)
    ) as string[][]
    catalogCache = rows
      .filter(row => Array.isArray(row) && row.length >= 3)
      .map(row => ({
        name: row[0],
        label: row[1] || row[0],
        category: row[2] || 'other',
        terms: row.slice(3).filter(Boolean),
        url: smartisanIconUrl(row[0])
      }))
  } catch (error) {
    console.error('Failed to load hammer icon catalogue', error)
  }
  return catalogCache
}

/** Bounded cache of the last few filter results, so paging only slices. */
const matchCache = new Map<string, SmartisanIcon[]>()
const MATCH_CACHE_LIMIT = 12

/**
 * Filters the catalogue by an optional free-text query and category. Every
 * whitespace-separated token must appear somewhere in the entry (label,
 * category name, package name, alias, keyword or pinyin), so `微信 社交` and
 * `weixin` both narrow the list as expected. The filtered list is cached, so
 * growing the page only slices an existing array instead of rescanning the
 * whole catalogue on every render.
 */
export function searchSmartisanIcons(
  query: string,
  category: SmartisanCategory,
  limit = 60
): { items: SmartisanIcon[]; total: number } {
  const key = `${category}\u0000${query.trim().toLowerCase()}`
  let matched = matchCache.get(key)
  if (!matched) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const cat = category === 'all' ? '' : category
    matched = []
    for (const icon of loadSmartisanIcons()) {
      if (cat && icon.category !== cat) continue
      if (tokens.length) {
        const haystack = [
          icon.label,
          icon.name,
          icon.category,
          categoryLabel(icon.category)
        ]
          .concat(icon.terms)
          .join(' ')
          .toLowerCase()
        if (!tokens.every(token => haystack.includes(token))) continue
      }
      matched.push(icon)
    }
    if (matchCache.has(key)) matchCache.delete(key)
    matchCache.set(key, matched)
    while (matchCache.size > MATCH_CACHE_LIMIT) {
      const oldest = matchCache.keys().next().value
      if (oldest === undefined) break
      matchCache.delete(oldest)
    }
  }
  return { items: matched.slice(0, limit), total: matched.length }
}
