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
 * Side length requested for App Store artwork. The search result only carries a
 * 100x100 thumbnail, which looks soft as soon as the widget scales it up;
 * Apple's CDN re-renders any requested size from the master, so ask for a
 * larger square instead.
 */
export const ARTWORK_URL_SIZE = 512

/**
 * Rewrites the trailing size segment of an App Store artwork URL, for example
 * `100x100bb.jpg` to `512x512bb.jpg`. URLs that do not follow the pattern (the
 * GitHub dark-icon assets, or a hand-pasted URL) are returned unchanged, and a
 * missing value stays missing.
 */
export function highResArtworkUrl(
  url?: string,
  size = ARTWORK_URL_SIZE
): string | undefined {
  if (!url) return url
  const match = /^(.*\/)(\d+x\d+)((?:[a-z]{2})?\.(?:jpe?g|png|webp))$/i.exec(url)
  if (!match) return url
  return `${match[1]}${size}x${size}${match[3]}`
}

/** The artwork fields an iTunes search result can carry, largest first. */
export interface ArtworkUrls {
  artworkUrl512?: string
  artworkUrl100?: string
  artworkUrl60?: string
}

/**
 * The sharpest artwork a search response offers, normalised to a large square.
 * `artworkUrl512` is preferred when present; otherwise the smaller thumbnail
 * URL is rewritten to request a larger render from Apple's CDN.
 */
export function pickArtwork(
  app: ArtworkUrls,
  size = ARTWORK_URL_SIZE
): string | undefined {
  return (
    highResArtworkUrl(app.artworkUrl512, size) ||
    highResArtworkUrl(app.artworkUrl100, size) ||
    highResArtworkUrl(app.artworkUrl60, size)
  )
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
  return { ...rest, folderIds, ...upgradeIconArtwork(rest) }
}

/**
 * Bumps a stored 100x100 App Store artwork URL to a larger render. Apps saved
 * before the sharper search were pinned to the thumbnail and stayed soft when
 * the widget scaled them up. The cache key is the URL hash, so a rewritten URL
 * also re-downloads at the new size on the next pass.
 */
function upgradeIconArtwork(item: {
  icon: string
  iconDark?: string
}): { icon: string; iconDark?: string } {
  const icon = highResArtworkUrl(item.icon) ?? item.icon
  const iconDark = item.iconDark
    ? (highResArtworkUrl(item.iconDark) ?? item.iconDark)
    : item.iconDark
  if (icon === item.icon && iconDark === item.iconDark) {
    return { icon: item.icon, iconDark: item.iconDark }
  }
  return { icon, iconDark }
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
  /**
   * Widget arrangement for this folder specifically, so one folder can be a
   * four-grid while another stays on the auto grid.
   */
  layout?: WidgetLayout
  /** Cover presentation flag for this folder's widget. */
  cover?: boolean
  /** Where the content sits inside a divided widget's panel. */
  align?: PanelAlign
}

/**
 * One panel of a divided widget: which folder it shows plus that panel's own
 * appearance. The appearance fields are optional and fall back to the folder's
 * own style, then to the global widget settings.
 */
export interface WidgetPanelConfig extends FolderStyle {
  /** Folder id or name shown in this panel. Empty fills from list order. */
  folder?: string
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
 * - `single` / `dual` / `triple` / `quad` / `six` / `nine`: fixed grids that
 *   scale the icon to the widget and read their apps from the configured slots.
 *
 * The fixed grids never use more than three columns, which is what keeps the
 * icons large enough to read inside a widget.
 */
export type WidgetLayout =
  | 'auto'
  | 'single'
  | 'dual'
  | 'triple'
  | 'quad'
  | 'six'
  | 'nine'

/**
 * Where a panel's content sits along the vertical axis when it does not fill
 * the whole panel. `center` is the default.
 */
export type PanelAlign = 'center' | 'top' | 'bottom'

export const PANEL_ALIGNS: PanelAlign[] = ['center', 'top', 'bottom']

export function isPanelAlign(value: string): value is PanelAlign {
  return (PANEL_ALIGNS as string[]).includes(value)
}

export const WIDGET_LAYOUTS: WidgetLayout[] = [
  'auto',
  'single',
  'dual',
  'triple',
  'quad',
  'six',
  'nine'
]

/** The widest fixed arrangement; the grid layouts are capped at three columns. */
export const MAX_GRID_COLUMNS = 3

/**
 * A panel inside a divided widget is wide and short, so its flow grid may use
 * more columns than the fixed layouts. This is what lets a panel fill its
 * area instead of leaving wide empty margins.
 */
export const MAX_PANEL_COLUMNS = 5

export interface GridSpec {
  columns: number
  rows: number
}

/**
 * The row/column shape of a fixed layout, or `undefined` for the auto grid.
 * Every shape stays within `MAX_GRID_COLUMNS` columns.
 */
export function gridSpecForLayout(
  layout: WidgetLayout
): GridSpec | undefined {
  switch (layout) {
    case 'single':
      return { columns: 1, rows: 1 }
    case 'dual':
      return { columns: 2, rows: 1 }
    case 'triple':
      return { columns: 3, rows: 1 }
    case 'quad':
      return { columns: 2, rows: 2 }
    case 'six':
      return { columns: 3, rows: 2 }
    case 'nine':
      return { columns: 3, rows: 3 }
    default:
      return undefined
  }
}

/** How many apps the largest fixed layout pins, one per grid cell. */
export const MAX_WIDGET_SLOTS = 9

/** How many apps each layout renders. */
export const WIDGET_LAYOUT_SLOT_COUNT: Record<WidgetLayout, number> = {
  auto: MAX_WIDGET_SLOTS,
  single: 1,
  dual: 2,
  triple: 3,
  quad: 4,
  six: 6,
  nine: 9
}

export function isWidgetLayout(value: string): value is WidgetLayout {
  return (WIDGET_LAYOUTS as string[]).includes(value)
}

/**
 * How many folder panels a widget of this family holds.
 *
 * A panel is one whole folder, rendered with that folder's own arrangement, so
 * the count follows the widget size rather than the user's choice: the large
 * widget divides into two, the extra-large families into three, and everything
 * smaller stays whole.
 */
export function panelCountForFamily(family: string): number {
  if (family === 'systemLarge') return 2
  if (family === 'systemExtraLarge' || family === 'systemExtraLargePortrait') {
    return MAX_WIDGET_PANELS
  }
  return 1
}

/** The most panels a widget can be divided into. */
export const MAX_WIDGET_PANELS = 3

/**
 * The axis the panels are laid out along: the longer one, which keeps every
 * panel as close to square as the widget allows. Portrait widgets stack rows,
 * landscape ones sit side by side.
 */
export function panelAxisForSize(
  width: number,
  height: number
): 'vertical' | 'horizontal' {
  return height >= width ? 'vertical' : 'horizontal'
}

/**
 * Pads or trims a panel list to exactly `MAX_WIDGET_PANELS` entries.
 *
 * Also migrates the older format, where a panel was just a folder id string,
 * into the object form that carries per-panel appearance settings.
 */
export function normalizeWidgetPanels(panels?: unknown): WidgetPanelConfig[] {
  const list = Array.isArray(panels) ? panels : []
  const next: WidgetPanelConfig[] = []
  for (let i = 0; i < MAX_WIDGET_PANELS; i++) {
    const entry = list[i]
    if (typeof entry === 'string') {
      next.push({ folder: entry.trim() })
    } else if (entry && typeof entry === 'object') {
      const panel = entry as WidgetPanelConfig
      next.push({
        folder: (panel.folder ?? '').trim(),
        layout: panel.layout,
        iconSize: panel.iconSize,
        spacing: panel.spacing,
        shape: panel.shape,
        cornerRadius: panel.cornerRadius,
        widgetAccentedRenderingMode: panel.widgetAccentedRenderingMode,
        cover: panel.cover,
        align: panel.align
      })
    } else {
      next.push({ folder: '' })
    }
  }
  return next
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
  /**
   * Folders shown side by side when the widget is large enough to divide, in
   * panel order. Each entry carries the folder to show plus that panel's own
   * appearance; an empty entry falls back to the next unused folder. A large
   * widget divides into two panels and the extra-large families into three.
   */
  widgetPanels?: WidgetPanelConfig[]
}

export const DEFAULT_CONFIG: Config = {
  shape: 'rounded',
  iconSize: 50,
  spacing: 15,
  widgetAccentedRenderingMode: 'fullColor',
  widgetLayout: 'auto',
  widgetSlots: [],
  widgetCoverMode: false,
  widgetPanels: []
}

/** Pads or trims a slot list so it always has exactly `MAX_WIDGET_SLOTS` entries. */
export function normalizeWidgetSlots(slots?: string[]): string[] {
  const next: string[] = []
  for (let i = 0; i < MAX_WIDGET_SLOTS; i++) {
    next.push((slots?.[i] ?? '').trim())
  }
  return next
}

/** One folder rendered inside a divided widget. */
export interface WidgetPanel {
  folder: Folder
  apps: AppItem[]
  /** The panel's own appearance overrides, straight from the settings. */
  style: WidgetPanelConfig
}

/**
 * Resolves the folders a divided widget shows, position by position: an
 * explicit entry wins, and every empty entry takes the next folder that has
 * not been used yet. Entries naming a folder that no longer exists are
 * skipped, so deleting a folder empties one panel rather than breaking the
 * widget. At most `count` panels are returned.
 */
export function resolveWidgetPanels(
  folders: Folder[],
  apps: AppItem[],
  configs: WidgetPanelConfig[] | undefined,
  count: number
): WidgetPanel[] {
  if (count <= 0) return []

  const byName = new Map<string, Folder>()
  for (const folder of folders) {
    byName.set(folder.name, folder)
    byName.set(folder.id, folder)
  }

  const styleAt = (index: number): WidgetPanelConfig =>
    configs?.[index] ?? { folder: '' }

  const picked: (Folder | undefined)[] = []
  const used = new Set<string>()

  for (let i = 0; i < count; i++) {
    const folder = byName.get((styleAt(i).folder ?? '').trim())
    if (folder && !used.has(folder.id)) {
      picked.push(folder)
      used.add(folder.id)
    } else {
      picked.push(undefined)
    }
  }

  // Fill the gaps in list order, skipping any folder already placed.
  let cursor = 0
  for (let i = 0; i < count; i++) {
    if (picked[i]) continue
    while (cursor < folders.length && used.has(folders[cursor].id)) cursor++
    if (cursor >= folders.length) break
    picked[i] = folders[cursor]
    used.add(folders[cursor].id)
    cursor++
  }

  const resolved: WidgetPanel[] = []
  picked.forEach((folder, index) => {
    if (!folder) return
    resolved.push({
      folder,
      apps: apps.filter(app => app.folderIds?.includes(folder.id)),
      style: styleAt(index)
    })
  })
  return resolved
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
  /**
   * `folders=Work,Play` splits the widget into panels, one folder each. Only
   * the panels a widget of this size can hold are used.
   */
  folders?: string[]
  /**
   * `panelAxis=columns` puts the panels side by side instead of along the
   * longer edge. Accepts `columns`/`horizontal` or `rows`/`vertical`.
   */
  panelAxis?: 'vertical' | 'horizontal'
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
    } else if (key === 'folders' || key === 'panels') {
      // Folder names may contain commas only by accident, so an unknown token
      // is ignored by the resolver that follows, not here.
      const names = value
        .split(/[,，]/)
        .map(name => name.trim())
        .filter(Boolean)
      if (names.length > 0) parsed.folders = names
    } else if (key === 'panelaxis' || key === 'axis') {
      const word = value.toLowerCase()
      if (word === 'columns' || word === 'horizontal' || word === 'h') {
        parsed.panelAxis = 'horizontal'
      } else if (word === 'rows' || word === 'vertical' || word === 'v') {
        parsed.panelAxis = 'vertical'
      }
    }
  }
  return parsed
}

/** Builds the parameter string shown in Settings and handed to `Widget.preview`. */
export function buildWidgetParameter(
  layout: WidgetLayout,
  folderName?: string,
  cover?: boolean,
  folders?: string[]
): string {
  const parts = [`layout=${layout}`]
  if (folderName) parts.push(`folder=${folderName}`)
  if (cover) parts.push('cover=1')
  const names = (folders ?? []).filter(Boolean)
  if (names.length > 0) parts.push(`folders=${names.join(',')}`)
  return parts.join('&')
}

/** The folder names a panel list points at, for the preview parameter. */
export function panelFolderNames(panels: WidgetPanelConfig[]): string[] {
  return panels.map(panel => (panel.folder ?? '').trim()).filter(Boolean)
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
