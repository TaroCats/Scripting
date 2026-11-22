import {
  Button,
  Color,
  HStack,
  Image,
  Link,
  Rectangle,
  Script,
  Spacer,
  Text,
  VStack,
  VirtualNode,
  ZStack,
  Widget,
  gradient
} from 'scripting'
import {
  AppItem,
  CONFIG_PATH,
  Config,
  DEFAULT_APPS,
  DEFAULT_CONFIG,
  FILE_PATH,
  FOLDERS_PATH,
  Folder,
  MAX_GRID_COLUMNS,
  MAX_PANEL_COLUMNS,
  MAX_WIDGET_SLOTS,
  PanelAlign,
  WidgetLayout,
  WidgetPanel,
  WidgetPanelConfig,
  WIDGET_LAYOUT_SLOT_COUNT,
  gridSpecForLayout,
  migrateAppItem,
  normalizeWidgetPanels,
  normalizeWidgetProfiles,
  panelAxisForSize,
  panelConfigsForFolders,
  panelCountForFamily,
  parseWidgetParameter,
  profileForParameter,
  resolveIconSource,
  resolveSlotApps,
  resolveWidgetPanels,
  shouldDivideWidget
} from './constants'
import { AppIconArtwork } from './components/AppIconArtwork'
import { OpenAppIntent, RunButtonIntent } from './app_intents'
import { t } from './i18n'

const SECONDARY = 'secondaryLabel' as Color
const WHITE = 'white' as Color

/** Margin kept from the edge a panel's content is anchored to. */
const ALIGN_INSET = 10
/** Soft light-to-shadow wash that keeps a flat colour from looking printed. */
const COVER_WASH = gradient('linear', {
  colors: [
    'rgba(255,255,255,0.32)' as Color,
    'rgba(255,255,255,0.04)' as Color,
    'rgba(0,0,0,0.18)' as Color
  ],
  startPoint: 'topLeading',
  endPoint: 'bottomTrailing'
})

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * A widget config plus two flags saying whether the icon size and spacing came
 * from an actual folder/panel setting rather than a computed default. The
 * layouts use them to decide between "respect the user's value" and "fit the
 * available space", which is what makes those settings visibly work.
 */
type RenderConfig = Config & {
  iconSizeSet?: boolean
  spacingSet?: boolean
}

function readJSON<T>(path: string, fallback: T): T {
  try {
    if (!FileManager.existsSync(path)) return fallback
    return JSON.parse(FileManager.readAsStringSync(path)) as T
  } catch (e) {
    console.error(e)
    return fallback
  }
}

/**
 * Wraps item content in the right launch affordance. `frame` is the hit area:
 * the icon square for the flow grid, the whole tile for cover mode.
 *
 * SwiftUI bug: an `Image` using the `desaturated` / `accentedDesaturated`
 * accented rendering modes swallows taps when it is the label of a `Link` or an
 * intent `Button`, so the tap falls through to the widget itself and just opens
 * Scripting. Work around it by keeping the artwork out of the tappable view and
 * overlaying a clear hit target that carries the link/intent.
 */
function TappableItem({
  item,
  config,
  frame,
  children
}: {
  item: AppItem
  config: Config
  frame: { width: number; height: number }
  children: VirtualNode
}) {
  const mode =
    config.widgetAccentedRenderingMode ||
    DEFAULT_CONFIG.widgetAccentedRenderingMode
  const needsOverlayHitTarget =
    mode === 'desaturated' || mode === 'accentedDesaturated'

  const wrap = (content: VirtualNode) => {
    if (item.mode === 'script') {
      // `runInWidget` defaults to true: run the code in place, without leaving
      // the Home Screen.
      return item.runInWidget !== false ? (
        <Button
          intent={RunButtonIntent(item.id)}
          buttonStyle="plain"
          accessibilityLabel={item.name}
        >
          {content}
        </Button>
      ) : (
        <Link
          url={Script.createRunSingleURLScheme(Script.name, {
            buttonId: item.id
          })}
          buttonStyle="plain"
          accessibilityLabel={item.name}
        >
          {content}
        </Link>
      )
    }

    if (item.mode === 'bundleId' && item.bundleId) {
      return (
        <Button
          intent={OpenAppIntent(item.bundleId)}
          buttonStyle="plain"
          accessibilityLabel={item.name}
        >
          {content}
        </Button>
      )
    }

    return (
      <Link url={item.url} buttonStyle="plain" accessibilityLabel={item.name}>
        {content}
      </Link>
    )
  }

  if (!needsOverlayHitTarget) return wrap(children)

  return (
    <ZStack frame={{ width: frame.width, height: frame.height }}>
      {children}
      {wrap(
        <Rectangle
          fill="clear"
          frame={{ width: frame.width, height: frame.height }}
        />
      )}
    </ZStack>
  )
}

function AppIcon({
  item,
  config,
  size
}: {
  item: AppItem
  config?: Config
  size: number
}) {
  // The artwork derives its corner radius from the icon size, so a layout that
  // resizes the icon passes a matching config instead of the global one.
  const iconConfig: Config = {
    ...(config ?? DEFAULT_CONFIG),
    iconSize: size,
    cornerRadius: undefined
  }

  return (
    <TappableItem
      item={item}
      config={config ?? DEFAULT_CONFIG}
      frame={{ width: size, height: size }}
    >
      <AppIconArtwork item={item} config={iconConfig} />
    </TappableItem>
  )
}

/** The app's own mark, enlarged for the cover. */
function CoverLogo({
  item,
  config,
  size
}: {
  item: AppItem
  config: Config
  size: number
}) {
  const mode =
    config.widgetAccentedRenderingMode ||
    DEFAULT_CONFIG.widgetAccentedRenderingMode

  if (item.iconType === 'image') {
    return (
      <ZStack
        shadow={{
          color: 'rgba(0,0,0,0.28)' as Color,
          radius: 12,
          y: 5
        }}
      >
        <AppIconArtwork
          item={item}
          config={{ ...config, iconSize: size, cornerRadius: undefined }}
        />
      </ZStack>
    )
  }

  if (item.iconType === 'transparent_image') {
    const src = resolveIconSource(item.icon, item.iconDark)
    return src.kind === 'file' ? (
      <Image
        filePath={src.source}
        resizable
        scaleToFit
        frame={{ width: size, height: size }}
        widgetAccentedRenderingMode={mode}
      />
    ) : (
      <Image
        imageUrl={src.source}
        resizable
        scaleToFit
        frame={{ width: size, height: size }}
        widgetAccentedRenderingMode={mode}
      />
    )
  }

  return (
    <Image
      systemName={item.icon}
      foregroundStyle={WHITE}
      font={size * 0.82}
      widgetAccentable
      widgetAccentedRenderingMode={mode}
      shadow={{
        color: 'rgba(0,0,0,0.22)' as Color,
        radius: 8,
        y: 3
      }}
    />
  )
}

/**
 * A full-bleed tile: the app colour washes the whole area, the logo sits in the
 * middle and, where there is room, the name is anchored to the bottom leading
 * corner the way a magazine cover sets its title.
 */
function AppCover({
  item,
  config,
  width,
  height,
  logoSize,
  labelFont,
  labelPadding,
  cornerRadius = 0
}: {
  item: AppItem
  config: Config
  width: number
  height: number
  logoSize: number
  labelFont?: number
  labelPadding?: number
  cornerRadius?: number
}) {
  return (
    <TappableItem
      item={item}
      config={config}
      frame={{ width, height }}
    >
      <ZStack
        frame={{ width, height }}
        clipShape={{ type: 'rect', cornerRadius }}
      >
        <Rectangle fill={item.color as Color} />
        <Rectangle fill={COVER_WASH} />
        <CoverLogo item={item} config={config} size={logoSize} />
        {labelFont ? (
          <VStack
            frame={{
              maxWidth: 'infinity',
              maxHeight: 'infinity',
              alignment: 'bottomLeading'
            }}
            padding={labelPadding ?? 14}
          >
            <Text
              font={labelFont}
              fontWeight="semibold"
              foregroundStyle={WHITE}
              lineLimit={1}
              truncationMode="tail"
              shadow={{
                color: 'rgba(0,0,0,0.35)' as Color,
                radius: 6,
                y: 1
              }}
            >
              {item.name}
            </Text>
          </VStack>
        ) : null}
      </ZStack>
    </TappableItem>
  )
}

function EmptyState() {
  return (
    <VStack
      spacing={8}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      <Image systemName="square.grid.2x2" font={24} foregroundStyle={SECONDARY} />
      <Text font={13} foregroundStyle={SECONDARY}>
        {t('widgetNoApps')}
      </Text>
    </VStack>
  )
}

function AppLabel({ name }: { name: string }) {
  return (
    <Text
      font={12}
      lineLimit={1}
      truncationMode="tail"
      padding={{ horizontal: 2 }}
    >
      {name}
    </Text>
  )
}

/** A single, large icon with its name underneath, or one full-bleed cover. */
function SingleAppLayout({
  apps,
  config,
  width,
  height,
  cover,
  flush = false,
  align = 'center'
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  cover: boolean
  /** Drop the outer inset so the icon fills a panel edge to edge. */
  flush?: boolean
  /** Where the icon sits when it does not fill the panel. */
  align?: PanelAlign
}) {
  if (apps.length === 0) return <EmptyState />

  const app = apps[0]

  if (cover) {
    return (
      <AppCover
        item={app}
        config={config}
        width={width}
        height={height}
        logoSize={clamp(Math.min(width, height) * 0.4, 44, 124)}
        labelFont={15}
        labelPadding={16}
      />
    )
  }

  const size = (config as RenderConfig).iconSizeSet
    ? clamp(config.iconSize, 14, 160)
    : clamp(Math.min(width, height) * 0.44, 40, 112)

  // Anchoring to an edge keeps a 10pt margin from it.
  const inset = flush ? 0 : 16
  const padTop = align === 'top' ? Math.max(inset, ALIGN_INSET) : inset
  const padBottom = align === 'bottom' ? Math.max(inset, ALIGN_INSET) : inset

  return (
    <VStack
      spacing={10}
      padding={{ leading: inset, trailing: inset, top: padTop, bottom: padBottom }}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {align !== 'top' ? <Spacer /> : null}
      <AppIcon item={app} config={config} size={size} />
      {height > 90 ? <AppLabel name={app.name} /> : null}
      {align !== 'bottom' ? <Spacer /> : null}
    </VStack>
  )
}

/**
 * A fixed rows x columns grid — two apps side by side, a 2 x 2 folder, a 3 x 3
 * nine-grid and everything in between. The icon is sized from the cell so a
 * denser grid simply yields smaller icons, and the whole grid is centred.
 *
 * In cover mode each cell becomes its own full-bleed tile; otherwise the icons
 * sit on the widget background with their names underneath.
 */
function FixedGridLayout({
  apps,
  config,
  width,
  height,
  columns,
  rows,
  cover,
  flush = false,
  align = 'center'
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  columns: number
  rows: number
  cover: boolean
  /** Drop the outer inset so the grid fills a panel edge to edge. */
  flush?: boolean
  /** Where the rows sit when they do not fill the panel. */
  align?: PanelAlign
}) {
  if (apps.length === 0) return <EmptyState />

  // Defensive: a denser grid than the three-column cap would make the icons
  // unreadable, so clamp it even if a bad layout sneaks through.
  const columnCount = clamp(columns, 1, MAX_GRID_COLUMNS)

  // Never render more cells than there are columns times rows.
  const displayApps = apps.slice(0, columnCount * rows)
  // Only the rows that actually have apps; an empty trailing row is dropped.
  const gridRows: AppItem[][] = []
  for (let i = 0; i < displayApps.length; i += columnCount) {
    gridRows.push(displayApps.slice(i, i + columnCount))
  }

  if (cover) {
    const panelWidth = width / columnCount
    const panelHeight = height / rows
    const logoSize = clamp(
      Math.min(panelWidth, panelHeight) * (columnCount > 2 ? 0.4 : 0.44),
      20,
      96
    )
    // A single row has room for the name under each logo; stacked rows do not.
    const coverLabelFont = rows === 1 ? (columnCount > 2 ? 11 : 12) : undefined
    // Covers tile edge to edge, so a partially filled row is centred rather
    // than left-aligned to keep the composition balanced.
    return (
      <VStack
        spacing={0}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        alignment="center"
      >
        <Spacer />
        {gridRows.map((row, rowIndex) => (
          <HStack
            key={rowIndex}
            spacing={0}
            frame={{ maxWidth: 'infinity' }}
            alignment="center"
          >
            {row.map(app => (
              <AppCover
                key={app.id}
                item={app}
                config={config}
                width={panelWidth}
                height={panelHeight}
                logoSize={logoSize}
                labelFont={coverLabelFont}
                labelPadding={coverLabelFont ? 12 : undefined}
              />
            ))}
          </HStack>
        ))}
        <Spacer />
      </VStack>
    )
  }

  // A panel is much smaller than the widget, so the inset and the gaps shrink
  // with it instead of eating most of the cell.
  const scale = Math.min(width, height)
  const inset = flush ? 0 : clamp(Math.round(scale * 0.045), 4, 16)
  // Anchoring to an edge keeps a 10pt margin from it.
  const padTop = align === 'top' ? Math.max(inset, ALIGN_INSET) : inset
  const padBottom = align === 'bottom' ? Math.max(inset, ALIGN_INSET) : inset
  const render = config as RenderConfig
  const gap = render.spacingSet
    ? clamp(config.spacing, 0, 40)
    : columnCount > 2
      ? clamp(Math.round(scale * 0.028), 3, 10)
      : clamp(Math.round(scale * 0.04), 4, 14)
  // The icon has to fit both the cell width and the cell height. Without a
  // label it still keeps a small margin so neighbouring icons do not touch.
  const cellWidth =
    (width - inset * 2 - gap * (columnCount - 1)) / columnCount
  const cellHeight = (height - padTop - padBottom - gap * (rows - 1)) / rows
  const showLabel = rows === 1 && height > 90
  // With a label the icon can use the full remaining height; without one it
  // keeps a small margin so neighbouring rows do not touch.
  const labelAllowance = showLabel ? 22 : cellHeight * 0.06
  const cellSize = clamp(
    Math.min(
      cellWidth * (columnCount > 2 ? 0.8 : 0.82),
      cellHeight - labelAllowance
    ),
    14,
    92
  )
  // An explicit icon size caps the cell fit, so changing it has a visible
  // effect instead of being swallowed by the fill-the-cell maths.
  const size = render.iconSizeSet
    ? clamp(Math.min(cellSize, config.iconSize), 14, 92)
    : cellSize

  return (
    <VStack
      spacing={gap}
      padding={{
        leading: inset,
        trailing: inset,
        top: padTop,
        bottom: padBottom
      }}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {align !== 'top' ? <Spacer /> : null}
      {gridRows.map((row, rowIndex) => (
        <HStack
          key={rowIndex}
          spacing={gap}
          frame={{ maxWidth: 'infinity' }}
          alignment="center"
        >
          {row.map(app => (
            <VStack key={app.id} spacing={6} alignment="center">
              <AppIcon item={app} config={config} size={size} />
              {showLabel ? <AppLabel name={app.name} /> : null}
            </VStack>
          ))}
        </HStack>
      ))}
      {align !== 'bottom' ? <Spacer /> : null}
    </VStack>
  )
}

/** The original flow grid: as many icons as fit, sized from the config. */
function AutoGridLayout({
  apps,
  config,
  width,
  height,
  embedded = false,
  align = 'center'
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  /** Where the rows sit when they do not fill the panel. */
  align?: PanelAlign
  /**
   * Inside a divided widget the grid fills its panel edge to edge: no outer
   * padding, and the leftover space becomes equal gaps on both axes.
   */
  embedded?: boolean
}) {
  if (apps.length === 0) return <EmptyState />

  const iconSize = config.iconSize || DEFAULT_CONFIG.iconSize
  const preferredSpacing =
    config.spacing !== undefined ? config.spacing : DEFAULT_CONFIG.spacing

  const totalWidth = width
  const totalHeight = height

  if (embedded) {
    const render = config as RenderConfig
    // When the user configured the icon size or the spacing, take those
    // literally and centre the result. Otherwise pick a minimum gap and widen
    // it so the grid spans the panel exactly.
    const explicit = render.iconSizeSet === true || render.spacingSet === true
    const gap = render.spacingSet
      ? clamp(preferredSpacing, 0, 40)
      : Math.max(2, Math.min(preferredSpacing, Math.round(iconSize * 0.35)))

    // Anchoring to an edge keeps a 10pt margin from it, so that margin is
    // taken out of the height the grid is fitted into.
    const edge = align === 'center' ? 0 : ALIGN_INSET
    const availHeight = totalHeight - edge

    const columns = clamp(
      Math.floor((totalWidth + gap) / (iconSize + gap)),
      1,
      MAX_PANEL_COLUMNS
    )
    const rowsThatFit = Math.max(
      1,
      Math.floor((availHeight + gap) / (iconSize + gap))
    )
    const shown = apps.slice(0, columns * rowsThatFit)
    const rowCount = Math.max(1, Math.ceil(shown.length / columns))
    const gapX = explicit
      ? gap
      : Math.max(0, (totalWidth - columns * iconSize) / (columns + 1))
    const gapY = explicit
      ? gap
      : Math.max(0, (availHeight - rowCount * iconSize) / (rowCount + 1))
    const padTop = align === 'top' ? ALIGN_INSET : explicit ? 0 : gapY
    const padBottom = align === 'bottom' ? ALIGN_INSET : explicit ? 0 : gapY

    const rowGroups: AppItem[][] = []
    for (let i = 0; i < shown.length; i += columns) {
      rowGroups.push(shown.slice(i, i + columns))
    }

    return (
      <VStack
        padding={{
          leading: gapX,
          trailing: gapX,
          top: padTop,
          bottom: padBottom
        }}
        spacing={gapY}
        frame={{ width: totalWidth, height: totalHeight }}
        alignment="center"
      >
        {align !== 'top' ? <Spacer /> : null}
        {rowGroups.map((row, rowIndex) => (
          <HStack key={rowIndex} spacing={gapX} alignment="center">
            {row.map(item => (
              <AppIcon key={item.id} item={item} config={config} size={iconSize} />
            ))}
          </HStack>
        ))}
        {align !== 'bottom' ? <Spacer /> : null}
      </VStack>
    )
  }

  // At most three columns for the whole widget.
  const columns = clamp(
    Math.floor((totalWidth - preferredSpacing) / (iconSize + preferredSpacing)),
    1,
    MAX_GRID_COLUMNS
  )
  // Distribute the leftover width as gaps so the row spans the widget evenly.
  const actualSpacing = Math.max(
    0,
    (totalWidth - columns * iconSize) / (columns + 1)
  )

  const rowCount = Math.max(
    1,
    Math.floor(
      (totalHeight - 32 + preferredSpacing) / (iconSize + preferredSpacing)
    )
  )
  const maxItems = columns * rowCount
  const displayApps = apps.slice(0, maxItems)

  const rows: AppItem[][] = []
  for (let i = 0; i < displayApps.length; i += columns) {
    rows.push(displayApps.slice(i, i + columns))
  }

  return (
    <VStack
      padding={{
        leading: actualSpacing,
        trailing: actualSpacing,
        top: 16,
        bottom: 16
      }}
      spacing={actualSpacing}
      alignment="leading"
      frame={{ width, height }}
    >
      <Spacer />
      {rows.map((row, rowIndex) => (
        <HStack key={rowIndex} spacing={actualSpacing}>
          {row.map(item => (
            <AppIcon key={item.id} item={item} config={config} size={iconSize} />
          ))}
        </HStack>
      ))}
      <Spacer />
    </VStack>
  )
}

/**
 * A widget divided into equal panels, one whole folder each. This is what makes
 * a large widget show two folders and the extra-large families three, without
 * forcing the folders themselves onto a specific arrangement: every panel
 * renders its folder with that folder's own layout.
 */
function PaneledLayout({
  panels,
  config,
  width,
  height,
  axis
}: {
  panels: WidgetPanel[]
  config: Config
  width: number
  height: number
  axis: 'vertical' | 'horizontal'
}) {
  if (panels.length === 0) return <EmptyState />

  const vertical = axis === 'vertical'
  const count = panels.length

  // Three panels are tight, and so is any panel shorter than about 150pt, so
  // the icons and gaps all shrink together.
  const slice = vertical ? height / count : width / count
  const compact = count >= 3 || slice < 150

  // Panels fill the widget edge to edge: no gap, no divider, no outer padding,
  // so the whole surface is used by the folders themselves.
  const padding = 0
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const panelWidth = vertical ? usableWidth : usableWidth / count
  const panelHeight = vertical ? usableHeight / count : usableHeight

  // No folder heading: each panel hands its whole area to the folder's icons.
  const contentHeight = Math.max(24, panelHeight)

  // Size the icons from the smaller panel dimension so a narrow column panel
  // does not end up with oversized icons.
  const base = Math.min(panelWidth, contentHeight)

  /**
   * Resolves a panel's appearance. The panel's own settings are the most
   * specific choice, so they win; the folder's shared style is the fallback
   * for everything a panel leaves unset.
   */
  const configForPanel = (panel: WidgetPanel): RenderConfig => {
    const style = panel.style ?? {}
    const folderStyle = panel.folder.style ?? {}
    const explicitIconSize = style.iconSize ?? folderStyle.iconSize
    const explicitSpacing = style.spacing ?? folderStyle.spacing
    return {
      ...config,
      iconSize: explicitIconSize ?? clamp(Math.round(base * 0.3), 18, 40),
      spacing:
        explicitSpacing ??
        (compact ? Math.min(config.spacing, 8) : Math.min(config.spacing, 12)),
      iconSizeSet: explicitIconSize !== undefined,
      spacingSet: explicitSpacing !== undefined,
      shape: style.shape ?? folderStyle.shape ?? config.shape,
      cornerRadius:
        style.cornerRadius ?? folderStyle.cornerRadius ?? config.cornerRadius,
      widgetAccentedRenderingMode:
        style.widgetAccentedRenderingMode ??
        folderStyle.widgetAccentedRenderingMode ??
        config.widgetAccentedRenderingMode
    }
  }

  const panelViews = panels.map(panel => {
    const panelConfig = configForPanel(panel)
    const layout = panel.style?.layout ?? panel.folder.style?.layout ?? 'auto'
    // Cover is a per-region choice: the panel's own setting, then the
    // folder's shared default. A whole-widget cover switch is not involved,
    // so every region can be switched independently.
    const cover =
      panel.style?.cover ?? panel.folder.style?.cover ?? false
    const align =
      panel.style?.align ?? panel.folder.style?.align ?? 'center'
    // A definite frame per panel, so the grid's spacers can actually divide
    // the slice instead of collapsing to the content's intrinsic height.
    return (
      <VStack
        key={panel.folder.id}
        spacing={0}
        frame={{ width: panelWidth, height: contentHeight }}
        alignment="center"
      >
        <PanelContent
          panel={panel}
          config={panelConfig}
          layout={layout}
          cover={cover}
          align={align}
          width={panelWidth}
          height={contentHeight}
        />
      </VStack>
    )
  })

  return vertical ? (
    <VStack
      spacing={0}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {panelViews}
    </VStack>
  ) : (
    <HStack
      spacing={0}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {panelViews}
    </HStack>
  )
}

/**
 * Renders one folder inside a panel with the arrangement the panel asks for.
 * The layout and cover flag arrive pre-resolved from the panel settings.
 */
function PanelContent({
  panel,
  config,
  layout,
  cover,
  align,
  width,
  height
}: {
  panel: WidgetPanel
  config: Config
  layout: WidgetLayout
  cover: boolean
  align: PanelAlign
  width: number
  height: number
}) {
  if (layout === 'single') {
    return (
      <SingleAppLayout
        apps={panel.apps}
        config={config}
        width={width}
        height={height}
        cover={cover}
        align={align}
        flush
      />
    )
  }

  const spec = gridSpecForLayout(layout)
  if (spec) {
    return (
      <FixedGridLayout
        apps={panel.apps}
        config={config}
        width={width}
        height={height}
        columns={spec.columns}
        rows={spec.rows}
        cover={cover}
        align={align}
        flush
      />
    )
  }

  return (
    <AutoGridLayout
      apps={panel.apps}
      config={config}
      width={width}
      height={height}
      align={align}
      embedded
    />
  )
}

export function LauncherWidget({
  apps: propApps,
  config: propConfig
}: {
  apps?: AppItem[]
  config?: Config
}) {
  const folders = readJSON<Folder[]>(FOLDERS_PATH, [])
  let apps: AppItem[] = (
    propApps ?? readJSON<AppItem[]>(FILE_PATH, DEFAULT_APPS)
  ).map(migrateAppItem)

  const storedConfig: Partial<Config> =
    propConfig ?? readJSON<Partial<Config>>(CONFIG_PATH, {})

  let config: Config = {
    ...DEFAULT_CONFIG,
    ...storedConfig,
    // The panel list is stored as objects now; older files held bare folder
    // ids, so normalise before anything reads it.
    widgetPanels: normalizeWidgetPanels(storedConfig.widgetPanels),
    widgetProfiles: normalizeWidgetProfiles(storedConfig.widgetProfiles)
  }

  // The parameter can name a saved profile (or a folder, or a layout), and it
  // can carry `key=value` settings such as `layout=quad&folder=Work`.
  const profiles = config.widgetProfiles ?? []
  const parameter = parseWidgetParameter(Widget.parameter, folders, profiles)
  const profile = profileForParameter(Widget.parameter, folders, profiles)

  // A profile only pins the parts that differ from the global widget settings.
  if (profile) {
    config = {
      ...config,
      iconSize: profile.iconSize ?? config.iconSize,
      spacing: profile.spacing ?? config.spacing,
      shape: profile.shape ?? config.shape,
      cornerRadius: profile.cornerRadius ?? config.cornerRadius,
      widgetAccentedRenderingMode:
        profile.widgetAccentedRenderingMode ??
        config.widgetAccentedRenderingMode,
      // An icon size the profile asks for is a real choice, so the layouts must
      // honour it instead of fitting the cell.
      iconSizeSet: profile.iconSize !== undefined,
      spacingSet: profile.spacing !== undefined
    } as Config
  }

  const align: PanelAlign = profile?.align ?? 'center'

  const { width, height } = Widget.displaySize

  // A large widget divides into two folder panels, the extra-large families
  // into three. Each panel shows one whole folder with that panel's own
  // appearance. The `folders=` parameter picks which folders; otherwise the
  // configured panels are used.
  //
  // A whole-widget arrangement pinned by the profile, the parameter or the
  // global default wins over the panels — otherwise changing the layout in
  // a profile or in the widget defaults would silently do nothing. `layout=auto`
  // still leaves room for the panels.
  //
  // A profile that stores its own panels wins over everything global, so each
  // widget profile can configure its regions independently. A plain `folders=`
  // list only overrides WHICH folders each panel shows; a stored global
  // panel's appearance is carried over only when that panel still names the
  // same folder, so a list naming other folders never inherits an unrelated
  // panel's cover or layout.
  const requestedLayout: WidgetLayout =
    parameter.layout ?? config.widgetLayout ?? 'auto'
  const profilePanels = parameter.panels?.length
    ? normalizeWidgetPanels(parameter.panels)
    : undefined
  const panelConfigs: WidgetPanelConfig[] | undefined = profilePanels
    ? profilePanels
    : parameter.folders?.length
      ? panelConfigsForFolders(parameter.folders, config.widgetPanels, folders)
      : config.widgetPanels
  const panelCount = panelCountForFamily(Widget.family)
  if (
    shouldDivideWidget({
      family: Widget.family,
      layout: requestedLayout,
      folder: parameter.folder,
      panels: panelConfigs
    })
  ) {
    const panels = resolveWidgetPanels(
      folders,
      apps,
      panelConfigs,
      panelCount
    )
    if (panels.length > 1) {
      return (
        <PaneledLayout
          panels={panels}
          config={config}
          width={width}
          height={height}
          axis={parameter.panelAxis ?? panelAxisForSize(width, height)}
        />
      )
    }
  }

  let folderLayout: WidgetLayout | undefined
  let folderCover: boolean | undefined

  if (parameter.folder) {
    const folder = folders.find(
      f => f.name === parameter.folder || f.id === parameter.folder
    )
    apps = folder
      ? apps.filter(app => app.folderIds?.includes(folder.id))
      : []

    if (folder?.style) {
      const style = folder.style
      folderLayout = style.layout
      folderCover = style.cover
      config = {
        ...config,
        iconSize: style.iconSize ?? config.iconSize,
        shape: style.shape ?? config.shape,
        cornerRadius: style.cornerRadius ?? config.cornerRadius,
        spacing: style.spacing ?? config.spacing,
        widgetAccentedRenderingMode:
          style.widgetAccentedRenderingMode ??
          config.widgetAccentedRenderingMode
      }
    }
  }

  // The widget parameter wins over the folder's own layout, which in turn
  // wins over the global default.
  const layout: WidgetLayout =
    parameter.layout ?? folderLayout ?? config.widgetLayout ?? 'auto'
  const slots = (parameter.slots ?? config.widgetSlots ?? []).slice(
    0,
    MAX_WIDGET_SLOTS
  )
  const slotCount = WIDGET_LAYOUT_SLOT_COUNT[layout]
  const fixedApps = resolveSlotApps(apps, slots, slotCount)
  const cover = parameter.cover ?? folderCover ?? config.widgetCoverMode ?? false

  if (layout === 'single') {
    return (
      <SingleAppLayout
        apps={fixedApps}
        config={config}
        width={width}
        height={height}
        cover={cover}
        align={align}
      />
    )
  }

  const spec = gridSpecForLayout(layout)
  if (spec) {
    return (
      <FixedGridLayout
        apps={fixedApps}
        config={config}
        width={width}
        height={height}
        columns={spec.columns}
        rows={spec.rows}
        cover={cover}
        align={align}
      />
    )
  }

  return (
    <AutoGridLayout apps={apps} config={config} width={width} height={height} />
  )
}

Widget.present(<LauncherWidget />)
