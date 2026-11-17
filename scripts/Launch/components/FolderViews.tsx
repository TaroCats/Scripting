import {
  Button,
  Color,
  ColorPicker,
  ContentUnavailableView,
  EditButton,
  ForEach,
  Form,
  GeometryReader,
  HStack,
  Image,
  LazyVGrid,
  List,
  Navigation,
  NavigationLink,
  Picker,
  RoundedRectangle,
  Section,
  Spacer,
  Stepper,
  Text,
  TextField,
  Toggle,
  VStack,
  ZStack,
  useEffect,
  useObservable,
  useState
} from 'scripting'
import {
  AppItem,
  Config,
  DEFAULT_CONFIG,
  Folder,
  FolderStyle,
  MAX_GRID_COLUMNS,
  WidgetLayout,
  gridSpecForLayout
} from '../constants'
import { AppIconArtwork } from './AppIconArtwork'
import { AppEditor } from './AppEditor'
import {
  AppIconView,
  AppRow,
  FolderIconView,
  filterApps
} from './SharedViews'
import { t, useI18n } from '../i18n'

export const FOLDER_PREVIEW_RADIUS = 22
const FOLDER_LABEL_HORIZONTAL_INSET = 10

export function FolderNameEditor({
  folder,
  onSave
}: {
  folder?: Folder
  onSave: (name: string, icon?: string, color?: string) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(folder?.name ?? '')
  const [icon, setIcon] = useState(folder?.icon ?? '')
  const [color, setColor] = useState<Color>(
    (folder?.color ?? '#007AFF') as Color
  )
  const dismiss = Navigation.useDismiss()

  return (
    <Form
      navigationTitle={folder ? t('renameFolder') : t('newFolder')}
      toolbar={{
        confirmationAction: [
          <Button
            key="save"
            title={t('save')}
            systemImage="checkmark"
            disabled={!name.trim()}
            action={() => {
              if (name.trim()) {
                onSave(
                  name.trim(),
                  icon.trim() || undefined,
                  color as unknown as string
                )
                dismiss()
              }
            }}
          />
        ]
      }}
    >
      <Section>
        <TextField
          title={t('folderName')}
          value={name}
          onChanged={setName}
        />
      </Section>
      <Section
        header={<Text>{t('appearance')}</Text>}
        footer={<Text>{t('folderIconFooter')}</Text>}
      >
        <HStack>
          <Text>{t('iconSfSymbolLabel')}</Text>
          <TextField
            title=""
            prompt={t('optional')}
            value={icon}
            onChanged={setIcon}
          />
          <FolderIconView icon={icon} color={color as unknown as string} />
        </HStack>
        <ColorPicker value={color} onChanged={setColor}>
          <Text>{t('folderColor')}</Text>
        </ColorPicker>
      </Section>
    </Form>
  )
}

function AddExistingAppView({
  apps,
  onAdd
}: {
  apps: AppItem[]
  onAdd: (items: AppItem[]) => void
}) {
  const { t } = useI18n()
  const dismiss = Navigation.useDismiss()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')

  function toggle(id: string) {
    setSelected(prev => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = true
      }
      return next
    })
  }

  const selectedItems = apps.filter(app => selected[app.id])
  const visible = filterApps(apps, query)

  return (
    <List
      navigationTitle={t('addApps')}
      searchable={{
        value: query,
        onChanged: setQuery,
        prompt: t('searchApps')
      }}
      overlay={
        visible.length === 0 ? (
          <ContentUnavailableView
            title={t('noResults')}
            systemImage="magnifyingglass"
          />
        ) : undefined
      }
      toolbar={{
        topBarTrailing: [
          <Button
            key="add"
            title={
              selectedItems.length > 0
                ? `${t('add')} (${selectedItems.length})`
                : t('add')
            }
            action={() => {
              if (selectedItems.length === 0) return
              onAdd(selectedItems)
              dismiss()
            }}
          />
        ]
      }}
    >
      <Section
        footer={<Text>{t('addAppsFooter')}</Text>}
      >
        {visible.map(item => {
          const isSelected = !!selected[item.id]
          return (
            <Button
              key={item.id}
              action={() => toggle(item.id)}
              buttonStyle="plain"
            >
              <HStack>
                <AppIconView
                  icon={item.icon}
                  iconDark={item.iconDark}
                  iconType={item.iconType}
                  color={item.color}
                />
                <Text font={16}>{item.name}</Text>
                <Spacer />
                <Image
                  systemName={
                    isSelected ? 'checkmark.circle.fill' : 'circle'
                  }
                  foregroundStyle={
                    (isSelected ? 'systemBlue' : 'systemGray') as Color
                  }
                />
              </HStack>
            </Button>
          )
        })}
      </Section>
    </List>
  )
}

function FolderSettingsView({
  folder,
  onUpdateFolderStyle
}: {
  folder: Folder
  onUpdateFolderStyle: (id: string, style: FolderStyle | undefined) => void
}) {
  const { t } = useI18n()
  const [customize, setCustomize] = useState(
    !!folder.style && Object.keys(folder.style).length > 0
  )
  const [folderStyle, setFolderStyle] = useState<FolderStyle>(
    folder.style ?? {}
  )

  function updateStyle(patch: Partial<FolderStyle>) {
    const next = { ...folderStyle, ...patch }
    setFolderStyle(next)
    onUpdateFolderStyle(folder.id, Object.keys(next).length > 0 ? next : undefined)
  }

  function setCustomized(value: boolean) {
    setCustomize(value)
    if (value) {
      setFolderStyle(folder.style ?? {})
    } else {
      onUpdateFolderStyle(folder.id, undefined)
    }
  }

  return (
    <Form navigationTitle={t('folderSettings')}>
      <Section>
        <Toggle
          title={t('customizeFolder')}
          value={customize}
          onChanged={setCustomized}
        />
      </Section>
      {customize && (
        <Section
          header={<Text>{t('widget')}</Text>}
          footer={<Text>{t('folderWidgetLayoutFooter')}</Text>}
        >
          <Picker
            title={t('folderWidgetLayout')}
            value={folderStyle.layout ?? 'auto'}
            onChanged={(value: string) =>
              updateStyle({ layout: value as WidgetLayout })
            }
          >
            <Text tag="auto">{t('widgetLayoutAuto')}</Text>
            <Text tag="single">{t('widgetLayoutSingle')}</Text>
            <Text tag="dual">{t('widgetLayoutDual')}</Text>
            <Text tag="triple">{t('widgetLayoutTriple')}</Text>
            <Text tag="quad">{t('widgetLayoutQuad')}</Text>
            <Text tag="six">{t('widgetLayoutSix')}</Text>
            <Text tag="nine">{t('widgetLayoutNine')}</Text>
          </Picker>
          <Toggle
            title={t('folderWidgetCover')}
            systemImage="rectangle.inset.filled"
            value={folderStyle.cover ?? false}
            onChanged={(value: boolean) => updateStyle({ cover: value })}
          />
        </Section>
      )}
      {customize && (
        <Section header={<Text>{t('appearance')}</Text>}>
          <Stepper
            onIncrement={() => {
              const value =
                (folderStyle.iconSize ?? DEFAULT_CONFIG.iconSize) + 1
              if (value <= 100) updateStyle({ iconSize: value })
            }}
            onDecrement={() => {
              const value =
                (folderStyle.iconSize ?? DEFAULT_CONFIG.iconSize) - 1
              if (value >= 20) updateStyle({ iconSize: value })
            }}
          >
            <HStack>
              <Text>{t('iconSize')}</Text>
              <Spacer />
              <Text opacity={0.5}>
                {(folderStyle.iconSize ?? DEFAULT_CONFIG.iconSize).toString()}
              </Text>
            </HStack>
          </Stepper>
          <Picker
            title={t('iconShape')}
            value={folderStyle.shape ?? DEFAULT_CONFIG.shape}
            onChanged={(value: string) =>
              updateStyle({ shape: value as 'rounded' | 'circle' })
            }
          >
            <Text tag="rounded">{t('shapeRounded')}</Text>
            <Text tag="circle">{t('shapeCircle')}</Text>
          </Picker>
          {(folderStyle.shape ?? DEFAULT_CONFIG.shape) === 'rounded' && (
            <Stepper
              onIncrement={() => {
                const base =
                  folderStyle.cornerRadius ?? DEFAULT_CONFIG.iconSize * 0.225
                const value = base + 1
                if (value <= 50) updateStyle({ cornerRadius: value })
              }}
              onDecrement={() => {
                const base =
                  folderStyle.cornerRadius ?? DEFAULT_CONFIG.iconSize * 0.225
                const value = base - 1
                if (value >= 0) updateStyle({ cornerRadius: value })
              }}
            >
              <HStack>
                <Text>{t('cornerRadius')}</Text>
                <Spacer />
                <Text opacity={0.5}>
                  {Math.round(
                    folderStyle.cornerRadius ??
                      DEFAULT_CONFIG.iconSize * 0.225
                  ).toString()}
                </Text>
              </HStack>
            </Stepper>
          )}
          <Stepper
            onIncrement={() => {
              const value =
                (folderStyle.spacing ?? DEFAULT_CONFIG.spacing) + 1
              if (value <= 50) updateStyle({ spacing: value })
            }}
            onDecrement={() => {
              const value =
                (folderStyle.spacing ?? DEFAULT_CONFIG.spacing) - 1
              if (value >= 0) updateStyle({ spacing: value })
            }}
          >
            <HStack>
              <Text>{t('spacing')}</Text>
              <Spacer />
              <Text opacity={0.5}>
                {(folderStyle.spacing ?? DEFAULT_CONFIG.spacing).toString()}
              </Text>
            </HStack>
          </Stepper>
          <Picker
            title={t('iconRenderingMode')}
            value={
              folderStyle.widgetAccentedRenderingMode ??
              DEFAULT_CONFIG.widgetAccentedRenderingMode
            }
            onChanged={(value: string) =>
              updateStyle({
                widgetAccentedRenderingMode:
                  value as Config['widgetAccentedRenderingMode']
              })
            }
          >
            <Text tag="fullColor">{t('renderFullColor')}</Text>
            <Text tag="accented">{t('renderAccented')}</Text>
            <Text tag="desaturated">{t('renderDesaturated')}</Text>
            <Text tag="accentedDesaturated">
              {t('renderAccentedDesaturated')}
            </Text>
          </Picker>
        </Section>
      )}
      {customize && (
        <Section>
          <Button
            title={t('resetToGlobalSettings')}
            role="destructive"
            action={() => {
              setCustomize(false)
              setFolderStyle({})
              onUpdateFolderStyle(folder.id, undefined)
            }}
          />
        </Section>
      )}
    </Form>
  )
}

export function FolderDetail({
  folder,
  apps,
  folders,
  onUpdateApp,
  onSyncFolderApps,
  onRenameFolder,
  onUpdateFolderStyle
}: {
  folder: Folder
  apps: Observable<AppItem[]>
  folders: Folder[]
  onUpdateApp: (item: AppItem) => void
  onSyncFolderApps: (folderId: string, items: AppItem[]) => void
  onRenameFolder: (id: string, name: string, icon?: string, color?: string) => void
  onUpdateFolderStyle: (id: string, style: FolderStyle | undefined) => void
}) {
  const { t } = useI18n()
  const [allApps, setAllApps] = useState<AppItem[]>(() => apps.value)

  useEffect(() => {
    const onAppsChanged = (value: AppItem[]) => setAllApps(value)
    apps.subscribe(onAppsChanged)
    return () => apps.unsubscribe(onAppsChanged)
  }, [])

  const folderApps = useObservable<AppItem[]>(() =>
    apps.value.filter(app => app.folderIds?.includes(folder.id))
  )
  const otherApps = allApps.filter(
    app => !app.folderIds?.includes(folder.id)
  )

  useEffect(() => {
    onSyncFolderApps(folder.id, folderApps.value)
  }, [folderApps.value])

  useEffect(() => {
    const next = allApps.filter(app => app.folderIds?.includes(folder.id))
    const current = folderApps.value
    if (
      next.length === current.length &&
      next.every((app, index) => app === current[index])
    ) {
      return
    }
    folderApps.setValue(next)
  }, [allApps])

  function addToFolder(items: AppItem[]) {
    items.forEach(item =>
      onUpdateApp({
        ...item,
        folderIds: item.folderIds?.includes(folder.id)
          ? item.folderIds
          : [...(item.folderIds ?? []), folder.id]
      })
    )
    folderApps.setValue(
      apps.value.filter(app => app.folderIds?.includes(folder.id))
    )
  }

  return (
    <List
      navigationTitle={folder.name}
      toolbar={{
        topBarTrailing: [
          <EditButton key="edit" />,
          <NavigationLink
            key="rename"
            destination={
              <FolderNameEditor
                folder={folder}
                onSave={(name, icon, color) =>
                  onRenameFolder(folder.id, name, icon, color)
                }
              />
            }
          >
            <Image systemName="pencil" />
          </NavigationLink>,
          <NavigationLink
            key="settings"
            destination={
              <FolderSettingsView
                folder={folder}
                onUpdateFolderStyle={onUpdateFolderStyle}
              />
            }
          >
            <Image systemName="gearshape" />
          </NavigationLink>
        ]
      }}
    >
      <Section>
        <ForEach
          data={folderApps}
          editActions="all"
          builder={item => (
            <NavigationLink
              key={item.id}
              destination={
                <AppEditor item={item} folders={folders} onSave={onUpdateApp} />
              }
            >
              <AppRow item={item} />
            </NavigationLink>
          )}
        />
        <NavigationLink
          destination={
            <AppEditor
              folders={folders}
              initialFolderIds={[folder.id]}
              onSave={item => addToFolder([item])}
            />
          }
        >
          <HStack>
            <Image
              systemName="plus.circle.fill"
              foregroundStyle={'systemGreen' as Color}
            />
            <Text>{t('addNewApp')}</Text>
          </HStack>
        </NavigationLink>
      </Section>
      {otherApps.length > 0 && (
        <Section>
          <NavigationLink
            destination={
              <AddExistingAppView apps={otherApps} onAdd={addToFolder} />
            }
          >
            <HStack>
              <Image
                systemName="plus.square.on.square"
                foregroundStyle={'systemBlue' as Color}
              />
              <Text>{t('addExistingApp')}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      )}
    </List>
  )
}

function resolveFolderConfig(folder: Folder, globalConfig: Config): Config {
  const style = folder.style
  return {
    ...globalConfig,
    iconSize: style?.iconSize ?? globalConfig.iconSize,
    shape: style?.shape ?? globalConfig.shape,
    cornerRadius: style?.cornerRadius ?? globalConfig.cornerRadius,
    spacing: style?.spacing ?? globalConfig.spacing,
    widgetAccentedRenderingMode:
      style?.widgetAccentedRenderingMode ??
      globalConfig.widgetAccentedRenderingMode
  }
}

export function FolderGridCell({
  folder,
  apps,
  globalConfig,
  supportsLiquidGlass
}: {
  folder: Folder
  apps: AppItem[]
  globalConfig: Config
  supportsLiquidGlass: boolean
}) {
  const config = resolveFolderConfig(folder, globalConfig)

  return (
    <VStack
      alignment="center"
      spacing={8}
      frame={{ maxWidth: 'infinity', alignment: 'top' }}
      contentShape={{ type: 'rect', cornerRadius: FOLDER_PREVIEW_RADIUS }}
    >
      <FolderPreview
        folder={folder}
        apps={apps}
        config={config}
        supportsLiquidGlass={supportsLiquidGlass}
      />
      <HStack
        spacing={6}
        padding={{ horizontal: FOLDER_LABEL_HORIZONTAL_INSET }}
        frame={{ maxWidth: 'infinity' }}
      >
        <Text
          font={14}
          fontWeight="semibold"
          foregroundStyle={'label' as Color}
          lineLimit={1}
        >
          {folder.name}
        </Text>
        <Spacer />
        <Text font={12} foregroundStyle={'secondaryLabel' as Color}>
          {apps.length.toString()}
        </Text>
      </HStack>
    </VStack>
  )
}

function FolderPreview({
  folder,
  apps,
  config,
  supportsLiquidGlass
}: {
  folder: Folder
  apps: AppItem[]
  config: Config
  supportsLiquidGlass: boolean
}) {
  return (
    <ZStack
      frame={{ maxWidth: 'infinity' }}
      background={
        supportsLiquidGlass
          ? undefined
          : {
              style: 'ultraThinMaterial',
              shape: { type: 'rect', cornerRadius: FOLDER_PREVIEW_RADIUS }
            }
      }
      glassEffect={
        supportsLiquidGlass
          ? {
              glass: UIGlass.regular(),
              shape: { type: 'rect', cornerRadius: FOLDER_PREVIEW_RADIUS }
            }
          : undefined
      }
      clipShape={{ type: 'rect', cornerRadius: FOLDER_PREVIEW_RADIUS }}
      overlay={
        supportsLiquidGlass ? undefined : (
          <RoundedRectangle
            cornerRadius={FOLDER_PREVIEW_RADIUS}
            stroke={{
              shapeStyle: 'separator' as Color,
              strokeStyle: { lineWidth: 0.5 }
            }}
          />
        )
      }
    >
      <RoundedRectangle
        cornerRadius={FOLDER_PREVIEW_RADIUS}
        fill={'clear' as Color}
        aspectRatio={{ value: 1, contentMode: 'fit' }}
        frame={{ maxWidth: 'infinity' }}
        overlay={
          apps.length === 0 ? (
            <VStack opacity={0.45} spacing={6}>
              <FolderIconView icon={folder.icon} color={folder.color} />
              <Text font={11} foregroundStyle={'secondaryLabel' as Color}>
                {t('emptyFolder')}
              </Text>
            </VStack>
          ) : apps.length === 1 ? (
            <AppIconArtwork item={apps[0]} config={config} />
          ) : (
            <GeometryReader>
              {proxy => (
                <FolderPreviewGrid
                  apps={apps}
                  config={config}
                  previewSize={Math.min(proxy.size.width, proxy.size.height)}
                  layout={folder.style?.layout}
                />
              )}
            </GeometryReader>
          )
        }
      />
    </ZStack>
  )
}

function FolderPreviewGrid({
  apps,
  config,
  previewSize,
  layout
}: {
  apps: AppItem[]
  config: Config
  previewSize: number
  layout?: WidgetLayout
}) {
  const iconSize = config.iconSize || DEFAULT_CONFIG.iconSize
  const preferredSpacing = config.spacing
  const spec = layout ? gridSpecForLayout(layout) : undefined

  if (spec) {
    // A fixed layout draws its own rows and columns, so the folder preview
    // matches what the widget will render instead of the auto flow.
    const gap = 8
    const cell = Math.min(
      (previewSize - preferredSpacing * 2 - gap * (spec.columns - 1)) /
        spec.columns,
      (previewSize - preferredSpacing * 2 - gap * (spec.rows - 1)) / spec.rows
    )
    const displayApps = apps.slice(0, spec.columns * spec.rows)
    const rows: AppItem[][] = []
    for (let i = 0; i < displayApps.length; i += spec.columns) {
      rows.push(displayApps.slice(i, i + spec.columns))
    }
    const cellIconSize = Math.max(10, cell)

    return (
      <VStack
        spacing={gap}
        padding={preferredSpacing}
        frame={{ width: previewSize, height: previewSize }}
        alignment="center"
      >
        <Spacer />
        {rows.map((row, rowIndex) => (
          <HStack key={rowIndex} spacing={gap} alignment="center">
            {row.map(item => (
              <AppIconArtwork
                key={item.id}
                item={item}
                config={{ ...config, iconSize: cellIconSize, cornerRadius: undefined }}
              />
            ))}
          </HStack>
        ))}
        <Spacer />
      </VStack>
    )
  }

  const availableSize = Math.max(0, previewSize - preferredSpacing * 2)
  const itemStride = iconSize + preferredSpacing
  // A folder preview never exceeds three columns, matching the widget grids.
  const columns = Math.min(
    MAX_GRID_COLUMNS,
    Math.max(1, Math.floor((availableSize + preferredSpacing) / itemStride))
  )
  const rowCount = columns
  const displayApps = apps.slice(0, columns * rowCount)
  const iconColumns = [
    {
      size: {
        type: 'adaptive' as const,
        min: iconSize,
        max: iconSize
      },
      spacing: preferredSpacing
    }
  ]

  return (
    <VStack
      padding={preferredSpacing}
      frame={{ width: previewSize, height: previewSize }}
    >
      <Spacer />
      <LazyVGrid
        columns={iconColumns}
        alignment="center"
        spacing={preferredSpacing}
        frame={{ maxWidth: 'infinity' }}
      >
        {displayApps.map(item => (
          <AppIconArtwork key={item.id} item={item} config={config} />
        ))}
      </LazyVGrid>
      <Spacer />
    </VStack>
  )
}
