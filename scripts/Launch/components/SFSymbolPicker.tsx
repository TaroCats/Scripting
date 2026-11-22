import {
  Button,
  Color,
  Form,
  HStack,
  Image,
  LazyVGrid,
  Navigation,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
  ZStack,
  useState
} from 'scripting'
import {
  SF_SYMBOL_GROUPS,
  SF_SYMBOL_VARIANTS,
  composeSymbolName,
  splitSymbolName
} from '../sfSymbols'
import { TranslationKey, useI18n } from '../i18n'

const GRID_COLUMNS = [
  {
    size: { type: 'adaptive' as const, min: 64, max: 'infinity' as const },
    spacing: 10
  }
]

/**
 * A searchable, variant-aware picker for SF Symbols.
 *
 * Scripting has no API to enumerate the system symbol library, so the choices
 * come from the curated catalogue in `sfSymbols.ts`. Each candidate is checked
 * with `UIImage.fromSFSymbol` before it is shown, which keeps the grid free of
 * blank tiles on older iOS versions. Selecting a symbol composes the base name
 * with the chosen variant suffix and hands the resulting system name back; the
 * caller stores it as a plain string, so no data-model migration is needed.
 */
export function SFSymbolPicker({
  name,
  color,
  onSelect
}: {
  name: string
  color?: Color
  onSelect: (name: string) => void
}) {
  const { t } = useI18n()
  const dismiss = Navigation.useDismiss()
  const initial = splitSymbolName(name)
  const [variantId, setVariantId] = useState(initial.variantId)
  const [query, setQuery] = useState('')

  const variant =
    SF_SYMBOL_VARIANTS.find(entry => entry.id === variantId) ??
    SF_SYMBOL_VARIANTS[0]

  const q = query.trim().toLowerCase()
  const matchesQuery = (base: string) => {
    if (!q) return true
    const composed = composeSymbolName(base, variant.suffix)
    return (
      base.toLowerCase().includes(q) ||
      composed.toLowerCase().includes(q) ||
      t(variant.labelKey as TranslationKey).toLowerCase().includes(q)
    )
  }

  // Compose the current variant for every base name, then drop anything the
  // system cannot render. The current selection is always added so a symbol
  // saved by hand or by another iOS version stays visible and selectable.
  const groups = SF_SYMBOL_GROUPS.map(group => {
    const seen = new Set<string>()
    const items: { name: string; base: string }[] = []
    for (const base of group.names) {
      const name = composeSymbolName(base, variant.suffix)
      if (!name || seen.has(name)) continue
      if (!UIImage.fromSFSymbol(name)) continue
      if (!matchesQuery(base)) continue
      seen.add(name)
      items.push({ name, base })
    }
    return { title: t(group.titleKey as TranslationKey), items }
  }).filter(group => group.items.length > 0)

  const current =
    composeSymbolName(initial.base, variant.suffix) ||
    composeSymbolName(name, '')
  const highlight = !!current && !!UIImage.fromSFSymbol(current)

  // A symbol name typed into the search field that is not in the catalogue
  // can still be used: compose it with the current variant and offer it as a
  // custom choice. Validity is checked when possible, but an unknown name is
  // still offered so names added in a newer iOS version remain selectable.
  const typedBase = query.trim()
  const typedName = typedBase
    ? composeSymbolName(typedBase, variant.suffix)
    : ''
  const typedValid = !!typedName && !!UIImage.fromSFSymbol(typedName)
  const inCatalogue = groups.some(group =>
    group.items.some(item => item.name === typedName)
  )
  const showCustom = !!typedName && !inCatalogue

  function choose(candidate: string) {
    if (!candidate) return
    onSelect(candidate)
    dismiss()
  }

  const cell = ({ name, base }: { name: string; base: string }) => (
    <Button
      key={name}
      action={() => choose(name)}
      buttonStyle="plain"
      accessibilityLabel={name}
    >
      <VStack spacing={4} frame={{ width: 64, height: 62 }}>
        <ZStack
          frame={{ width: 34, height: 34 }}
          background={
            name === current
              ? ('tertiarySystemFill' as Color)
              : ('clear' as Color)
          }
          clipShape={{ type: 'rect', cornerRadius: 8 }}
        >
          <Image
            systemName={name}
            font={22}
            foregroundStyle={(color ?? 'label') as Color}
          />
        </ZStack>
        <Text font={8} lineLimit={1} foregroundStyle={'secondaryLabel' as Color}>
          {base.split('.').pop() ?? base}
        </Text>
      </VStack>
    </Button>
  )

  return (
    <Form navigationTitle={t('sfSymbol')}>
      <Section footer={<Text>{t('sfSymbolPickerFooter')}</Text>}>
        <Picker
          title={t('sfVariantTitle')}
          value={variantId}
          onChanged={(value: string) => setVariantId(value)}
        >
          {SF_SYMBOL_VARIANTS.map(entry => (
            <Text key={entry.id} tag={entry.id}>
              {t(entry.labelKey as TranslationKey)}
            </Text>
          ))}
        </Picker>
        <TextField
          label={<Text>{t('sfSymbolSearch')}</Text>}
          prompt={t('sfSymbolSearchPrompt')}
          value={query}
          onChanged={setQuery}
          autocorrectionDisabled
        />
      </Section>

      {highlight ? (
        <Section header={<Text>{t('sfSymbolCurrent')}</Text>}>
          <Button
            action={() => choose(current)}
            buttonStyle="plain"
            accessibilityLabel={current}
          >
            <HStack spacing={12}>
              <Image
                systemName={current}
                font={26}
                foregroundStyle={(color ?? 'label') as Color}
                frame={{ width: 36, height: 36 }}
              />
              <VStack alignment="leading" spacing={2}>
                <Text font={14}>{current}</Text>
                <Text font={11} foregroundStyle={'secondaryLabel' as Color}>
                  {t('sfSymbolUseCurrent')}
                </Text>
              </VStack>
              <Spacer />
              <Image
                systemName="checkmark.circle.fill"
                foregroundStyle={'systemBlue' as Color}
              />
            </HStack>
          </Button>
        </Section>
      ) : null}

      {showCustom ? (
        <Section header={<Text>{t('sfSymbolCustom')}</Text>}>
          <Button
            action={() => choose(typedName)}
            buttonStyle="plain"
            accessibilityLabel={typedName}
          >
            <HStack spacing={12}>
              {typedValid ? (
                <Image
                  systemName={typedName}
                  font={26}
                  foregroundStyle={(color ?? 'label') as Color}
                  frame={{ width: 36, height: 36 }}
                />
              ) : (
                <Image
                  systemName="questionmark.circle"
                  font={26}
                  foregroundStyle={'secondaryLabel' as Color}
                  frame={{ width: 36, height: 36 }}
                />
              )}
              <VStack alignment="leading" spacing={2}>
                <Text font={14}>{typedName}</Text>
                <Text font={11} foregroundStyle={'secondaryLabel' as Color}>
                  {t('sfSymbolUseTyped')}
                </Text>
              </VStack>
              <Spacer />
              <Image
                systemName="plus.circle"
                foregroundStyle={'systemBlue' as Color}
              />
            </HStack>
          </Button>
        </Section>
      ) : null}

      {groups.map(group => (
        <Section key={group.title} header={<Text>{group.title}</Text>}>
          <LazyVGrid columns={GRID_COLUMNS} alignment="center" spacing={10}>
            {group.items.map(cell)}
          </LazyVGrid>
        </Section>
      ))}

      {groups.length === 0 && !showCustom ? (
        <Section>
          <Text foregroundStyle={'secondaryLabel' as Color}>
            {t('sfSymbolNoResults')}
          </Text>
        </Section>
      ) : null}
    </Form>
  )
}
