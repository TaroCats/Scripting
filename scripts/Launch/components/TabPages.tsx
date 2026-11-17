import {
  Button,
  ContentUnavailableView,
  Device,
  EditButton,
  ForEach,
  GlassEffectContainer,
  HStack,
  Image,
  LazyVGrid,
  List,
  NavigationLink,
  Picker,
  ScrollView,
  Section,
  Spacer,
  Stepper,
  Text,
  Toggle,
  Widget,
  useState
} from 'scripting'
import {
  AppItem,
  Config,
  Folder,
  FolderStyle,
  WIDGET_LAYOUT_SLOT_COUNT,
  WidgetLayout,
  buildWidgetParameter,
  normalizeWidgetSlots
} from '../constants'
import { AppEditor } from './AppEditor'
import {
  FolderDetail,
  FolderGridCell,
  FolderNameEditor,
  FOLDER_PREVIEW_RADIUS
} from './FolderViews'
import { AppRow, TexturedTabPage, filterApps } from './SharedViews'
import {
  LanguagePreference,
  getLanguagePreference,
  setLanguage,
  useI18n
} from '../i18n'

const FOLDER_GRID_COLUMNS = [
  {
    size: { type: 'adaptive' as const, min: 150, max: 'infinity' as const },
    spacing: 16
  }
]

/** The most informative widget size to demo each layout in. */
const PREVIEW_FAMILY: Record<WidgetLayout, 'systemSmall' | 'systemMedium'> = {
  auto: 'systemMedium',
  single: 'systemSmall',
  dual: 'systemMedium',
  quad: 'systemMedium'
}

export function AppsPage({
  apps,
  visibleApps,
  folders,
  query,
  onQueryChanged,
  onUpdateApp,
  onDismiss
}: {
  apps: AppItem[]
  visibleApps: Observable<AppItem[]>
  folders: Folder[]
  query: string
  onQueryChanged: (query: string) => void
  onUpdateApp: (item: AppItem) => void
  onDismiss: () => void
}) {
  const { t } = useI18n()

  return (
    <TexturedTabPage>
      <List
        navigationTitle={t('appsTitle')}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        scrollContentBackground="hidden"
        searchable={{
          value: query,
          onChanged: onQueryChanged,
          prompt: t('searchApps')
        }}
        overlay={
          query.trim() && filterApps(apps, query).length === 0 ? (
            <ContentUnavailableView
              title={t('noResults')}
              systemImage="magnifyingglass"
            />
          ) : undefined
        }
        toolbar={{
          topBarLeading: [
            <Button
              title={t('close')}
              systemImage="xmark"
              action={onDismiss}
            />
          ],
          confirmationAction: [
            <EditButton />,
            <NavigationLink
              destination={
                <AppEditor folders={folders} onSave={onUpdateApp} />
              }
            >
              <Image systemName="plus" />
            </NavigationLink>
          ]
        }}
      >
        <Section>
          <ForEach
            data={visibleApps}
            editActions={query.trim() ? 'delete' : 'all'}
            builder={item => (
              <NavigationLink
                key={item.id}
                destination={
                  <AppEditor
                    item={item}
                    folders={folders}
                    onSave={onUpdateApp}
                  />
                }
              >
                <AppRow item={item} folders={folders} />
              </NavigationLink>
            )}
          />
        </Section>
      </List>
    </TexturedTabPage>
  )
}

export function FoldersPage({
  apps,
  folders,
  globalConfig,
  onAddFolder,
  onDeleteFolder,
  onUpdateApp,
  onSyncFolderApps,
  onRenameFolder,
  onUpdateFolderStyle
}: {
  apps: Observable<AppItem[]>
  folders: Folder[]
  globalConfig: Config
  onAddFolder: (name: string, icon?: string, color?: string) => void
  onDeleteFolder: (id: string) => void
  onUpdateApp: (item: AppItem) => void
  onSyncFolderApps: (folderId: string, items: AppItem[]) => void
  onRenameFolder: (id: string, name: string, icon?: string, color?: string) => void
  onUpdateFolderStyle: (id: string, style: FolderStyle | undefined) => void
}) {
  const { t } = useI18n()
  const supportsLiquidGlass = parseFloat(Device.systemVersion) >= 26
  const folderGrid = (
    <LazyVGrid
      columns={FOLDER_GRID_COLUMNS}
      alignment="leading"
      spacing={20}
      padding={{ horizontal: 16, vertical: 16 }}
      frame={{ maxWidth: 'infinity', alignment: 'topLeading' }}
    >
      {folders.map(folder => {
        const folderApps = apps.value.filter(app =>
          app.folderIds?.includes(folder.id)
        )
        return (
          <NavigationLink
            key={folder.id}
            destination={
              <FolderDetail
                folder={folder}
                apps={apps}
                folders={folders}
                onUpdateApp={onUpdateApp}
                onSyncFolderApps={onSyncFolderApps}
                onRenameFolder={onRenameFolder}
                onUpdateFolderStyle={onUpdateFolderStyle}
              />
            }
            buttonStyle="plain"
            frame={{ maxWidth: 'infinity', alignment: 'top' }}
            contentShape={{
              type: 'rect',
              cornerRadius: FOLDER_PREVIEW_RADIUS
            }}
            accessibilityLabel={t('folderApps', {
              name: folder.name,
              count: folderApps.length
            })}
            contextMenu={{
              menuItems: (
                <Button
                  title={t('deleteFolder')}
                  systemImage="trash"
                  role="destructive"
                  action={() => onDeleteFolder(folder.id)}
                />
              )
            }}
          >
            <FolderGridCell
              folder={folder}
              apps={folderApps}
              globalConfig={globalConfig}
              supportsLiquidGlass={supportsLiquidGlass}
            />
          </NavigationLink>
        )
      })}
    </LazyVGrid>
  )

  return (
    <TexturedTabPage>
      <ScrollView
        navigationTitle={t('foldersTitle')}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        scrollContentBackground="hidden"
        toolbar={{
          confirmationAction: [
            <NavigationLink
              key="add"
              destination={<FolderNameEditor onSave={onAddFolder} />}
            >
              <Image systemName="folder.badge.plus" />
            </NavigationLink>
          ]
        }}
        overlay={
          folders.length === 0 ? (
            <ContentUnavailableView
              title={t('noFolders')}
              systemImage="folder"
              description={t('noFoldersDescription')}
            />
          ) : undefined
        }
      >
        {supportsLiquidGlass ? (
          <GlassEffectContainer
            spacing={8}
            frame={{ maxWidth: 'infinity', alignment: 'topLeading' }}
          >
            {folderGrid}
          </GlassEffectContainer>
        ) : (
          folderGrid
        )}
      </ScrollView>
    </TexturedTabPage>
  )
}

export function SettingsPage({
  config,
  apps,
  onSaveConfig
}: {
  config: Config
  apps: AppItem[]
  onSaveConfig: (patch: Partial<Config>) => void
}) {
  const { t } = useI18n()
  const [language, setLanguagePreference] = useState<LanguagePreference>(
    getLanguagePreference
  )
  const layout: WidgetLayout = config.widgetLayout ?? 'auto'
  const slots = normalizeWidgetSlots(config.widgetSlots)
  // A slot may point at a deleted app; showing "Default" is kinder than an
  // unresolved picker value.
  const slotValue = (index: number) =>
    apps.some(app => app.id === slots[index]) ? slots[index] : ''

  function updateSlot(index: number, value: string) {
    const next = normalizeWidgetSlots(config.widgetSlots)
    next[index] = value
    onSaveConfig({ widgetSlots: next })
  }

  async function previewWidget() {
    const family = PREVIEW_FAMILY[layout]
    const parameter = buildWidgetParameter(
      layout,
      undefined,
      config.widgetCoverMode
    )
    const optionName = t('widget')
    try {
      await Widget.preview({
        family,
        parameters: {
          options: { [optionName]: JSON.stringify(parameter) },
          default: optionName
        }
      })
    } catch (e) {
      console.error(e)
      await Widget.preview({ family })
    }
  }

  return (
    <TexturedTabPage>
      <List
        navigationTitle={t('tabSettings')}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        scrollContentBackground="hidden"
      >
        <Section>
          <Picker
            title={t('language')}
            value={language}
            onChanged={(value: string) => {
              const next = value as LanguagePreference
              setLanguagePreference(next)
              setLanguage(next)
              Widget.reloadAll()
            }}
          >
            <Text tag="auto">{t('languageAuto')}</Text>
            <Text tag="en">{t('languageEnglish')}</Text>
            <Text tag="zh">{t('languageChinese')}</Text>
          </Picker>
        </Section>

        <Section>
          <Picker
            title={t('iconShape')}
            value={config.shape}
            onChanged={(value: string) =>
              onSaveConfig({ shape: value as Config['shape'] })
            }
          >
            <Text tag="rounded">{t('shapeRounded')}</Text>
            <Text tag="circle">{t('shapeCircle')}</Text>
          </Picker>
          <Stepper
            onIncrement={() => {
              if (config.iconSize < 100) {
                onSaveConfig({ iconSize: config.iconSize + 1 })
              }
            }}
            onDecrement={() => {
              if (config.iconSize > 20) {
                onSaveConfig({ iconSize: config.iconSize - 1 })
              }
            }}
          >
            <HStack>
              <Text>{t('iconSize')}</Text>
              <Spacer />
              <Text opacity={0.5}>{config.iconSize.toString()}</Text>
            </HStack>
          </Stepper>
          <Stepper
            onIncrement={() => {
              if (config.spacing < 50) {
                onSaveConfig({ spacing: config.spacing + 1 })
              }
            }}
            onDecrement={() => {
              if (config.spacing > 0) {
                onSaveConfig({ spacing: config.spacing - 1 })
              }
            }}
          >
            <HStack>
              <Text>{t('spacing')}</Text>
              <Spacer />
              <Text opacity={0.5}>{config.spacing.toString()}</Text>
            </HStack>
          </Stepper>
          <Picker
            title={t('iconRenderingMode')}
            value={config.widgetAccentedRenderingMode}
            onChanged={(value: string) =>
              onSaveConfig({
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

        <Section
          header={<Text>{t('widget')}</Text>}
          footer={<Text>{t('widgetLayoutFooter')}</Text>}
        >
          <Picker
            title={t('widgetLayout')}
            value={layout}
            onChanged={(value: string) =>
              onSaveConfig({ widgetLayout: value as WidgetLayout })
            }
          >
            <Text tag="auto">{t('widgetLayoutAuto')}</Text>
            <Text tag="single">{t('widgetLayoutSingle')}</Text>
            <Text tag="dual">{t('widgetLayoutDual')}</Text>
            <Text tag="quad">{t('widgetLayoutQuad')}</Text>
          </Picker>
        </Section>

        {layout !== 'auto' && (
          <Section footer={<Text>{t('widgetCoverModeFooter')}</Text>}>
            <Toggle
              title={t('widgetCoverMode')}
              systemImage="rectangle.inset.filled"
              value={config.widgetCoverMode ?? false}
              onChanged={(value: boolean) =>
                onSaveConfig({ widgetCoverMode: value })
              }
            />
          </Section>
        )}

        {layout !== 'auto' && (
          <Section
            header={<Text>{t('widgetSlots')}</Text>}
            footer={
              <Text>
                {`${t('widgetSlotsFooter')}\n\n${t('widgetParameterHint')}`}
              </Text>
            }
          >
            {Array.from(
              { length: WIDGET_LAYOUT_SLOT_COUNT[layout] },
              (_unused, index) => (
                <Picker
                  key={index}
                  title={t('widgetSlotLabel', { index: index + 1 })}
                  value={slotValue(index)}
                  onChanged={(value: string) => updateSlot(index, value)}
                >
                  <Text tag="">{t('widgetSlotDefault')}</Text>
                  {apps.map(app => (
                    <Text key={app.id} tag={app.id}>
                      {app.name}
                    </Text>
                  ))}
                </Picker>
              )
            )}
          </Section>
        )}

        <Section
          footer={
            layout === 'auto' ? <Text>{t('widgetParameterHint')}</Text> : undefined
          }
        >
          <Button
            title={t('previewWidget')}
            systemImage="rectangle.on.rectangle"
            action={previewWidget}
          />
        </Section>
      </List>
    </TexturedTabPage>
  )
}
