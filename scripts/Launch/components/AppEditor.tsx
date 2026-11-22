import {
  Button,
  Color,
  ColorPicker,
  Form,
  HStack,
  Image,
  Label,
  Navigation,
  NavigationLink,
  Picker,
  RoundedRectangle,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  ZStack,
  useEffect,
  useMemo,
  useState
} from 'scripting'
import { ITunesApp, SearchSheet } from '../SearchSheet'
import {
  AppItem,
  CACHE_PATH,
  Folder,
  findRepositoryDarkIcon,
  getIconCachePath,
  pickArtwork
} from '../constants'
import {
  readButtonCode,
  runButtonCode,
  saveButtonCode
} from '../buttonCode'
import {
  AppIconView,
  FolderIconView,
  ResolvedIconImage
} from './SharedViews'
import { extractIconColor } from '../iconColor'
import { IconColorSheet } from './IconColorSheet'
import { SFSymbolPicker } from './SFSymbolPicker'
import { t, useI18n } from '../i18n'

type AppLaunchMode = 'url' | 'bundleId' | 'script'
type AppIconType = 'symbol' | 'image' | 'transparent_image'

const EDITOR_SECONDARY = 'secondaryLabel' as Color
/** The colour a new app starts with; while it is untouched, picking an app may refine it. */
const DEFAULT_THEME_COLOR = '#007AFF'

function isDefaultThemeColor(color: Color) {
  return String(color as unknown as string).toUpperCase() === DEFAULT_THEME_COLOR
}

/** Writes picked image bytes into the icon cache and returns the icon id. */
function storeIconImage(data: Data | null | undefined): string | undefined {
  if (!data) return
  try {
    if (!FileManager.existsSync(CACHE_PATH)) {
      FileManager.createDirectorySync(CACHE_PATH, true)
    }
    const id = `img_${Date.now()}`
    FileManager.writeAsDataSync(getIconCachePath(id), data)
    return id
  } catch (e) {
    console.error(e)
  }
}

async function pickIconFromPhotos(): Promise<string | undefined> {
  try {
    const images = await Photos.pickPhotos(1)
    return storeIconImage(images?.[0]?.toPNGData())
  } catch (e) {
    console.error(e)
  }
}

async function pickIconFromFiles(): Promise<string | undefined> {
  try {
    const paths = await DocumentPicker.pickFiles({
      types: ['public.image'],
      allowsMultipleSelection: false
    })
    const path = paths?.[0]
    if (!path) return
    // A picked file lives outside the app group, where the widget extension
    // cannot read it, so normalise it into the icon cache as PNG.
    const image = UIImage.fromData(FileManager.readAsDataSync(path))
    if (!image) {
      await Dialog.alert({
        title: t('couldNotReadImage'),
        message: t('couldNotReadImageMessage')
      })
      return
    }
    return storeIconImage(image.toPNGData())
  } catch (e) {
    console.error(e)
  }
}

/**
 * Asks where the icon image should come from, then opens that picker. No single
 * iOS picker covers both the photo library and Files, so the source is an
 * explicit choice made by the user.
 */
async function pickIconImage(): Promise<string | undefined> {
  const choice = await Dialog.actionSheet({
    title: t('iconSourceTitle'),
    actions: [{ label: t('chooseFromPhotos') }, { label: t('chooseFromFiles') }]
  })
  if (choice === 0) return pickIconFromPhotos()
  if (choice === 1) return pickIconFromFiles()
}

function EditorSectionHeader({ title }: { title: string }) {
  return (
    <HStack spacing={6}>
      <Text font={13} fontWeight="semibold" foregroundStyle={EDITOR_SECONDARY}>
        {title}
      </Text>
    </HStack>
  )
}

function launchModeTitle(mode: AppLaunchMode) {
  if (mode === 'bundleId') return t('launchModeTitleApp')
  if (mode === 'script') return t('launchModeTitleScript')
  return t('launchModeTitleUrl')
}

function launchSummary(mode: AppLaunchMode, url: string, bundleId: string) {
  if (mode === 'bundleId') return bundleId.trim() || t('enterBundleId')
  if (mode === 'script') return t('runsCustomJavaScript')
  return url.trim() || t('enterUrlScheme')
}

function AppEditorIconPreview({
  icon,
  iconDark,
  iconType,
  color
}: {
  icon: string
  iconDark?: string
  iconType: AppIconType
  color: Color
}) {
  const size = 72
  const radius = 16

  return (
    <ZStack
      frame={{ width: size, height: size }}
      clipShape={{ type: 'rect', cornerRadius: radius }}
      overlay={
        <RoundedRectangle
          cornerRadius={radius}
          stroke={{
            shapeStyle: 'separator' as Color,
            strokeStyle: { lineWidth: 1 }
          }}
        />
      }
    >
      {iconType === 'image' ? (
        <ResolvedIconImage icon={icon} iconDark={iconDark} />
      ) : (
        <Fragment>
          <RoundedRectangle
            frame={{ width: size, height: size }}
            fill={color}
            cornerRadius={radius}
          />
          {iconType === 'transparent_image' ? (
            <ZStack frame={{ width: 44, height: 44 }}>
              <ResolvedIconImage icon={icon} iconDark={iconDark} fit />
            </ZStack>
          ) : (
            <Image
              systemName={icon || 'app.fill'}
              font={34}
              fontWeight="medium"
              foregroundStyle={'white' as Color}
            />
          )}
        </Fragment>
      )}
    </ZStack>
  )
}

export function AppEditor({
  item,
  folders = [],
  initialFolderIds,
  onSave
}: {
  item?: AppItem
  folders?: Folder[]
  initialFolderIds?: string[]
  onSave: (item: AppItem) => void
}) {
  const { t } = useI18n()
  const [id] = useState(() => item?.id ?? Math.random().toString(36).slice(2))
  const [name, setName] = useState(item?.name ?? '')
  const [mode, setMode] = useState<AppLaunchMode>(item?.mode ?? 'url')
  const [url, setUrl] = useState(item?.url ?? '')
  const [bundleId, setBundleId] = useState(item?.bundleId ?? '')
  const [runInWidget, setRunInWidget] = useState(item?.runInWidget !== false)
  const [icon, setIcon] = useState(item?.icon ?? 'app')
  const [iconDark, setIconDark] = useState(item?.iconDark ?? '')
  const [iconType, setIconType] = useState<AppIconType>(
    item?.iconType ?? 'symbol'
  )
  const [color, setColor] = useState<Color>((item?.color ?? '#007AFF') as Color)
  const [folderIds, setFolderIds] = useState<string[]>(() => {
    const legacy = (item as AppItem & { folderId?: string } | undefined)
      ?.folderId
    return Array.from(
      new Set([
        ...(item?.folderIds ?? []),
        ...(legacy ? [legacy] : []),
        ...(initialFolderIds ?? [])
      ])
    )
  })
  const [activeSheet, setActiveSheet] = useState<'search' | 'colors' | null>(
    null
  )
  const dismiss = Navigation.useDismiss()
  const hasLaunchTarget =
    mode === 'script' ||
    (mode === 'bundleId' ? !!bundleId.trim() : !!url.trim())
  const canSave = !!name.trim() && !!icon.trim() && hasLaunchTarget

  const codeController = useMemo(
    () =>
      new EditorController({
        ext: 'js',
        content: readButtonCode(id)
      }),
    []
  )

  useEffect(() => {
    return () => codeController.dispose()
  }, [codeController])

  function toggleFolder(folderId: string) {
    setFolderIds(prev =>
      prev.includes(folderId)
        ? prev.filter(x => x !== folderId)
        : [...prev, folderId]
    )
  }

  async function testURLScheme() {
    const target = url.trim()
    if (!target) return

    try {
      const didOpen = await Safari.openURL(target)
      if (!didOpen) {
        await Dialog.alert({
          title: t('couldNotOpenUrlScheme'),
          message: t('couldNotOpenUrlSchemeMessage')
        })
      }
    } catch (e) {
      console.error(e)
      await Dialog.alert({
        title: t('couldNotOpenUrlScheme'),
        message: String(e)
      })
    }
  }

  function handleSelectApp(app: ITunesApp) {
    setName(app.trackName)
    if (app.bundleId) {
      setBundleId(app.bundleId)
      setMode('bundleId')
    }
    // Ask for a large square render: the widget can scale the icon well past
    // the 100x100 thumbnail the search response ships with.
    const artwork = pickArtwork(app, 512) ?? ''
    if (artwork) {
      setIcon(artwork)
      setIconType('image')
      setIconDark('')
      // A fresh app should look like itself: sample the artwork unless the user
      // already chose a colour by hand.
      if (isDefaultThemeColor(color)) {
        extractIconColor(artwork).then(hex => {
          if (hex) setColor(hex as Color)
        })
      }
      findRepositoryDarkIcon(app.bundleId).then(repositoryIcon => {
        if (repositoryIcon) setIconDark(repositoryIcon)
      })
    }
    setActiveSheet(null)
  }

  function save() {
    if (mode === 'script') {
      saveButtonCode(id, codeController.content)
    }
    onSave({
      id,
      name: name.trim(),
      mode,
      url: url.trim(),
      bundleId: bundleId.trim(),
      runInWidget,
      icon: icon.trim(),
      iconDark:
        iconType === 'symbol' ? undefined : iconDark.trim() || undefined,
      iconType,
      color: color as unknown as string,
      folderIds
    })
    dismiss()
  }

  async function testScript() {
    const code = codeController.content
    saveButtonCode(id, code)
    try {
      await runButtonCode(code, { item, env: Script.env })
    } catch (e) {
      console.error(e)
      await Dialog.alert({ title: t('runFailed'), message: String(e) })
    }
  }

  return (
    <Form
      navigationTitle={item ? t('editApp') : t('addApp')}
      navigationBarTitleDisplayMode="inline"
      formStyle="grouped"
      scrollDismissesKeyboard="interactively"
      sheet={{
        isPresented: activeSheet !== null,
        onChanged: (presented: boolean) => {
          if (!presented) setActiveSheet(null)
        },
        content:
          activeSheet === 'search' ? (
            <VStack
              frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
              presentationDragIndicator="visible"
              presentationDetents={['medium', 'large']}
            >
              <SearchSheet
                initialQuery={name}
                onClose={() => setActiveSheet(null)}
                onSelect={handleSelectApp}
              />
            </VStack>
          ) : activeSheet === 'colors' ? (
            <IconColorSheet
              icon={icon}
              iconDark={iconDark}
              iconType={iconType}
              onApply={hex => setColor(hex as Color)}
              onClose={() => setActiveSheet(null)}
            />
          ) : (
            <VStack />
          )
      }}
      toolbar={{
        confirmationAction: [
          <Button
            key="save"
            title={t('save')}
            systemImage="checkmark"
            disabled={!canSave}
            action={save}
          />
        ]
      }}
    >
      <Section>
        <HStack spacing={16} padding={{ vertical: 8 }}>
          <AppEditorIconPreview
            icon={icon}
            iconDark={iconDark}
            iconType={iconType}
            color={color}
          />
          <VStack
            alignment="leading"
            spacing={4}
            frame={{ maxWidth: 'infinity', alignment: 'leading' }}
          >
            <Text
              font={20}
              fontWeight="semibold"
              lineLimit={1}
              truncationMode="tail"
            >
              {name.trim() || t('untitledApp')}
            </Text>
            <Text
              font={13}
              foregroundStyle={EDITOR_SECONDARY}
              lineLimit={1}
              truncationMode="middle"
            >
              {launchSummary(mode, url, bundleId)}
            </Text>
            <HStack spacing={4} padding={{ top: 3 }}>
              <Image
                systemName={
                  mode === 'script'
                    ? 'chevron.left.forwardslash.chevron.right'
                    : mode === 'bundleId'
                      ? 'app.badge'
                      : 'link'
                }
                font={11}
                foregroundStyle={'systemBlue' as Color}
              />
              <Text font={12} foregroundStyle={'systemBlue' as Color}>
                {launchModeTitle(mode)}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Section>

      <Section
        header={<EditorSectionHeader title={t('basicInfo')} />}
        footer={
          !hasLaunchTarget ? (
            <Text>{t('basicInfoFooter')}</Text>
          ) : undefined
        }
      >
        <HStack spacing={10}>
          <TextField
            label={<Label title={t('nameLabel')} systemImage="textformat" />}
            prompt={t('appNamePlaceholder')}
            value={name}
            onChanged={setName}
          />
          <Button
            buttonStyle="borderedProminent"
            buttonBorderShape="circle"
            action={() => setActiveSheet('search')}
            accessibilityLabel={t('findAppInAppStore')}
          >
            <Image
              systemName="magnifyingglass"
              font={14}
              fontWeight="semibold"
              frame={{ width: 18, height: 18 }}
            />
          </Button>
        </HStack>
        <Picker
          title={t('launchMode')}
          value={mode}
          pickerStyle="segmented"
          onChanged={(v: string) => {
            const next = v as AppLaunchMode
            setMode(next)
            if (next === 'script' && icon === 'app' && iconType === 'symbol') {
              setIcon('bolt.fill')
            }
          }}
        >
          <Text tag="url">{t('launchModeUrl')}</Text>
          <Text tag="bundleId">{t('launchModeApp')}</Text>
          <Text tag="script">{t('launchModeScript')}</Text>
        </Picker>
        {mode === 'bundleId' ? (
          <TextField
            label={<Label title={t('bundleIdLabel')} systemImage="app.dashed" />}
            prompt={t('bundleIdPlaceholder')}
            value={bundleId}
            onChanged={setBundleId}
          />
        ) : mode === 'script' ? null : (
          <Fragment>
            <TextField
              label={
                <Label title={t('urlSchemeLabel')} systemImage="link" />
              }
              prompt={t('urlSchemePlaceholder')}
              value={url}
              onChanged={setUrl}
            />
            <Button
              title={t('testUrlScheme')}
              systemImage="play.circle.fill"
              buttonStyle="bordered"
              disabled={!url.trim()}
              action={testURLScheme}
              accessibilityLabel={t('testUrlScheme')}
            />
          </Fragment>
        )}
      </Section>

      {mode === 'script' && (
        <Section
          header={
            <EditorSectionHeader title={t('customCode')} />
          }
          footer={
            <Text>{t('customCodeFooter')}</Text>
          }
        >
          <Button
            title={t('openCodeEditor')}
            systemImage="chevron.left.forwardslash.chevron.right"
            buttonStyle="bordered"
            action={() => {
              codeController.present({
                navigationTitle: name || t('customCodeSubtitle'),
                fullscreen: true
              })
            }}
          />
          <Button
            title={t('testRun')}
            systemImage="play.fill"
            buttonStyle="bordered"
            action={testScript}
          />
          <Toggle
            title={t('runInWidget')}
            systemImage="square.grid.2x2"
            value={runInWidget}
            onChanged={setRunInWidget}
          />
        </Section>
      )}

      <Section
        header={<EditorSectionHeader title={t('appearanceSection')} />}
        footer={
          <Text>
            {`${t('darkIconFooter')}\n\n${t('colorFromIconFooter')}`}
          </Text>
        }
      >
        <Picker
          title={t('iconType')}
          value={iconType}
          pickerStyle="segmented"
          onChanged={(v: string) => setIconType(v as AppIconType)}
        >
          <Text tag="symbol">{t('iconTypeSymbol')}</Text>
          <Text tag="image">{t('iconTypeImage')}</Text>
          <Text tag="transparent_image">{t('iconTypeTransparent')}</Text>
        </Picker>

        {iconType === 'symbol' ? (
          <NavigationLink
            destination={
              <SFSymbolPicker
                name={icon}
                color={color}
                onSelect={setIcon}
              />
            }
          >
            <HStack>
              <Label title={t('sfSymbol')} systemImage="sparkles" />
              <Spacer />
              <Image
                systemName={icon || 'app.fill'}
                font={20}
                foregroundStyle={color}
                frame={{ width: 28, height: 28 }}
              />
              <Text font={13} foregroundStyle={EDITOR_SECONDARY} lineLimit={1}>
                {icon || t('sfSymbolChoose')}
              </Text>
            </HStack>
          </NavigationLink>
        ) : (
          <Fragment>
            <HStack>
              <TextField
                label={
                  <Label title={t('lightIcon')} systemImage="sun.max.fill" />
                }
                prompt={t('imageUrlPlaceholder')}
                value={icon}
                onChanged={setIcon}
              />
              <Button
                buttonStyle="bordered"
                buttonBorderShape="circle"
                accessibilityLabel={t('chooseLightIcon')}
                action={async () => {
                  const nextIcon = await pickIconImage()
                  if (nextIcon) {
                    setIcon(nextIcon)
                    if (isDefaultThemeColor(color)) {
                      const hex = await extractIconColor(nextIcon)
                      if (hex) setColor(hex as Color)
                    }
                  }
                }}
              >
                <Image
                  systemName="photo.on.rectangle"
                  font={15}
                  frame={{ width: 18, height: 18 }}
                />
              </Button>
              <AppIconView
                icon={icon}
                iconType={iconType}
                color={color as unknown as string}
              />
            </HStack>
            <HStack>
              <TextField
                label={
                  <Label title={t('darkIcon')} systemImage="moon.fill" />
                }
                prompt={t('optional')}
                value={iconDark}
                onChanged={setIconDark}
              />
              <Button
                buttonStyle="bordered"
                buttonBorderShape="circle"
                accessibilityLabel={t('chooseDarkIcon')}
                action={async () => {
                  const nextIcon = await pickIconImage()
                  if (nextIcon) setIconDark(nextIcon)
                }}
              >
                <Image
                  systemName="photo.on.rectangle"
                  font={15}
                  frame={{ width: 18, height: 18 }}
                />
              </Button>
              <AppIconView
                icon={iconDark || icon}
                iconType={iconType}
                color={color as unknown as string}
              />
            </HStack>
          </Fragment>
        )}

        <ColorPicker value={color} onChanged={setColor}>
          <Text>{t('themeColor')}</Text>
        </ColorPicker>
        <Button
          title={t('extractColorFromIcon')}
          systemImage="eyedropper"
          buttonStyle="bordered"
          disabled={iconType === 'symbol' || !icon.trim()}
          action={() => setActiveSheet('colors')}
        />
      </Section>

      {folders.length > 0 && (
        <Section
          header={<EditorSectionHeader title={t('foldersSection')} />}
          footer={
            <Text>
              {folderIds.length === 0
                ? t('foldersFooterMainOnly')
                : t('foldersSelected', { count: folderIds.length })}
            </Text>
          }
        >
          {folders.map(folder => (
            <Toggle
              key={folder.id}
              value={folderIds.includes(folder.id)}
              onChanged={() => toggleFolder(folder.id)}
            >
              <HStack spacing={10}>
                <FolderIconView icon={folder.icon} color={folder.color} />
                <Text>{folder.name}</Text>
              </HStack>
            </Toggle>
          ))}
        </Section>
      )}
    </Form>
  )
}
