import {
  Button,
  Color,
  HStack,
  Image,
  LazyVGrid,
  Navigation,
  Picker,
  ScrollView,
  Spacer,
  Text,
  TextField,
  VStack,
  ZStack,
  useRef,
  useState
} from 'scripting'
import {
  SMARTISAN_CATEGORIES,
  SmartisanCategory,
  SmartisanIcon,
  searchSmartisanIcons,
  smartisanFallbackUrl
} from '../smartisanIcons'
import { TranslationKey, useI18n } from '../i18n'

const GRID_COLUMNS = [
  {
    size: { type: 'adaptive' as const, min: 68, max: 'infinity' as const },
    spacing: 10
  }
]

/** Icons rendered per page. A small page keeps the initial view light. */
const PAGE_SIZE = 60

/** Per-cell image that falls back from Gitee to GitHub on load failure. */
function IconThumb({ icon }: { icon: SmartisanIcon }) {
  const [url, setUrl] = useState(icon.url)
  const placeholder = (
    <ZStack
      frame={{ width: 44, height: 44 }}
      background={('tertiarySystemFill' as Color)}
      clipShape={{ type: 'rect', cornerRadius: 10 }}
    />
  )
  return (
    <Image
      imageUrl={url}
      resizable
      scaleToFit
      placeholder={placeholder}
      onError={() => {
        const next = smartisanFallbackUrl(url)
        if (next) setUrl(next)
      }}
      frame={{ width: 44, height: 44 }}
    />
  )
}

/**
 * Searchable picker for the bundled Hammer (Smartisan OS) icon catalogue.
 *
 * The grid only ever holds one small page of cells. Scrolling towards the
 * bottom grows the page, so hundreds of icons are never materialised at once.
 * `LazyVGrid` inside a real `ScrollView` creates only the visible cells, which
 * keeps memory flat even after several pages have been appended.
 */
export function SmartisanIconPicker({
  onSelect
}: {
  onSelect: (url: string, name: string) => void
}) {
  const { t } = useI18n()
  const dismiss = Navigation.useDismiss()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SmartisanCategory>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  // Refs let the scroll callback read the live page size without re-registering
  // the native observer, and stop two geometry events adding the same page.
  const limitRef = useRef(PAGE_SIZE)
  const busyRef = useRef(false)

  const result = searchSmartisanIcons(query, category, limit)
  const truncated = result.total > result.items.length

  function resetPage() {
    limitRef.current = PAGE_SIZE
    setLimit(PAGE_SIZE)
  }

  function loadMore() {
    if (busyRef.current || limitRef.current >= result.total) return
    busyRef.current = true
    const next = Math.min(limitRef.current + PAGE_SIZE, result.total)
    limitRef.current = next
    setLimit(next)
    // Let the new cells lay out before another page can be requested.
    setTimeout(() => {
      busyRef.current = false
    }, 120)
  }

  function choose(icon: SmartisanIcon) {
    onSelect(icon.url, icon.label)
    dismiss()
  }

  const cell = (icon: SmartisanIcon) => (
    <Button
      key={icon.name}
      action={() => choose(icon)}
      buttonStyle="plain"
      accessibilityLabel={icon.label}
    >
      <VStack spacing={4} frame={{ width: 68, height: 78 }}>
        <IconThumb icon={icon} />
        <Text font={8} lineLimit={1} foregroundStyle={'secondaryLabel' as Color}>
          {icon.label}
        </Text>
      </VStack>
    </Button>
  )

  return (
    <ScrollView
      navigationTitle={t('iconTypeSmartisan')}
      onScrollGeometryChange={{
        of: 'geometry',
        onChanged: (_old, next) => {
          // Trigger when the bottom edge is within roughly one screen.
          const bottom = next.contentOffset.y + next.containerSize.height
          if (next.contentSize.height - bottom < 400) loadMore()
        }
      }}
    >
      <VStack
        spacing={12}
        padding={{ horizontal: 16, vertical: 12 }}
        frame={{ maxWidth: 'infinity', alignment: 'leading' }}
      >
        <TextField
          label={<Text>{t('smartisanSearch')}</Text>}
          prompt={t('smartisanSearchPrompt')}
          value={query}
          onChanged={value => {
            setQuery(value)
            resetPage()
          }}
          autocorrectionDisabled
        />
        <Picker
          title={t('smartisanCategory')}
          value={category}
          onChanged={(value: string) => {
            setCategory(value as SmartisanCategory)
            resetPage()
          }}
        >
          {SMARTISAN_CATEGORIES.map(cat => (
            <Text key={cat} tag={cat}>
              {t(`smartisanCat_${cat}` as TranslationKey)}
            </Text>
          ))}
        </Picker>
        <HStack>
          <Text font={12} foregroundStyle={'secondaryLabel' as Color}>
            {t('smartisanResultCount', { count: result.total })}
          </Text>
          <Spacer />
          <Text font={11} foregroundStyle={'secondaryLabel' as Color}>
            {`${result.items.length} / ${result.total}`}
          </Text>
        </HStack>
        <Text font={11} foregroundStyle={'secondaryLabel' as Color}>
          {t('smartisanPickerFooter')}
        </Text>

        <LazyVGrid columns={GRID_COLUMNS} alignment="center" spacing={10}>
          {result.items.map(cell)}
        </LazyVGrid>

        {truncated ? (
          // Manual fallback: onScrollGeometryChange needs iOS 18+. The button
          // also helps when a fast fling stops just short of the threshold.
          <Button
            title={t('smartisanLoadMore')}
            systemImage="chevron.down"
            buttonStyle="bordered"
            action={loadMore}
          />
        ) : null}
        {result.items.length === 0 ? (
          <Text foregroundStyle={'secondaryLabel' as Color}>
            {t('smartisanNoResults')}
          </Text>
        ) : null}
      </VStack>
    </ScrollView>
  )
}
