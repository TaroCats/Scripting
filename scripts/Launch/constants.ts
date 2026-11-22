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
/**
 * The iCloud shared-data store that holds Launch's durable copy. The data lives
 * in CloudKit (see `CloudSharedData`) instead of in the iCloud Drive folder, so
 * nothing is written into the Files app's iCloud container any more.
 *
 * A store is identified by the UUID handed out when it was created; scripts are
 * pure consumers and cannot create one themselves.
 */
export const CLOUD_STORE_ID = 'D958B1BD-CAED-4771-A2CC-451CFAA017D7'
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
  /**
   * How the folder presents its own apps. `auto` shrinks the icons and the
   * gaps until `maxApps` of them fit; `nine` keeps eight full icons and
   * collects the rest into a ninth, miniature cell. Unset leaves the widget
   * layout above in charge, which is what existing folders keep doing.
   */
  display?: FolderDisplay
  /** `auto` display: the most apps to show. */
  maxApps?: number
}

/**
 * The two ways a folder can present its apps, independent of the widget layout.
 *
 * - `auto`: every app (up to `maxApps`) is shown, the grid scaling itself down
 *   to make room instead of dropping the overflow.
 * - `nine`: the App Library arrangement — eight apps keep a full icon and the
 *   ninth cell holds the remainder as miniature artwork.
 */
export type FolderDisplay = 'auto' | 'nine'

export const FOLDER_DISPLAYS: FolderDisplay[] = ['auto', 'nine']

export function isFolderDisplay(value: string): value is FolderDisplay {
  return (FOLDER_DISPLAYS as string[]).includes(value)
}

/** Bounds for the auto display's "most apps" setting. */
export const MIN_FOLDER_MAX_APPS = 1
export const MAX_FOLDER_MAX_APPS = 30
export const DEFAULT_FOLDER_MAX_APPS = 8

/** Keeps a stored app cap inside the range the settings can express. */
export function clampFolderMaxApps(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_FOLDER_MAX_APPS
  }
  return Math.min(
    MAX_FOLDER_MAX_APPS,
    Math.max(MIN_FOLDER_MAX_APPS, Math.round(value))
  )
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

/**
 * A named widget preset. The widget's configuration parameter names one, which
 * is what lets several Home Screen widgets show different content while the
 * definitions live in the app instead of being retyped per instance.
 *
 * Every appearance field is optional and falls back to the global widget
 * settings, so a profile can pin only the parts that differ.
 */
export interface WidgetProfile extends FolderStyle {
  id: string
  /** The key typed into the widget's parameter field. */
  name: string
  /** Folder name or id to filter the apps by. */
  folder?: string
  /** App ids pinned to the fixed layouts, in slot order. */
  slots?: string[]
  /** Folder names that divide this widget into panels. */
  folders?: string[]
  /**
   * Per-panel folders and appearance for this profile. Newer profiles keep
   * each panel's settings here, so one profile's panels stay independent of
   * the global panel list. `folders` mirrors the folder order for older
   * readers and for parameters typed by hand.
   */
  panels?: WidgetPanelConfig[]
  /** `horizontal` puts the panels side by side instead of along the longer edge. */
  panelAxis?: 'vertical' | 'horizontal'
}

/** The most profiles the app keeps; the widget parameter only needs a name. */
export const MAX_WIDGET_PROFILES = 20

/**
 * Trims stored profiles and drops entries without a name, since the name is
 * what a widget parameter selects a profile by.
 */
export function normalizeWidgetProfiles(profiles?: unknown): WidgetProfile[] {
  const list = Array.isArray(profiles) ? profiles : []
  const next: WidgetProfile[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const profile = entry as WidgetProfile
    const name = (profile.name ?? '').trim()
    if (!name) continue
    const panels =
      Array.isArray(profile.panels) && profile.panels.length > 0
        ? normalizeWidgetPanels(profile.panels)
        : undefined
    next.push({
      id: (profile.id ?? '').trim() || name,
      name,
      folder: (profile.folder ?? '').trim() || undefined,
      slots: Array.isArray(profile.slots)
        ? normalizeWidgetSlots(profile.slots)
        : undefined,
      cover: profile.cover,
      layout:
        profile.layout && isWidgetLayout(profile.layout)
          ? profile.layout
          : undefined,
      align: profile.align,
      iconSize: profile.iconSize,
      spacing: profile.spacing,
      shape: profile.shape,
      cornerRadius: profile.cornerRadius,
      widgetAccentedRenderingMode: profile.widgetAccentedRenderingMode,
      panels,
      folders: panels
        ? panels.map(panel => (panel.folder ?? '').trim())
        : Array.isArray(profile.folders)
          ? profile.folders.map(name => String(name).trim()).filter(Boolean)
          : undefined,
      panelAxis:
        profile.panelAxis === 'horizontal' || profile.panelAxis === 'vertical'
          ? profile.panelAxis
          : undefined
    })
    if (next.length >= MAX_WIDGET_PROFILES) break
  }
  return next
}

/** Finds the profile a widget parameter names, matching its id or its name. */
export function findWidgetProfile(
  profiles: WidgetProfile[] | undefined,
  token: string | undefined
): WidgetProfile | undefined {
  const key = (token ?? '').trim().toLowerCase()
  if (!key) return undefined
  return (profiles ?? []).find(
    profile =>
      profile.id.toLowerCase() === key || profile.name.toLowerCase() === key
  )
}

/** The widget settings a profile stands for. */
export function profileToParameter(
  profile: WidgetProfile
): WidgetParameter {
  const panels = profile.panels
    ? normalizeWidgetPanels(profile.panels)
    : undefined
  return {
    layout: profile.layout,
    folder: profile.folder,
    slots: profile.slots,
    cover: profile.cover,
    folders: panels
      ? panels.map(panel => (panel.folder ?? '').trim())
      : profile.folders,
    panels,
    panelAxis: profile.panelAxis
  }
}

/** The parameter string a widget instance uses to select this profile. */
export function profileParameter(profile: WidgetProfile): string {
  return `profile=${profile.name}`
}

/** A profile seeded from the current global widget settings. */
export function createWidgetProfile(
  name: string,
  config: Config
): WidgetProfile {
  const panels = normalizeWidgetPanels(config.widgetPanels)
  // Seed a profile with the current global panels so it starts as a complete,
  // independent copy. An empty global panel list stays unset, which keeps the
  // profile following the global panels once they are configured.
  const hasPanels = panels.some(panel => (panel.folder ?? '').trim() !== '')
  return {
    id: `profile_${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name,
    layout: config.widgetLayout ?? 'auto',
    slots: normalizeWidgetSlots(config.widgetSlots),
    cover: config.widgetCoverMode ?? false,
    panels: hasPanels ? panels : undefined,
    folders: hasPanels
      ? panels.map(panel => (panel.folder ?? '').trim())
      : undefined
  }
}

/** A free name derived from `base`, so a copy never collides with a sibling. */
export function uniqueProfileName(
  base: string,
  profiles: WidgetProfile[],
  copySuffix = ''
): string {
  const used = new Set(
    profiles.map(profile => profile.name.trim().toLowerCase())
  )
  const wanted = `${base}${copySuffix}`.trim()
  if (!used.has(wanted.toLowerCase())) return wanted
  let index = 2
  let name = `${wanted} ${index}`
  while (used.has(name.toLowerCase())) {
    index += 1
    name = `${wanted} ${index}`
  }
  return name
}

/** A copy of `profile` with a fresh id and a free name. */
export function duplicateWidgetProfile(
  profile: WidgetProfile,
  profiles: WidgetProfile[],
  copySuffix = ''
): WidgetProfile {
  return {
    ...profile,
    id: `profile_${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: uniqueProfileName(profile.name, profiles, copySuffix),
    slots: profile.slots ? [...profile.slots] : undefined,
    panels: profile.panels
      ? profile.panels.map(panel => ({ ...panel }))
      : undefined,
    folders: profile.folders ? [...profile.folders] : undefined
  }
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

/** The most apps the largest fixed layout pins, one per grid cell. */
export const MAX_WIDGET_SLOTS = 9

/** The nine-grid display: eight full icons plus one cell for the overflow. */
export const NINE_GRID_APPS = 8
/** How many miniature icons the overflow cell shows, in a 2 x 2 block. */
export const NINE_GRID_OVERFLOW_PREVIEW = 4

/**
 * Splits a folder's apps for the nine-grid display: the first eight keep a
 * full icon, and everything past them goes into the small ninth cell.
 *
 * A folder that already fits inside the grid is returned whole, so no empty
 * overflow cell appears for a folder of eight or fewer apps.
 */
export function splitNineGrid(apps: AppItem[]): {
  primary: AppItem[]
  overflow: AppItem[]
} {
  if (apps.length <= NINE_GRID_APPS + 1) {
    return { primary: apps, overflow: [] }
  }
  return {
    primary: apps.slice(0, NINE_GRID_APPS),
    overflow: apps.slice(NINE_GRID_APPS)
  }
}

/** The grid a folder's auto display settles on, in points. */
export interface FolderGridFit {
  columns: number
  rows: number
  /** Square icon side length. */
  iconSize: number
  /** Gap between icons, both axes. */
  gap: number
}

/**
 * Picks the grid that shows every app as large as possible.
 *
 * The gap is kept proportional to the icon, so a denser grid simply scales the
 * whole arrangement down instead of letting the gaps eat the cells. Every
 * column count is tried and the one yielding the largest icon wins, which is
 * what makes a wide panel settle on more columns than a tall one.
 */
export function fitFolderGrid(options: {
  count: number
  width: number
  height: number
  maxColumns?: number
  maxIconSize?: number
  /** Gap as a fraction of the icon size. */
  gapRatio?: number
}): FolderGridFit {
  const count = Math.max(1, Math.floor(options.count))
  const width = Math.max(1, options.width)
  const height = Math.max(1, options.height)
  const maxColumns = Math.max(1, Math.floor(options.maxColumns ?? MAX_GRID_COLUMNS))
  const maxIcon = options.maxIconSize ?? 92
  const ratio = options.gapRatio ?? 0.24

  let best: FolderGridFit = {
    columns: 1,
    rows: count,
    iconSize: 1,
    gap: ratio
  }
  let bestScore = -1

  for (let columns = 1; columns <= Math.min(count, maxColumns); columns++) {
    const rows = Math.ceil(count / columns)
    // width  >= icon * (columns + (columns - 1) * ratio)
    const byWidth = width / (columns + (columns - 1) * ratio)
    const byHeight = height / (rows + (rows - 1) * ratio)
    const iconSize = Math.min(byWidth, byHeight, maxIcon)
    // Ties go to the wider grid: two apps read better side by side than
    // stacked, and the icon size is identical either way.
    if (iconSize + 0.0001 < bestScore) continue
    bestScore = iconSize
    // No readability floor here: showing every app is the promise this mode
    // makes, so the grid keeps shrinking instead of letting icons overflow.
    const size = Math.max(1, iconSize)
    best = { columns, rows, iconSize: size, gap: Math.max(1, size) * ratio }
  }

  return best
}

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
 * Whether a widget should divide into folder panels instead of drawing one
 * arrangement.
 *
 * Division needs three things: a widget big enough to hold more than one panel,
 * at least one panel naming a folder, and no whole-widget arrangement pinned by
 * the widget's own configuration. That last rule is what makes the layout picker
 * in a profile actually work: a fixed layout there is an explicit choice for the
 * whole widget, so it outranks the panels, while `auto` leaves room for them.
 */
export function shouldDivideWidget(options: {
  family: string
  /** The layout the widget's parameter or profile pins, if any. */
  layout?: WidgetLayout
  /** Set when the widget shows a single folder, which never divides. */
  folder?: string
  panels: WidgetPanelConfig[] | undefined
}): boolean {
  if (options.folder) return false
  if (panelCountForFamily(options.family) <= 1) return false
  if (options.layout !== undefined && options.layout !== 'auto') return false
  return (options.panels ?? []).some(panel => (panel.folder ?? '').trim() !== '')
}

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
  /**
   * Named presets a widget instance picks up through its parameter, so several
   * Home Screen widgets can each show different content.
   */
  widgetProfiles?: WidgetProfile[]
}

export const DEFAULT_CONFIG: Config = {
  shape: 'rounded',
  iconSize: 50,
  spacing: 15,
  widgetAccentedRenderingMode: 'fullColor',
  widgetLayout: 'auto',
  widgetSlots: [],
  widgetCoverMode: false,
  widgetPanels: [],
  widgetProfiles: []
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
 * Maps a positional folder list onto stored panel configs. A panel keeps its
 * stored appearance only when that entry still points at the same folder, so
 * a list naming other folders never inherits an unrelated panel's style.
 */
export function panelConfigsForFolders(
  tokens: string[],
  globalPanels: WidgetPanelConfig[] | undefined,
  folders: Folder[]
): WidgetPanelConfig[] {
  const base = normalizeWidgetPanels(globalPanels)
  const resolve = (token?: string) =>
    folders.find(entry => entry.id === token || entry.name === token)
  return tokens.map((token, index) => {
    const folder = (token ?? '').trim()
    const stored = base[index] ?? { folder: '' }
    const target = resolve(folder)
    const baseTarget = resolve(stored.folder)
    const same =
      !!folder && !!target && !!baseTarget && target.id === baseTarget.id
    return same ? { ...stored, folder } : { folder }
  })
}

/**
 * The panel list a profile editor works on: the profile's own panel settings
 * when it has them, otherwise its folder list mapped onto the global panels.
 * Always returns one entry per possible panel.
 */
export function profilePanelConfigs(
  profile: WidgetProfile,
  globalPanels: WidgetPanelConfig[] | undefined,
  folders: Folder[]
): WidgetPanelConfig[] {
  if (profile.panels) return normalizeWidgetPanels(profile.panels)
  const tokens = Array.from(
    { length: MAX_WIDGET_PANELS },
    (_unused, index) => (profile.folders?.[index] ?? '').trim()
  )
  return panelConfigsForFolders(tokens, globalPanels, folders)
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
  /**
   * `profile=Work` selects a saved widget profile. Every other field is then
   * inherited from that profile, and keys written next to it override it.
   */
  profile?: string
  layout?: WidgetLayout
  /** Folder name or id to filter the apps by. */
  folder?: string
  /** App ids for the fixed layouts, in slot order. */
  slots?: string[]
  /**
   * Per-panel settings carried by a named profile. This is never parsed from
   * the parameter string: only a profile can supply rich objects.
   */
  panels?: WidgetPanelConfig[]
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
  folders: Folder[] = [],
  profiles: WidgetProfile[] = []
): WidgetParameter {
  // A preview passes the parameter through JSON, which can leave the quotes on.
  const text = widgetParameterText(raw)
  if (!text) return {}

  // A bare value keeps its historical meaning, most specific first: a layout
  // name, then a folder, then a saved profile.
  if (isWidgetLayout(text)) return { layout: text }
  if (folders.some(folder => folder.name === text || folder.id === text)) {
    return { folder: text }
  }
  const bare = findWidgetProfile(profiles, text)
  if (bare) return profileToParameter(bare)

  const fields: WidgetParameter = {}
  let profileName = ''
  // Both ASCII and full-width separators, since the parameter is hand typed.
  for (const part of text.split(/[&;＆；]/)) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (!key || !value) continue

    if (key === 'profile' || key === 'preset' || key === 'config') {
      profileName = value
    } else if (key === 'layout') {
      if (isWidgetLayout(value)) fields.layout = value
    } else if (key === 'folder' || key === 'folderid') {
      fields.folder = value
    } else if (key === 'slots' || key === 'apps') {
      const ids = value
        .split(/[,，]/)
        .map(id => id.trim())
        .filter(Boolean)
      if (ids.length > 0) fields.slots = ids
    } else if (key === 'cover' || key === 'covermode') {
      const cover = parseBoolean(value)
      if (cover !== undefined) fields.cover = cover
    } else if (key === 'folders' || key === 'panels') {
      // Folder names may contain commas only by accident, so an unknown token
      // is ignored by the resolver that follows, not here.
      const names = value
        .split(/[,，]/)
        .map(name => name.trim())
        .filter(Boolean)
      if (names.length > 0) fields.folders = names
    } else if (key === 'panelaxis' || key === 'axis') {
      const word = value.toLowerCase()
      if (word === 'columns' || word === 'horizontal' || word === 'h') {
        fields.panelAxis = 'horizontal'
      } else if (word === 'rows' || word === 'vertical' || word === 'v') {
        fields.panelAxis = 'vertical'
      }
    }
  }

  // A named profile supplies the defaults; keys typed next to it win.
  const profile = profileName
    ? findWidgetProfile(profiles, profileName)
    : undefined
  const parsed: WidgetParameter = profile
    ? profileToParameter(profile)
    : {}
  if (fields.layout) parsed.layout = fields.layout
  if (fields.folder) parsed.folder = fields.folder
  if (fields.slots) parsed.slots = fields.slots
  if (fields.cover !== undefined) parsed.cover = fields.cover
  if (fields.folders) {
    parsed.folders = fields.folders
    // Folders typed next to a profile replace its panel definitions, which
    // also drops the profile's per-panel appearance.
    parsed.panels = undefined
  }
  if (fields.panelAxis) parsed.panelAxis = fields.panelAxis
  return parsed
}

/** Trims a widget parameter and removes the quotes a JSON preview can add. */
export function widgetParameterText(raw: string | undefined): string {
  let text = (raw ?? '').trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim()
  }
  return text
}

/**
 * The profile a widget parameter selects, if any. Mirrors the resolution order
 * of `parseWidgetParameter`: a bare value is a layout, then a folder, then a
 * profile name, and `profile=Name` always names a profile explicitly.
 */
export function profileForParameter(
  raw: string | undefined,
  folders: Folder[] = [],
  profiles: WidgetProfile[] = []
): WidgetProfile | undefined {
  const text = widgetParameterText(raw)
  if (!text) return undefined
  if (isWidgetLayout(text)) return undefined
  if (folders.some(folder => folder.name === text || folder.id === text)) {
    return undefined
  }

  const bare = findWidgetProfile(profiles, text)
  if (bare) return bare

  for (const part of text.split(/[&;＆；]/)) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (!value) continue
    if (key === 'profile' || key === 'preset' || key === 'config') {
      return findWidgetProfile(profiles, value)
    }
  }
  return undefined
}

/** Builds the parameter string shown in Settings and handed to `Widget.preview`. */
export function buildWidgetParameter(
  layout: WidgetLayout,
  folderName?: string,
  cover?: boolean,
  folders?: string[],
  profileName?: string
): string {
  const parts = [`layout=${layout}`]
  if (folderName) parts.push(`folder=${folderName}`)
  if (cover) parts.push('cover=1')
  const names = (folders ?? []).filter(Boolean)
  if (names.length > 0) parts.push(`folders=${names.join(',')}`)
  if (profileName) parts.push(`profile=${profileName}`)
  return parts.join('&')
}

/** The folder names a panel list points at, for the preview parameter. */
export function panelFolderNames(panels: WidgetPanelConfig[]): string[] {
  return panels.map(panel => (panel.folder ?? '').trim()).filter(Boolean)
}

/**
 * The most informative widget size to preview an arrangement in: the fixed
 * grids need the tall widget to show every row, a divided widget needs a large
 * one, and a single app reads best small.
 */
export function previewFamilyForLayout(
  layout: WidgetLayout,
  divided = false
): 'systemSmall' | 'systemMedium' | 'systemLarge' {
  if (divided) return 'systemLarge'
  switch (layout) {
    case 'single':
      return 'systemSmall'
    case 'six':
    case 'nine':
      return 'systemLarge'
    default:
      return 'systemMedium'
  }
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
