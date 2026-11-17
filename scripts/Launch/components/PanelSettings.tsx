import {
  Button,
  Form,
  HStack,
  Picker,
  Section,
  Spacer,
  Stepper,
  Text,
  Toggle,
  useState
} from 'scripting'
import {
  Config,
  Folder,
  FolderStyle,
  PanelAlign,
  WidgetLayout,
  WidgetPanelConfig
} from '../constants'
import { useI18n } from '../i18n'

/**
 * The settings for one panel of a divided widget: which folder it shows plus
 * that panel's own layout, icon size, spacing, shape and rendering mode.
 *
 * Every control writes straight through to the config, so the widget reloads
 * while the values are being changed. An unset value shows as "Auto" and keeps
 * following the folder style and then the global widget settings.
 */
export function PanelSettingsView({
  index,
  panel,
  folders,
  globalConfig,
  onChange
}: {
  index: number
  panel: WidgetPanelConfig
  folders: Folder[]
  globalConfig: Config
  onChange: (next: WidgetPanelConfig) => void
}) {
  const { t } = useI18n()

  // A pushed page keeps the element it was opened with, so the `panel` prop
  // never changes while editing. Local state is what makes the controls move,
  // and it is also the base for every patch: spreading the stale prop would
  // drop the fields edited just before.
  const [draft, setDraft] = useState<WidgetPanelConfig>(panel)

  function update(patch: Partial<WidgetPanelConfig>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(next)
  }

  // The folder's own appearance wins over this panel's overrides, so it is
  // resolved first and also shown as the source of whatever is in effect.
  const activeFolder = folders.find(
    entry => entry.id === draft.folder || entry.name === draft.folder
  )
  const folderStyle: FolderStyle = activeFolder?.style ?? {}
  const folderHasStyle = Object.keys(folderStyle).length > 0
  const fromFolder = (field: keyof FolderStyle) =>
    folderStyle[field] !== undefined

  const effectiveIconSize =
    folderStyle.iconSize ?? draft.iconSize ?? globalConfig.iconSize
  const effectiveSpacing =
    folderStyle.spacing ?? draft.spacing ?? globalConfig.spacing
  const effectiveShape =
    folderStyle.shape ?? draft.shape ?? globalConfig.shape
  const effectiveRadius =
    folderStyle.cornerRadius ??
    draft.cornerRadius ??
    effectiveIconSize * 0.225
  const effectiveRenderingMode =
    folderStyle.widgetAccentedRenderingMode ??
    draft.widgetAccentedRenderingMode ??
    globalConfig.widgetAccentedRenderingMode
  const effectiveLayout = folderStyle.layout ?? draft.layout ?? 'auto'
  const effectiveAlign: PanelAlign =
    folderStyle.align ?? draft.align ?? 'center'
  const effectiveCover = folderStyle.cover ?? draft.cover ?? false

  /** Trailing value text: the inherited value, the panel's own, or "Auto". */
  function valueLabel(
    field: keyof FolderStyle,
    own?: string | number
  ): string {
    if (fromFolder(field)) {
      return `${folderStyle[field]} · ${t('panelFromFolder')}`
    }
    return own !== undefined ? String(own) : t('panelAuto')
  }

  return (
    <Form navigationTitle={t('widgetPanelLabel', { index: index + 1 })}>
      <Section>
        <Picker
          title={t('panelFolder')}
          value={draft.folder ?? ''}
          onChanged={(value: string) => update({ folder: value })}
        >
          <Text tag="">{t('widgetPanelDefault')}</Text>
          {folders.map(folder => (
            <Text key={folder.id} tag={folder.id}>
              {folder.name}
            </Text>
          ))}
        </Picker>
      </Section>

      <Section
        header={<Text>{t('panelAppearance')}</Text>}
        footer={
          folderHasStyle ? <Text>{t('panelFolderOverrides')}</Text> : undefined
        }
      >
        <Picker
          title={t('widgetLayout')}
          value={effectiveLayout}
          onChanged={(value: string) =>
            update({ layout: value as WidgetLayout })
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

        <Picker
          title={t('panelAlign')}
          value={effectiveAlign}
          onChanged={(value: string) =>
            update({ align: value as PanelAlign })
          }
        >
          <Text tag="center">{t('alignCenter')}</Text>
          <Text tag="top">{t('alignTop')}</Text>
          <Text tag="bottom">{t('alignBottom')}</Text>
        </Picker>

        <Stepper
          onIncrement={() => {
            const value = effectiveIconSize + 1
            if (value <= 100) update({ iconSize: value })
          }}
          onDecrement={() => {
            const value = effectiveIconSize - 1
            if (value >= 12) update({ iconSize: value })
          }}
        >
          <HStack>
            <Text>{t('iconSize')}</Text>
            <Spacer />
            <Text opacity={0.5}>{valueLabel('iconSize', draft.iconSize)}</Text>
          </HStack>
        </Stepper>

        <Stepper
          onIncrement={() => {
            const value = effectiveSpacing + 1
            if (value <= 50) update({ spacing: value })
          }}
          onDecrement={() => {
            const value = effectiveSpacing - 1
            if (value >= 0) update({ spacing: value })
          }}
        >
          <HStack>
            <Text>{t('spacing')}</Text>
            <Spacer />
            <Text opacity={0.5}>{valueLabel('spacing', draft.spacing)}</Text>
          </HStack>
        </Stepper>

        <Picker
          title={t('iconShape')}
          value={effectiveShape}
          onChanged={(value: string) =>
            update({ shape: value as 'rounded' | 'circle' })
          }
        >
          <Text tag="rounded">{t('shapeRounded')}</Text>
          <Text tag="circle">{t('shapeCircle')}</Text>
        </Picker>

        {effectiveShape === 'rounded' && (
          <Stepper
            onIncrement={() => {
              const value = effectiveRadius + 1
              if (value <= 60) update({ cornerRadius: value })
            }}
            onDecrement={() => {
              const value = effectiveRadius - 1
              if (value >= 0) update({ cornerRadius: value })
            }}
          >
            <HStack>
              <Text>{t('cornerRadius')}</Text>
              <Spacer />
              <Text opacity={0.5}>
                {valueLabel('cornerRadius', draft.cornerRadius)}
              </Text>
            </HStack>
          </Stepper>
        )}

        <Picker
          title={t('iconRenderingMode')}
          value={effectiveRenderingMode}
          onChanged={(value: string) =>
            update({
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

        <Toggle
          title={t('widgetCoverMode')}
          systemImage="rectangle.inset.filled"
          value={effectiveCover}
          onChanged={(value: boolean) => update({ cover: value })}
        />
      </Section>

      <Section>
        <Button
          title={t('panelReset')}
          role="destructive"
          action={() => {
            const cleared: WidgetPanelConfig = { folder: draft.folder ?? '' }
            setDraft(cleared)
            onChange(cleared)
          }}
        />
      </Section>
    </Form>
  )
}
