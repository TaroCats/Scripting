import {
  Button,
  Color,
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
  Widget,
  useState
} from 'scripting'
import {
  AppItem,
  Config,
  Folder,
  FolderStyle,
  WidgetLayout,
  normalizeWidgetProfiles
} from '../constants'
import { AppEditor } from './AppEditor'
import { isiCloudReady, pushToiCloud } from '../cloudSync'
import { WidgetDefaultsView } from './WidgetDefaults'
import { WidgetProfilesView } from './WidgetProfiles'
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
  folders = [],
  onSaveConfig
}: {
  config: Config
  apps: AppItem[]
  folders?: Folder[]
  onSaveConfig: (patch: Partial<Config>) => void
}) {
  const { t } = useI18n()
  const [language, setLanguagePreference] = useState<LanguagePreference>(
    getLanguagePreference
  )
  const cloudReady = isiCloudReady()
  const profiles = normalizeWidgetProfiles(config.widgetProfiles)
  const layout: WidgetLayout = config.widgetLayout ?? 'auto'

  /** Human-readable layout name, shown as the default-settings summary. */
  function layoutLabel(value?: WidgetLayout) {
    switch (value) {
      case 'single':
        return t('widgetLayoutSingle')
      case 'dual':
        return t('widgetLayoutDual')
      case 'triple':
        return t('widgetLayoutTriple')
      case 'quad':
        return t('widgetLayoutQuad')
      case 'six':
        return t('widgetLayoutSix')
      case 'nine':
        return t('widgetLayoutNine')
      default:
        return t('widgetLayoutAuto')
    }
  }

  return (
    <TexturedTabPage>
      <List
        navigationTitle={t('tabSettings')}
        frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
        scrollContentBackground="hidden"
      >
        <Section
          header={<Text>{t('iCloud')}</Text>}
          footer={
            <Text>
              {cloudReady ? t('iCloudFooter') : t('iCloudOffFooter')}
            </Text>
          }
        >
          <HStack>
            <Image
              systemName={cloudReady ? 'icloud.fill' : 'icloud.slash'}
              foregroundStyle={
                (cloudReady ? 'systemBlue' : 'secondaryLabel') as Color
              }
            />
            <Text>{cloudReady ? t('iCloudOn') : t('iCloudOff')}</Text>
            <Spacer />
          </HStack>
          <Button
            title={t('iCloudBackupNow')}
            systemImage="arrow.up.to.line"
            disabled={!cloudReady}
            action={async () => {
              const ok = await pushToiCloud(true)
              await Dialog.alert({
                title: t('iCloud'),
                message: ok ? t('iCloudBackupDone') : t('iCloudBackupFailed')
              })
            }}
          />
        </Section>

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
          header={<Text>{t('widgetProfiles')}</Text>}
          footer={<Text>{t('widgetProfilesFooter')}</Text>}
        >
          <NavigationLink
            destination={
              <WidgetProfilesView
                profiles={profiles}
                apps={apps}
                folders={folders}
                config={config}
                onChange={next => onSaveConfig({ widgetProfiles: next })}
              />
            }
          >
            <HStack>
              <Text>{t('widgetProfiles')}</Text>
              <Spacer />
              <Text opacity={0.5}>{profiles.length}</Text>
            </HStack>
          </NavigationLink>
        </Section>

        <Section
          header={<Text>{t('widget')}</Text>}
          footer={<Text>{t('widgetDefaultsFooter')}</Text>}
        >
          <NavigationLink
            destination={
              <WidgetDefaultsView
                config={config}
                apps={apps}
                folders={folders}
                onSaveConfig={onSaveConfig}
              />
            }
          >
            <HStack>
              <Text>{t('widgetDefaults')}</Text>
              <Spacer />
              <Text opacity={0.5}>{layoutLabel(layout)}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      </List>
    </TexturedTabPage>
  )
}
