import { fetch, Path, Script } from 'scripting'
import type { DynamicImageSource } from 'scripting'

export const BASE_PATH = Path.join(
  FileManager.appGroupDocumentsDirectory,
  Script.name
)
export const FILE_PATH = Path.join(BASE_PATH, 'launcher_apps.json')
export const CONFIG_PATH = Path.join(BASE_PATH, 'launcher_config.json')
export const CACHE_PATH = Path.join(BASE_PATH, 'cache')
export const FOLDERS_PATH = Path.join(BASE_PATH, 'launcher_folders.json')
/** Directory holding the user-authored JS of "button" items, keyed by item id. */
export const BUTTONS_PATH = Path.join(BASE_PATH, 'buttons')
const APP_ICON_ASSETS_BASE_URL =
  'https://raw.githubusercontent.com/Honye/assets/main/AppIcons'

export function getButtonCodePath(id: string) {
  return Path.join(BUTTONS_PATH, `${id}.js`)
}

export function getIconCachePath(url: string) {
  if (!url) return ''
  const hash = Crypto.md5(Data.fromRawString(url)!).toHexString()
  return Path.join(CACHE_PATH, `${hash}.png`)
}

function appIconAssetUrl(bundleId: string, appearance: 'dark' | 'light') {
  return `${APP_ICON_ASSETS_BASE_URL}/${encodeURIComponent(bundleId)}/100x100-${appearance}.jpg`
}

/**
 * Finds the best icon from Honye/assets to use for an app's dark appearance.
 * A real dark variant wins; apps with only a light repository asset use that
 * as the fallback. Missing assets and network failures leave the field empty.
 */
export async function findRepositoryDarkIcon(
  bundleId: string
): Promise<string | undefined> {
  const id = bundleId.trim()
  if (!id) return

  for (const appearance of ['dark', 'light'] as const) {
    const url = appIconAssetUrl(id, appearance)
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 5 })
      if (response.ok) return url
    } catch (error) {
      console.error(`Failed to look up repository icon: ${url}`, error)
      return
    }
  }
}

/**
 * An `Image` source: either a local cache file or a remote URL, single or
 * light/dark. `Image` refuses to mix `filePath` and `imageUrl` in one
 * `DynamicImageSource`, so callers branch on `kind`.
 */
export interface ResolvedIcon {
  kind: 'file' | 'url'
  source: string | DynamicImageSource<string>
}

function cachedFile(icon: string) {
  const path = getIconCachePath(icon)
  return path && FileManager.existsSync(path) ? path : ''
}

/**
 * Resolves an item's icon, preferring the downloaded cache file over the
 * network URL. A dark icon only kicks in once both variants are available in
 * the same form; until then it falls back to the light icon alone, and the
 * next cache pass upgrades it to a pair.
 */
export function resolveIconSource(
  icon: string,
  iconDark?: string
): ResolvedIcon {
  const light = cachedFile(icon)
  const single: ResolvedIcon = light
    ? { kind: 'file', source: light }
    : { kind: 'url', source: icon }

  const dark = iconDark?.trim()
  if (!dark || dark === icon) return single

  const darkFile = cachedFile(dark)
  if (light && darkFile) {
    return { kind: 'file', source: { light, dark: darkFile } }
  }
  if (icon.startsWith('http') && dark.startsWith('http')) {
    return { kind: 'url', source: { light: icon, dark } }
  }
  return single
}

// Migrates legacy single-folder data (folderId) to the multi-folder format (folderIds).
export function migrateAppItem(
  item: AppItem & { folderId?: string }
): AppItem {
  const { folderId, ...rest } = item
  const folderIds = [...(rest.folderIds ?? [])]
  if (folderId && !folderIds.includes(folderId)) {
    folderIds.push(folderId)
  }
  return { ...rest, folderIds }
}

export interface AppItem {
  id: string
  name: string
  icon: string
  /**
   * Icon used in dark mode. Empty falls back to `icon`. Only meaningful for
   * the image-based `iconType`s.
   */
  iconDark?: string
  iconType?: 'symbol' | 'image' | 'transparent_image'
  mode?: 'url' | 'bundleId' | 'script'
  url: string
  bundleId?: string
  /**
   * For `mode === 'script'`: run the JS inside the widget extension when
   * tapped, instead of opening the Scripting app. Defaults to `true`.
   */
  runInWidget?: boolean
  color: string
  /** Folders this app belongs to (an app can be in multiple folders). */
  folderIds?: string[]
}

export interface FolderStyle {
  iconSize?: number
  shape?: 'rounded' | 'circle'
  cornerRadius?: number
  spacing?: number
  widgetAccentedRenderingMode?: Config['widgetAccentedRenderingMode']
}

export interface Folder {
  id: string
  name: string
  icon?: string
  /** Custom folder color (hex string). Falls back to system blue when unset. */
  color?: string
  style?: FolderStyle
}

/**
 * How a widget arranges its apps.
 *
 * - `auto`: the original flow grid, sized from `iconSize` and `spacing`.
 * - `single` / `dual` / `quad`: fixed compositions that scale the icon to the
 *   widget and read their apps from the configured slots.
 */
export type WidgetLayout = 'auto' | 'single' | 'dual' | 'quad'

export const WIDGET_LAYOUTS: WidgetLayout[] = [
  'auto',
  'single',
  'dual',
  'quad'
]

/** The fixed layouts use at most four apps, one per slot. */
export const MAX_WIDGET_SLOTS = 4

/** How many apps each layout renders. */
export const WIDGET_LAYOUT_SLOT_COUNT: Record<WidgetLayout, number> = {
  auto: MAX_WIDGET_SLOTS,
  single: 1,
  dual: 2,
  quad: 4
}

export function isWidgetLayout(value: string): value is WidgetLayout {
  return (WIDGET_LAYOUTS as string[]).includes(value)
}

export interface Config {
  shape: 'rounded' | 'circle'
  iconSize: number
  spacing: number
  widgetAccentedRenderingMode:
    | 'accented'
    | 'desaturated'
    | 'accentedDesaturated'
    | 'fullColor'
  cornerRadius?: number
  /** Layout used by the widget when its parameter does not override it. */
  widgetLayout?: WidgetLayout
  /**
   * App ids pinned to the widget slots, `MAX_WIDGET_SLOTS` entries. An empty
   * string means "fill this slot with the next app in the list".
   */
  widgetSlots?: string[]
  /**
   * Cover presentation for the fixed layouts: each tile is filled with the
   * app's theme colour and shows the logo large, instead of an icon on the
   * widget background.
   */
  widgetCoverMode?: boolean
}

export const DEFAULT_CONFIG: Config = {
  shape: 'rounded',
  iconSize: 50,
  spacing: 15,
  widgetAccentedRenderingMode: 'fullColor',
  widgetLayout: 'auto',
  widgetSlots: [],
  widgetCoverMode: false
}

/** Pads or trims a slot list so it always has exactly `MAX_WIDGET_SLOTS` entries. */
export function normalizeWidgetSlots(slots?: string[]): string[] {
  const next: string[] = []
  for (let i = 0; i < MAX_WIDGET_SLOTS; i++) {
    next.push((slots?.[i] ?? '').trim())
  }
  return next
}

export const DEFAULT_APPS: AppItem[] = [
  {
    id: '1',
    name: 'Scripting',
    icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/44/19/69/441969d8-13c7-7234-01f4-2056b8e28a28/AppIcon-0-0-1x_U007epad-0-1-P3-85-220.png/100x100bb.jpg',
    iconType: 'image',
    mode: 'bundleId',
    url: '',
    bundleId: 'com.scripting.ios',
    color: '#1677FF'
  }
]

/**
 * Settings a widget instance can carry in its configuration parameter.
 *
 * The parameter is a short `key=value` list joined with `&`, for example
 * `layout=quad&folder=Work`. A bare value keeps the pre-layout behaviour: it is
 * either a layout name or a folder name.
 */
export interface WidgetParameter {
  layout?: WidgetLayout
  /** Folder name or id to filter the apps by. */
  folder?: string
  /** App ids for the fixed layouts, in slot order. */
  slots?: string[]
  /** `cover=1` turns on the cover presentation for the fixed layouts. */
  cover?: boolean
}

const TRUE_WORDS = ['1', 'true', 'yes', 'on']
const FALSE_WORDS = ['0', 'false', 'no', 'off']

/** Accepts the usual spellings of a boolean in a hand-typed parameter. */
function parseBoolean(value: string): boolean | undefined {
  const word = value.trim().toLowerCase()
  if (TRUE_WORDS.includes(word)) return true
  if (FALSE_WORDS.includes(word)) return false
  return undefined
}

/**
 * Parses `Widget.parameter`. Unknown keys are ignored so a typo leaves the
 * remaining settings intact instead of breaking the widget.
 */
export function parseWidgetParameter(
  raw: string | undefined,
  folders: Folder[] = []
): WidgetParameter {
  let text = (raw ?? '').trim()
  // A preview passes the parameter through JSON, which can leave the quotes on.
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim()
  }
  if (!text) return {}

  if (isWidgetLayout(text)) return { layout: text }
  if (folders.some(folder => folder.name === text || folder.id === text)) {
    return { folder: text }
  }

  const parsed: WidgetParameter = {}
  // Both ASCII and full-width separators, since the parameter is hand typed.
  for (const part of text.split(/[&;＆；]/)) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (!key || !value) continue

    if (key === 'layout') {
      if (isWidgetLayout(value)) parsed.layout = value
    } else if (key === 'folder' || key === 'folderid') {
      parsed.folder = value
    } else if (key === 'slots' || key === 'apps') {
      const ids = value
        .split(/[,，]/)
        .map(id => id.trim())
        .filter(Boolean)
      if (ids.length > 0) parsed.slots = ids
    } else if (key === 'cover' || key === 'covermode') {
      const cover = parseBoolean(value)
      if (cover !== undefined) parsed.cover = cover
    }
  }
  return parsed
}

/** Builds the parameter string shown in Settings and handed to `Widget.preview`. */
export function buildWidgetParameter(
  layout: WidgetLayout,
  folderName?: string,
  cover?: boolean
): string {
  const parts = [`layout=${layout}`]
  if (folderName) parts.push(`folder=${folderName}`)
  if (cover) parts.push('cover=1')
  return parts.join('&')
}

/**
 * Resolves the apps for a fixed layout, position by position: an explicit slot
 * wins, and every empty slot takes the next app that is not used yet. That way
 * "Default" slots flow around the pinned ones instead of shifting them.
 */
export function resolveSlotApps(
  apps: AppItem[],
  slots: string[] | undefined,
  count: number
): AppItem[] {
  const byId = new Map(apps.map(app => [app.id, app]))
  const picked: (AppItem | undefined)[] = []
  const used = new Set<string>()

  for (let i = 0; i < count; i++) {
    const app = byId.get((slots?.[i] ?? '').trim())
    if (app && !used.has(app.id)) {
      picked.push(app)
      used.add(app.id)
    } else {
      picked.push(undefined)
    }
  }

  let cursor = 0
  for (let i = 0; i < count; i++) {
    if (picked[i]) continue
    while (cursor < apps.length && used.has(apps[cursor].id)) cursor++
    if (cursor >= apps.length) break
    picked[i] = apps[cursor]
    used.add(apps[cursor].id)
    cursor++
  }

  return picked.filter((app): app is AppItem => !!app)
}
