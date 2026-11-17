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
  MAX_WIDGET_SLOTS,
  WidgetLayout,
  WIDGET_LAYOUT_SLOT_COUNT,
  migrateAppItem,
  parseWidgetParameter,
  resolveIconSource,
  resolveSlotApps
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

/** Two apps side by side, each with its name or its own cover. */
function DualAppLayout({
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

  if (cover) {
    const panelWidth = width / 2
    return (
      <HStack
        spacing={0}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      >
        {apps.slice(0, 2).map(app => (
          <AppCover
            key={app.id}
            item={app}
            config={config}
            width={panelWidth}
            height={height}
            logoSize={clamp(Math.min(panelWidth, height) * 0.4, 36, 104)}
            labelFont={12}
            labelPadding={12}
          />
        ))}
      </HStack>
    )
  }

  const padding = 16
  const gap = 16
  const cellWidth = (width - padding * 2 - gap) / 2
  const size = clamp(Math.min(cellWidth * 0.74, height - padding * 2 - 22), 32, 96)

  return (
    <HStack
      spacing={gap}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      {apps.slice(0, 2).map(app => (
        <VStack
          key={app.id}
          spacing={8}
          frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        >
          <Spacer />
          <AppIcon item={app} config={config} size={size} />
          <AppLabel name={app.name} />
          <Spacer />
        </VStack>
      ))}
    </HStack>
  )
}

/** A 2 x 2 grid: a folder of icons, or four adjoining covers. */
function QuadLayout({
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

  if (cover) {
    const panelWidth = width / 2
    const panelHeight = height / 2
    const logoSize = clamp(Math.min(panelWidth, panelHeight) * 0.44, 24, 96)
    const rows = [apps.slice(0, 2), apps.slice(2, 4)].filter(
      row => row.length > 0
    )

    return (
      <VStack
        spacing={0}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        alignment="center"
      >
        <Spacer />
        {rows.map((row, rowIndex) => (
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
              />
            ))}
          </HStack>
        ))}
        <Spacer />
      </VStack>
    )
  }

  const padding = 16
  const gap = 14
  const cell = Math.min(
    (width - padding * 2 - gap) / 2,
    (height - padding * 2 - gap) / 2
  )
  const size = clamp(cell * 0.82, 24, 92)
  const rows = [apps.slice(0, 2), apps.slice(2, 4)]

  return (
    <VStack
      spacing={gap}
      padding={padding}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      alignment="center"
    >
      <Spacer />
      {rows.map((row, rowIndex) => (
        <HStack
          key={rowIndex}
          spacing={gap}
          frame={{ maxWidth: 'infinity' }}
          alignment="center"
        >
          {row.map(app => (
            <AppIcon key={app.id} item={app} config={config} size={size} />
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
  config
}: {
  apps: AppItem[]
  config: Config
}) {
  if (apps.length === 0) return <EmptyState />

  const iconSize = config.iconSize || DEFAULT_CONFIG.iconSize
  const preferredSpacing =
    config.spacing !== undefined ? config.spacing : DEFAULT_CONFIG.spacing

  const totalWidth = Widget.displaySize.width
  const totalHeight = Widget.displaySize.height

  const columns = Math.max(
    1,
    Math.floor((totalWidth - preferredSpacing) / (iconSize + preferredSpacing))
  )
  const actualSpacing = (totalWidth - columns * iconSize) / (columns + 1)

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
      spacing={preferredSpacing}
      alignment="leading"
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

  let config: Config = {
    ...DEFAULT_CONFIG,
    ...(propConfig ?? readJSON<Partial<Config>>(CONFIG_PATH, {}))
  }

  // The widget parameter can name a folder (legacy) or carry `key=value`
  // settings such as `layout=quad&folder=Work`.
  const parameter = parseWidgetParameter(Widget.parameter, folders)

  if (parameter.folder) {
    const folder = folders.find(
      f => f.name === parameter.folder || f.id === parameter.folder
    )
    apps = folder
      ? apps.filter(app => app.folderIds?.includes(folder.id))
      : []

    if (folder?.style) {
      const style = folder.style
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

  const layout: WidgetLayout = parameter.layout ?? config.widgetLayout ?? 'auto'
  const slots = (parameter.slots ?? config.widgetSlots ?? []).slice(
    0,
    MAX_WIDGET_SLOTS
  )
  const slotCount = WIDGET_LAYOUT_SLOT_COUNT[layout]
  const fixedApps = resolveSlotApps(apps, slots, slotCount)
  const cover = parameter.cover ?? config.widgetCoverMode ?? false

  const { width, height } = Widget.displaySize

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
  if (layout === 'dual') {
    return (
      <DualAppLayout
        apps={fixedApps}
        config={config}
        width={width}
        height={height}
        cover={cover}
      />
    )
  }
  if (layout === 'quad') {
    return (
      <QuadLayout
        apps={fixedApps}
        config={config}
        width={width}
        height={height}
        cover={cover}
      />
    )
  }

  return <AutoGridLayout apps={apps} config={config} />
}

Widget.present(<LauncherWidget />)
