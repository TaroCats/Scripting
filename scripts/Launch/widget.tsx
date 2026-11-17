import {
  Button,
  Color,
  Divider,
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
  MAX_WIDGET_SLOTS,
  WidgetLayout,
  WidgetPanel,
  WidgetPanelConfig,
  WIDGET_LAYOUT_SLOT_COUNT,
  gridSpecForLayout,
  migrateAppItem,
  normalizeWidgetPanels,
  panelAxisForSize,
  panelCountForFamily,
  parseWidgetParameter,
  resolveIconSource,
  resolveSlotApps,
  resolveWidgetPanels
} from './constants'
import { AppIconArtwork } from './components/AppIconArtwork'
import { OpenAppIntent, RunButtonIntent } from './app_intents'
import { t } from './i18n'

const SECONDARY = 'secondaryLabel' as Color
const WHITE = 'white' as Color
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
  cover
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  cover: boolean
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

  const size = clamp(Math.min(width, height) * 0.44, 40, 112)

  return (
    <VStack
      spacing={10}
      padding={16}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      <Spacer />
      <AppIcon item={app} config={config} size={size} />
      {height > 90 ? <AppLabel name={app.name} /> : null}
      <Spacer />
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
  cover
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  columns: number
  rows: number
  cover: boolean
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
  const padding = clamp(Math.round(scale * 0.045), 4, 16)
  const gap = columnCount > 2 ? clamp(Math.round(scale * 0.028), 3, 10) : clamp(Math.round(scale * 0.04), 4, 14)
  // The icon has to fit both the cell width and the cell height. Without a
  // label it still keeps a small margin so neighbouring icons do not touch.
  const cellWidth =
    (width - padding * 2 - gap * (columnCount - 1)) / columnCount
  const cellHeight = (height - padding * 2 - gap * (rows - 1)) / rows
  const showLabel = rows === 1 && height > 90
  // With a label the icon can use the full remaining height; without one it
  // keeps a small margin so neighbouring rows do not touch.
  const labelAllowance = showLabel ? 22 : cellHeight * 0.06
  const size = clamp(
    Math.min(
      cellWidth * (columnCount > 2 ? 0.8 : 0.82),
      cellHeight - labelAllowance
    ),
    14,
    92
  )

  return (
    <VStack
      spacing={gap}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      <Spacer />
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
      <Spacer />
    </VStack>
  )
}

/** The original flow grid: as many icons as fit, sized from the config. */
function AutoGridLayout({
  apps,
  config,
  width,
  height,
  embedded = false
}: {
  apps: AppItem[]
  config: Config
  width: number
  height: number
  /**
   * Inside a divided widget the grid sits in a narrow panel, so it centres on
   * a fixed spacing instead of stretching its gaps across the whole width.
   */
  embedded?: boolean
}) {
  if (apps.length === 0) return <EmptyState />

  const iconSize = config.iconSize || DEFAULT_CONFIG.iconSize
  const preferredSpacing =
    config.spacing !== undefined ? config.spacing : DEFAULT_CONFIG.spacing

  const totalWidth = width
  const totalHeight = height

  // At most three columns: on a large widget the raw icon-size maths would fit
  // four or more, which shrinks every icon to an unreadable smudge.
  const columns = clamp(
    Math.floor((totalWidth - preferredSpacing) / (iconSize + preferredSpacing)),
    1,
    MAX_GRID_COLUMNS
  )
  const actualSpacing = embedded
    ? clamp(preferredSpacing, 4, Math.max(6, iconSize * 0.5))
    : Math.max(0, (totalWidth - columns * iconSize) / (columns + 1))

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
        top: embedded ? 4 : 16,
        bottom: embedded ? 4 : 16
      }}
      spacing={actualSpacing}
      alignment={embedded ? 'center' : 'leading'}
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
 * A compact folder heading for a panel: the folder's mark and its name, small
 * enough that three of them still leave the icons most of the space.
 */
function PanelHeader({
  folder,
  compact
}: {
  folder: Folder
  compact: boolean
}) {
  return (
    <HStack spacing={compact ? 4 : 6} alignment="center">
      <Image
        systemName={folder.icon || (compact ? 'folder.fill' : 'folder')}
        font={compact ? 9 : 11}
        foregroundStyle={(folder.color ?? 'secondaryLabel') as Color}
      />
      <Text
        font={compact ? 10 : 12}
        fontWeight="semibold"
        foregroundStyle={SECONDARY}
        lineLimit={1}
        truncationMode="tail"
      >
        {folder.name}
      </Text>
    </HStack>
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
  // the heading, icons and gaps all shrink together.
  const slice = vertical ? height / count : width / count
  const compact = count >= 3 || slice < 150

  const padding = compact ? 10 : 12
  const spacing = compact ? 6 : 8
  // The padding frames the whole stack; the dividers and gaps only eat into
  // the axis the panels are stacked along.
  const between = (count - 1) * (spacing + 1)
  const usableWidth = width - padding * 2 - (vertical ? 0 : between)
  const usableHeight = height - padding * 2 - (vertical ? between : 0)
  const panelWidth = vertical ? usableWidth : usableWidth / count
  const panelHeight = vertical ? usableHeight / count : usableHeight

  // The heading sits above the folder content, so the grid gets what is left.
  const headerHeight = compact ? 16 : 20
  const headerSpacing = compact ? 4 : 6
  const contentHeight = Math.max(
    24,
    panelHeight - headerHeight - headerSpacing
  )

  // Size the icons from the smaller panel dimension so a narrow column panel
  // does not end up with oversized icons.
  const base = Math.min(panelWidth, contentHeight)

  /**
   * Resolves a panel's appearance. The folder's own settings win, then the
   * panel's overrides, then the global widget settings, so configuring a
   * folder once applies it everywhere that folder appears.
   */
  const configForPanel = (panel: WidgetPanel): Config => {
    const style = panel.style ?? {}
    const folderStyle = panel.folder.style ?? {}
    return {
      ...config,
      iconSize:
        folderStyle.iconSize ??
        style.iconSize ??
        clamp(Math.round(base * 0.3), 18, 40),
      spacing:
        folderStyle.spacing ??
        style.spacing ??
        (compact ? Math.min(config.spacing, 8) : Math.min(config.spacing, 12)),
      shape: folderStyle.shape ?? style.shape ?? config.shape,
      cornerRadius:
        folderStyle.cornerRadius ?? style.cornerRadius ?? config.cornerRadius,
      widgetAccentedRenderingMode:
        folderStyle.widgetAccentedRenderingMode ??
        style.widgetAccentedRenderingMode ??
        config.widgetAccentedRenderingMode
    }
  }

  const panelViews = panels.map(panel => {
    const panelConfig = configForPanel(panel)
    const layout =
      panel.folder.style?.layout ?? panel.style?.layout ?? 'auto'
    const cover =
      panel.folder.style?.cover ?? panel.style?.cover ?? false
    return (
      <VStack
        key={panel.folder.id}
        spacing={headerSpacing}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        alignment="center"
      >
        <PanelHeader folder={panel.folder} compact={compact} />
        <PanelContent
          panel={panel}
          config={panelConfig}
          layout={layout}
          cover={cover}
          width={panelWidth}
          height={contentHeight}
        />
      </VStack>
    )
  })

  // Interleave separators so the panels read as distinct blocks; a bare gap
  // alone is invisible against the widget background.
  const separated: VirtualNode[] = []
  panelViews.forEach((view, index) => {
    if (index > 0) separated.push(<Divider key={`divider-${index}`} />)
    separated.push(view)
  })

  return vertical ? (
    <VStack
      spacing={spacing}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {separated}
    </VStack>
  ) : (
    <HStack
      spacing={spacing}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {separated}
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
  width,
  height
}: {
  panel: WidgetPanel
  config: Config
  layout: WidgetLayout
  cover: boolean
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
      />
    )
  }

  return (
    <AutoGridLayout
      apps={panel.apps}
      config={config}
      width={width}
      height={height}
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
    widgetPanels: normalizeWidgetPanels(storedConfig.widgetPanels)
  }

  // The widget parameter can name a folder (legacy) or carry `key=value`
  // settings such as `layout=quad&folder=Work`.
  const parameter = parseWidgetParameter(Widget.parameter, folders)

  const { width, height } = Widget.displaySize

  // A large widget divides into two folder panels, the extra-large families
  // into three. Each panel shows one whole folder with that panel's own
  // appearance. The `folders=` parameter picks which folders; otherwise the
  // configured panels are used.
  //
  // Division only kicks in once a panel actually names a folder: without that
  // an existing large widget would lose its own `widgetLayout` arrangement the
  // moment this feature shipped.
  const panelConfigs: WidgetPanelConfig[] | undefined = parameter.folders?.length
    ? parameter.folders.map(folder => ({ folder }))
    : config.widgetPanels
  const divisionRequested = (panelConfigs ?? []).some(
    panel => (panel.folder ?? '').trim() !== ''
  )
  const panelCount = panelCountForFamily(Widget.family)
  if (panelCount > 1 && !parameter.folder && divisionRequested) {
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
      />
    )
  }

  return (
    <AutoGridLayout apps={apps} config={config} width={width} height={height} />
  )
}

Widget.present(<LauncherWidget />)
