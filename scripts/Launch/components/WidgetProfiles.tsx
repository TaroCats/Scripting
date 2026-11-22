import {
  Button,
  Form,
  Group,
  HStack,
  List,
  Navigation,
  NavigationLink,
  Picker,
  Section,
  Spacer,
  Stepper,
  Text,
  TextField,
  Toggle,
  Widget,
  useState
} from 'scripting'
import {
  AppItem,
  Config,
  Folder,
  MAX_WIDGET_PANELS,
  MAX_WIDGET_PROFILES,
  PanelAlign,
  WIDGET_LAYOUT_SLOT_COUNT,
  WidgetLayout,
  WidgetPanelConfig,
  WidgetProfile,
  createWidgetProfile,
  duplicateWidgetProfile,
  normalizeWidgetSlots,
  previewFamilyForLayout,
  profileParameter,
  profilePanelConfigs,
  uniqueProfileName
} from '../constants'
import { TranslationKey, useI18n } from '../i18n'
import { PanelSettingsView } from './PanelSettings'

/** The localized name of a widget arrangement. */
function layoutLabel(
  t: (key: TranslationKey) => string,
  value?: WidgetLayout
) {
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

/**
 * The widget profiles screen: named presets that a Home Screen widget selects
 * through its parameter, so several widgets can each show different content
 * while the definitions live here.
 */
export function WidgetProfilesView({
  profiles,
  apps,
  folders,
  config,
  onChange
}: {
  profiles: WidgetProfile[]
  apps: AppItem[]
  folders: Folder[]
  config: Config
  onChange: (next: WidgetProfile[]) => void
}) {
  const { t } = useI18n()
  // A pushed page keeps the element it was opened with, so the rows are driven
  // by local state: editing or deleting inside a row must be reflected here.
  const [list, setList] = useState<WidgetProfile[]>(profiles)

  function commit(next: WidgetProfile[]) {
    setList(next)
    onChange(next)
  }

  function summary(profile: WidgetProfile) {
    const layout = profile.layout ?? config.widgetLayout ?? 'auto'
    const layoutName = layoutLabel(t, layout)
    const folder = folders.find(
      entry => entry.id === profile.folder || entry.name === profile.folder
    )
    const tokens = profile.panels
      ? profile.panels.map(panel => panel.folder)
      : profile.folders ?? []
    const panelNames = tokens
      .map(token =>
        folders.find(entry => entry.id === token || entry.name === token)?.name
      )
      .filter(Boolean)
      .join(', ')
    const target = panelNames || folder?.name
    return target ? `${layoutName} · ${target}` : layoutName
  }

  function addProfile() {
    if (list.length >= MAX_WIDGET_PROFILES) return
    const name = uniqueProfileName(t('widgetProfileDefaultTitle'), list)
    commit([...list, createWidgetProfile(name, config)])
  }

  function duplicate(index: number) {
    if (list.length >= MAX_WIDGET_PROFILES) return
    commit([
      ...list,
      duplicateWidgetProfile(list[index], list, t('widgetProfileCopySuffix'))
    ])
  }

  async function rename(index: number) {
    const profile = list[index]
    const name = await Dialog.prompt({
      title: t('widgetProfileRename'),
      message: t('widgetProfileNameFooter'),
      defaultValue: profile.name,
      confirmLabel: t('save'),
      cancelLabel: t('cancel')
    })
    const wanted = (name ?? '').trim()
    if (!wanted || wanted === profile.name) return
    const others = list.filter((_unused, position) => position !== index)
    const next = [...list]
    next[index] = { ...profile, name: uniqueProfileName(wanted, others) }
    commit(next)
  }

  function updateAt(index: number, next: WidgetProfile) {
    const nextList = [...list]
    nextList[index] = next
    commit(nextList)
  }

  function removeAt(index: number) {
    commit(list.filter((_unused, position) => position !== index))
  }

  return (
    <List
      navigationTitle={t('widgetProfiles')}
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
    >
      <Section footer={<Text>{t('widgetProfilesFooter')}</Text>}>
        {list.length === 0 ? (
          <Text foregroundStyle="secondaryLabel">
            {t('widgetProfilesEmpty')}
          </Text>
        ) : (
          list.map((profile, index) => (
            <NavigationLink
              key={profile.id}
              destination={
                <WidgetProfileEditor
                  profile={profile}
                  apps={apps}
                  folders={folders}
                  globalConfig={config}
                  onChange={next => updateAt(index, next)}
                  onDelete={() => removeAt(index)}
                />
              }
              contextMenu={{
                menuItems: (
                  <Group>
                    <Button
                      title={t('widgetProfileDuplicate')}
                      systemImage="doc.on.doc"
                      action={() => duplicate(index)}
                    />
                    <Button
                      title={t('widgetProfileRename')}
                      systemImage="pencil"
                      action={() => rename(index)}
                    />
                    <Button
                      title={t('deleteWidgetProfile')}
                      systemImage="trash"
                      role="destructive"
                      action={() => removeAt(index)}
                    />
                  </Group>
                )
              }}
            >
              <HStack>
                <Text>{profile.name}</Text>
                <Spacer />
                <Text opacity={0.5} lineLimit={1}>
                  {summary(profile)}
                </Text>
              </HStack>
            </NavigationLink>
          ))
        )}
      </Section>

      <Section>
        <Button
          title={t('addWidgetProfile')}
          systemImage="plus"
          action={addProfile}
        />
      </Section>
    </List>
  )
}

/**
 * The settings of one widget profile. Everything except the name is optional:
 * an unset field keeps following the default widget settings, so a profile can
 * pin only what makes it different.
 */
export function WidgetProfileEditor({
  profile,
  apps,
  folders,
  globalConfig,
  onChange,
  onDelete
}: {
  profile: WidgetProfile
  apps: AppItem[]
  folders: Folder[]
  globalConfig: Config
  onChange: (next: WidgetProfile) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const dismiss = Navigation.useDismiss()
  // A pushed page keeps the element it was opened with, so local state is what
  // makes the controls move and the base for every patch.
  const [draft, setDraft] = useState<WidgetProfile>(profile)

  function update(patch: Partial<WidgetProfile>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(next)
  }

  const layout: WidgetLayout = draft.layout ?? globalConfig.widgetLayout ?? 'auto'
  const slots = normalizeWidgetSlots(draft.slots)
  const slotCount = WIDGET_LAYOUT_SLOT_COUNT[layout]
  const slotValue = (index: number) =>
    apps.some(app => app.id === slots[index]) ? slots[index] : ''

  function updateSlot(index: number, value: string) {
    const next = normalizeWidgetSlots(draft.slots)
    next[index] = value
    update({ slots: next })
  }

  // Each profile edits its own panel list, seeded from the global panels for
  // older profiles that only stored folder names. Once a panel is edited the
  // result is written back to this profile, so different profiles can give
  // their regions completely different layouts and appearances.
  const panelList = profilePanelConfigs(
    draft,
    globalConfig.widgetPanels,
    folders
  )

  // A panel editor should show the profile's own appearance as the inherited
  // value, not the global one, so what it displays matches what the widget
  // renders for this profile.
  const panelConfigBase: Config = {
    ...globalConfig,
    iconSize: draft.iconSize ?? globalConfig.iconSize,
    spacing: draft.spacing ?? globalConfig.spacing,
    shape: draft.shape ?? globalConfig.shape,
    cornerRadius: draft.cornerRadius ?? globalConfig.cornerRadius,
    widgetAccentedRenderingMode:
      draft.widgetAccentedRenderingMode ??
      globalConfig.widgetAccentedRenderingMode
  }

  function updatePanel(index: number, panel: WidgetPanelConfig) {
    const next = panelList.map((entry, position) =>
      position === index ? panel : entry
    )
    update({
      panels: next,
      // Keep the folder projection in step for older readers and hand-typed
      // parameters that still arrive as `folders=...`.
      folders: next.map(entry => (entry.folder ?? '').trim())
    })
  }

  const divided = panelList.some(
    panel => (panel.folder ?? '').trim() !== ''
  )
  // A divided widget takes cover mode from each region, so a whole-profile
  // switch would be redundant. It stays for fixed layouts, where the widget
  // is one surface and there are no regions to configure.
  const showsWidgetCover = !(layout === 'auto' && divided)
  const customized =
    draft.iconSize !== undefined ||
    draft.spacing !== undefined ||
    draft.shape !== undefined ||
    draft.cornerRadius !== undefined ||
    draft.widgetAccentedRenderingMode !== undefined ||
    draft.align !== undefined

  async function preview() {
    const name = draft.name.trim()
    if (!name) return
    // Only an auto layout actually divides; a fixed layout renders the whole
    // widget, so the preview should use that layout's natural size.
    const family = previewFamilyForLayout(layout, layout === 'auto' && divided)
    try {
      await Widget.preview({
        family,
        parameters: {
          options: { [name]: JSON.stringify(profileParameter(draft)) },
          default: name
        }
      })
    } catch (error) {
      console.error(error)
      await Widget.preview({ family })
    }
  }

  return (
    <Form navigationTitle={draft.name.trim() || t('widgetProfiles')}>
      <Section footer={<Text>{t('widgetProfileNameFooter')}</Text>}>
        <TextField
          title={t('nameLabel')}
          value={draft.name}
          onChanged={value => update({ name: value })}
        />
      </Section>

      <Section
        header={<Text>{t('widgetProfileContent')}</Text>}
        footer={
          <Text>
            {divided
              ? `${t('widgetProfileContentFooter')} ${t('widgetProfileLayoutOverridesPanels')}`
              : t('widgetProfileContentFooter')}
          </Text>
        }
      >
        <Picker
          title={t('widgetLayout')}
          value={draft.layout ?? ''}
          onChanged={(value: string) =>
            update({ layout: value ? (value as WidgetLayout) : undefined })
          }
        >
          <Text tag="">{t('widgetProfileFollowGlobal')}</Text>
          <Text tag="auto">{t('widgetLayoutAuto')}</Text>
          <Text tag="single">{t('widgetLayoutSingle')}</Text>
          <Text tag="dual">{t('widgetLayoutDual')}</Text>
          <Text tag="triple">{t('widgetLayoutTriple')}</Text>
          <Text tag="quad">{t('widgetLayoutQuad')}</Text>
          <Text tag="six">{t('widgetLayoutSix')}</Text>
          <Text tag="nine">{t('widgetLayoutNine')}</Text>
        </Picker>

        <Picker
          title={t('panelFolder')}
          value={draft.folder ?? ''}
          onChanged={(value: string) => update({ folder: value || undefined })}
        >
          <Text tag="">{t('widgetProfileAllApps')}</Text>
          {folders.map(folder => (
            <Text key={folder.id} tag={folder.id}>
              {folder.name}
            </Text>
          ))}
        </Picker>

        {showsWidgetCover ? (
          <Toggle
            title={t('widgetCoverMode')}
            systemImage="rectangle.inset.filled"
            value={draft.cover ?? globalConfig.widgetCoverMode ?? false}
            onChanged={(value: boolean) => update({ cover: value })}
          />
        ) : null}
      </Section>

      {slotCount > 0 && layout !== 'auto' && (
        <Section
          header={<Text>{t('widgetSlots')}</Text>}
          footer={<Text>{t('widgetSlotsFooter')}</Text>}
        >
          {Array.from({ length: slotCount }, (_unused, index) => (
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
          ))}
        </Section>
      )}

      <Section
        header={<Text>{t('widgetPanels')}</Text>}
        footer={
          <Text>
            {folders.length < 2
              ? t('widgetPanelsEmpty')
              : t('widgetProfilePanelsFooter')}
          </Text>
        }
      >
        {folders.length < 2
          ? null
          : Array.from({ length: MAX_WIDGET_PANELS }, (_unused, index) => {
              const panel = panelList[index]
              const folder = folders.find(
                entry =>
                  entry.id === panel.folder || entry.name === panel.folder
              )
              return (
                <NavigationLink
                  key={index}
                  destination={
                    <PanelSettingsView
                      index={index}
                      panel={panel}
                      folders={folders}
                      globalConfig={panelConfigBase}
                      onChange={next => updatePanel(index, next)}
                    />
                  }
                >
                  <HStack>
                    <Text>{t('widgetPanelLabel', { index: index + 1 })}</Text>
                    <Spacer />
                    <Text opacity={0.5} lineLimit={1}>
                      {`${folder ? folder.name : t('widgetPanelDefault')} · ${layoutLabel(t, panel.layout ?? folder?.style?.layout)}`}
                    </Text>
                  </HStack>
                </NavigationLink>
              )
            })}
        {divided ? (
          <Picker
            title={t('panelAxisLabel')}
            value={draft.panelAxis ?? 'auto'}
            onChanged={(value: string) =>
              update({
                panelAxis:
                  value === 'auto'
                    ? undefined
                    : (value as 'vertical' | 'horizontal')
              })
            }
          >
            <Text tag="auto">{t('widgetProfileFollowGlobal')}</Text>
            <Text tag="vertical">{t('panelAxisRows')}</Text>
            <Text tag="horizontal">{t('panelAxisColumns')}</Text>
          </Picker>
        ) : null}
      </Section>

      <Section>
        <NavigationLink
          destination={
            <WidgetProfileAppearance
              profile={draft}
              globalConfig={globalConfig}
              onChange={next => update(next)}
            />
          }
        >
          <HStack>
            <Text>{t('appearance')}</Text>
            <Spacer />
            <Text opacity={0.5}>
              {customized
                ? t('widgetProfileCustomized')
                : t('widgetProfileFollowGlobal')}
            </Text>
          </HStack>
        </NavigationLink>
      </Section>

      <Section
        header={<Text>{t('widgetProfileParameter')}</Text>}
        footer={<Text>{t('widgetProfileParameterFooter')}</Text>}
      >
        <HStack>
          <Text font="footnote" lineLimit={1}>
            {profileParameter(draft)}
          </Text>
          <Spacer />
          <Button
            title={t('widgetProfileCopy')}
            systemImage="doc.on.doc"
            buttonStyle="plain"
            action={() => {
              Pasteboard.setString(profileParameter(draft))
            }}
          />
        </HStack>
        <Button
          title={t('previewWidget')}
          systemImage="rectangle.on.rectangle"
          disabled={!draft.name.trim()}
          action={preview}
        />
      </Section>

      <Section>
        <Button
          title={t('resetToGlobalSettings')}
          action={() =>
            update({
              layout: undefined,
              cover: undefined,
              slots: undefined,
              panels: undefined,
              folders: undefined,
              iconSize: undefined,
              spacing: undefined,
              shape: undefined,
              cornerRadius: undefined,
              widgetAccentedRenderingMode: undefined,
              align: undefined
            })
          }
        />
        <Button
          title={t('deleteWidgetProfile')}
          role="destructive"
          action={() => {
            onDelete()
            dismiss()
          }}
        />
      </Section>
    </Form>
  )
}

/**
 * The appearance overrides of a profile, kept on their own page so the profile
 * form stays short. Every control falls back to the default widget settings.
 */
function WidgetProfileAppearance({
  profile,
  globalConfig,
  onChange
}: {
  profile: WidgetProfile
  globalConfig: Config
  onChange: (next: WidgetProfile) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<WidgetProfile>(profile)

  function update(patch: Partial<WidgetProfile>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(next)
  }

  const follow = t('widgetProfileFollowGlobal')
  const iconSize = draft.iconSize ?? globalConfig.iconSize
  const spacing = draft.spacing ?? globalConfig.spacing
  const radius =
    draft.cornerRadius ?? Math.round(globalConfig.iconSize * 0.225)

  return (
    <Form navigationTitle={t('appearance')}>
      <Section footer={<Text>{t('widgetProfileContentFooter')}</Text>}>
        <Stepper
          onIncrement={() => {
            const value = iconSize + 1
            if (value <= 120) update({ iconSize: value })
          }}
          onDecrement={() => {
            const value = iconSize - 1
            if (value >= 12) update({ iconSize: value })
          }}
        >
          <HStack>
            <Text>{t('iconSize')}</Text>
            <Spacer />
            <Text opacity={0.5}>
              {`${iconSize}${draft.iconSize === undefined ? ` · ${follow}` : ''}`}
            </Text>
          </HStack>
        </Stepper>

        <Stepper
          onIncrement={() => {
            const value = spacing + 1
            if (value <= 60) update({ spacing: value })
          }}
          onDecrement={() => {
            const value = spacing - 1
            if (value >= 0) update({ spacing: value })
          }}
        >
          <HStack>
            <Text>{t('spacing')}</Text>
            <Spacer />
            <Text opacity={0.5}>
              {`${spacing}${draft.spacing === undefined ? ` · ${follow}` : ''}`}
            </Text>
          </HStack>
        </Stepper>

        <Picker
          title={t('iconShape')}
          value={draft.shape ?? ''}
          onChanged={(value: string) =>
            update({
              shape: value ? (value as 'rounded' | 'circle') : undefined
            })
          }
        >
          <Text tag="">{follow}</Text>
          <Text tag="rounded">{t('shapeRounded')}</Text>
          <Text tag="circle">{t('shapeCircle')}</Text>
        </Picker>

        <Stepper
          onIncrement={() => {
            const value = radius + 1
            if (value <= 60) update({ cornerRadius: value })
          }}
          onDecrement={() => {
            const value = radius - 1
            if (value >= 0) update({ cornerRadius: value })
          }}
        >
          <HStack>
            <Text>{t('cornerRadius')}</Text>
            <Spacer />
            <Text opacity={0.5}>
              {draft.cornerRadius === undefined ? follow : String(radius)}
            </Text>
          </HStack>
        </Stepper>

        <Picker
          title={t('iconRenderingMode')}
          value={draft.widgetAccentedRenderingMode ?? ''}
          onChanged={(value: string) =>
            update({
              widgetAccentedRenderingMode: value
                ? (value as Config['widgetAccentedRenderingMode'])
                : undefined
            })
          }
        >
          <Text tag="">{follow}</Text>
          <Text tag="fullColor">{t('renderFullColor')}</Text>
          <Text tag="accented">{t('renderAccented')}</Text>
          <Text tag="desaturated">{t('renderDesaturated')}</Text>
          <Text tag="accentedDesaturated">
            {t('renderAccentedDesaturated')}
          </Text>
        </Picker>

        <Picker
          title={t('panelAlign')}
          value={draft.align ?? 'center'}
          onChanged={(value: string) => update({ align: value as PanelAlign })}
        >
          <Text tag="center">{t('alignCenter')}</Text>
          <Text tag="top">{t('alignTop')}</Text>
          <Text tag="bottom">{t('alignBottom')}</Text>
        </Picker>
      </Section>
    </Form>
  )
}
