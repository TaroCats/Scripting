import {
  Button,
  Form,
  HStack,
  NavigationLink,
  Picker,
  Section,
  Spacer,
  Text,
  Toggle,
  Widget
} from 'scripting'
import {
  AppItem,
  Config,
  Folder,
  MAX_WIDGET_PANELS,
  WIDGET_LAYOUT_SLOT_COUNT,
  WidgetLayout,
  WidgetPanelConfig,
  buildWidgetParameter,
  normalizeWidgetPanels,
  normalizeWidgetProfiles,
  normalizeWidgetSlots,
  panelFolderNames,
  profileParameter
} from '../constants'
import { PanelSettingsView } from './PanelSettings'
import { useI18n } from '../i18n'

/** The most informative widget size to demo each layout in. */
const PREVIEW_FAMILY: Record<
  WidgetLayout,
  'systemSmall' | 'systemMedium' | 'systemLarge'
> = {
  auto: 'systemMedium',
  single: 'systemSmall',
  dual: 'systemMedium',
  triple: 'systemMedium',
  quad: 'systemMedium',
  // The denser grids need the tall widget to show every row.
  six: 'systemLarge',
  nine: 'systemLarge'
}

/**
 * The settings a widget uses when its parameter does not name a profile. Kept
 * on its own page so the settings list stays short: most people configure a
 * profile instead of these.
 */
export function WidgetDefaultsView({
  config,
  apps,
  folders,
  onSaveConfig
}: {
  config: Config
  apps: AppItem[]
  folders: Folder[]
  onSaveConfig: (patch: Partial<Config>) => void
}) {
  const { t } = useI18n()
  const layout: WidgetLayout = config.widgetLayout ?? 'auto'
  const slots = normalizeWidgetSlots(config.widgetSlots)
  const panels = normalizeWidgetPanels(config.widgetPanels)
  const profiles = normalizeWidgetProfiles(config.widgetProfiles)

  const slotValue = (index: number) =>
    apps.some(app => app.id === slots[index]) ? slots[index] : ''

  function updateSlot(index: number, value: string) {
    const next = normalizeWidgetSlots(config.widgetSlots)
    next[index] = value
    onSaveConfig({ widgetSlots: next })
  }

  function updatePanel(index: number, panel: WidgetPanelConfig) {
    const next = normalizeWidgetPanels(config.widgetPanels)
    next[index] = panel
    onSaveConfig({ widgetPanels: next })
  }

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

  async function previewWidget() {
    // A large widget divides into two panels and the extra-large into three,
    // so preview those sizes when panels are configured. Panels only apply
    // while the layout is auto; a fixed layout renders the whole widget.
    const panelNames = panelFolderNames(panels)
    const divided = panelNames.length > 0 && layout === 'auto'
    const family = divided
      ? PREVIEW_FAMILY[layout] === 'systemSmall'
        ? 'systemMedium'
        : 'systemLarge'
      : PREVIEW_FAMILY[layout]
    // Cover mode is left out on purpose: it is a global default, and writing
    // it into the parameter would turn it into a widget-level override that
    // outranks the per-panel and per-folder settings the preview is meant to
    // show. The widget reads the global value itself when the parameter is
    // silent.
    const parameter = buildWidgetParameter(
      layout,
      undefined,
      undefined,
      panelNames
    )
    const optionName = t('widget')
    // Every saved profile is offered as its own preview option, so the widget's
    // per-instance content can be checked without editing a real widget.
    const options: Record<string, string> = {
      [optionName]: JSON.stringify(parameter)
    }
    for (const profile of profiles) {
      options[profile.name] = JSON.stringify(profileParameter(profile))
    }
    try {
      await Widget.preview({
        family,
        parameters: { options, default: optionName }
      })
    } catch (error) {
      console.error(error)
      await Widget.preview({ family })
    }
  }

  return (
    <Form navigationTitle={t('widgetDefaults')}>
      <Section footer={<Text>{t('widgetLayoutFooter')}</Text>}>
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
          <Text tag="triple">{t('widgetLayoutTriple')}</Text>
          <Text tag="quad">{t('widgetLayoutQuad')}</Text>
          <Text tag="six">{t('widgetLayoutSix')}</Text>
          <Text tag="nine">{t('widgetLayoutNine')}</Text>
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
          footer={<Text>{t('widgetSlotsFooter')}</Text>}
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
        header={<Text>{t('widgetPanels')}</Text>}
        footer={
          <Text>
            {folders.length < 2
              ? t('widgetPanelsEmpty')
              : t('widgetPanelsFooter')}
          </Text>
        }
      >
        {folders.length < 2
          ? null
          : Array.from({ length: MAX_WIDGET_PANELS }, (_unused, index) => {
              const panel = panels[index]
              const folder = folders.find(
                entry => entry.id === panel.folder || entry.name === panel.folder
              )
              return (
                <NavigationLink
                  key={index}
                  destination={
                    <PanelSettingsView
                      index={index}
                      panel={panel}
                      folders={folders}
                      globalConfig={config}
                      onChange={next => updatePanel(index, next)}
                    />
                  }
                >
                  <HStack>
                    <Text>{t('widgetPanelLabel', { index: index + 1 })}</Text>
                    <Spacer />
                    <Text opacity={0.5} lineLimit={1}>
                      {`${folder ? folder.name : t('widgetPanelDefault')} · ${layoutLabel(panel.layout ?? folder?.style?.layout)}`}
                    </Text>
                  </HStack>
                </NavigationLink>
              )
            })}
      </Section>

      <Section>
        <Button
          title={t('previewWidget')}
          systemImage="rectangle.on.rectangle"
          action={previewWidget}
        />
      </Section>
    </Form>
  )
}
