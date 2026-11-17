import {
  Button,
  Circle,
  ContentUnavailableView,
  HStack,
  LazyVGrid,
  NavigationStack,
  ProgressView,
  ScrollView,
  Text,
  VStack,
  useEffect,
  useState
} from 'scripting'
import type { Color } from 'scripting'
import { AppItem } from '../constants'
import { IconColorCandidate, extractIconColors } from '../iconColor'
import { useI18n } from '../i18n'
import { AppIconView } from './SharedViews'

const SECONDARY = 'secondaryLabel' as Color
const ACCENT = 'systemBlue' as Color

const GRID_COLUMNS = [
  {
    size: { type: 'adaptive' as const, min: 64, max: 64 },
    spacing: 14
  }
]

/**
 * Lists every colour found in the icon so the theme colour is a choice rather
 * than a guess. The most dominant colour is selected up front, matching what
 * tapping Apply right away would pick.
 */
export function IconColorSheet({
  icon,
  iconDark,
  iconType,
  onApply,
  onClose
}: {
  icon: string
  iconDark?: string
  iconType: AppItem['iconType']
  onApply: (hex: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [colors, setColors] = useState<IconColorCandidate[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    extractIconColors(icon, iconDark)
      .then(list => {
        if (cancelled) return
        setColors(list)
        setSelected(0)
      })
      .catch(e => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const current = colors[selected]

  return (
    <VStack
      frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }}
      presentationDetents={['medium', 'large']}
      presentationDragIndicator="visible"
    >
      <NavigationStack>
        <ScrollView
          navigationTitle={t('extractColorFromIcon')}
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            topBarLeading: [
              <Button title={t('cancel')} action={onClose} />
            ],
            confirmationAction: [
              <Button
                title={t('apply')}
                disabled={!current}
                action={() => {
                  if (!current) return
                  onApply(current.hex)
                  onClose()
                }}
              />
            ]
          }}
        >
          {loading ? (
            <VStack
              spacing={12}
              padding={{ horizontal: 24, vertical: 64 }}
              frame={{ maxWidth: 'infinity', alignment: 'center' }}
            >
              <ProgressView progressViewStyle="circular" />
              <Text font={13} foregroundStyle={SECONDARY}>
                {t('extractingColor')}
              </Text>
            </VStack>
          ) : colors.length === 0 ? (
            <ContentUnavailableView
              title={t('extractColorFromIcon')}
              systemImage="eyedropper"
              description={t('colorExtractFailed')}
            />
          ) : (
            <VStack
              spacing={18}
              padding={{ horizontal: 20, vertical: 18 }}
              frame={{ maxWidth: 'infinity', alignment: 'leading' }}
            >
              <HStack spacing={12}>
                <AppIconView
                  icon={icon}
                  iconDark={iconDark}
                  iconType={iconType}
                  color={current?.hex ?? '#007AFF'}
                  size={44}
                />
                <VStack alignment="leading" spacing={2}>
                  <Text font={17} fontWeight="semibold">
                    {current?.hex ?? ''}
                  </Text>
                  <Text font={12} foregroundStyle={SECONDARY}>
                    {`${Math.round((current?.fraction ?? 0) * 100)}%`}
                  </Text>
                </VStack>
              </HStack>

              <LazyVGrid
                columns={GRID_COLUMNS}
                alignment="leading"
                spacing={14}
                frame={{ maxWidth: 'infinity', alignment: 'leading' }}
              >
                {colors.map((candidate, index) => {
                  const isSelected = index === selected
                  return (
                    <Button
                      key={`${candidate.hex}-${index}`}
                      buttonStyle="plain"
                      action={() => setSelected(index)}
                      accessibilityLabel={candidate.hex}
                    >
                      <VStack spacing={6}>
                        <Circle
                          fill={candidate.hex as Color}
                          frame={{ width: 48, height: 48 }}
                          overlay={
                            isSelected ? (
                              <Circle
                                stroke={{
                                  shapeStyle: ACCENT,
                                  strokeStyle: { lineWidth: 2.5 }
                                }}
                                frame={{ width: 58, height: 58 }}
                              />
                            ) : undefined
                          }
                        />
                        <Text font={10} foregroundStyle={SECONDARY}>
                          {`${Math.round(candidate.fraction * 100)}%`}
                        </Text>
                      </VStack>
                    </Button>
                  )
                })}
              </LazyVGrid>

              <Text font={13} foregroundStyle={SECONDARY}>
                {t('iconColorsHint')}
              </Text>
            </VStack>
          )}
        </ScrollView>
      </NavigationStack>
    </VStack>
  )
}
