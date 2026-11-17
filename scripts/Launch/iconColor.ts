import { resolveIconSource } from './constants'

/**
 * Theme colours sampled from an app icon.
 *
 * `UIImage.dominantColors` already clusters the bitmap, but its first result is
 * only "the most common colour": for a mostly white icon that is white, which
 * makes a poor theme colour. The picker below weighs coverage against
 * saturation, so a white icon with a colourful mark yields that mark instead.
 */

type Rgba = { red: number; green: number; blue: number; alpha: number }

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lightness({ red, green, blue }: Rgba) {
  return (Math.max(red, green, blue) + Math.min(red, green, blue)) / 2
}

/** HSV-style saturation, which stays meaningful for very light and dark hues. */
function saturation({ red, green, blue }: Rgba) {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  return max === 0 ? 0 : (max - min) / max
}

function toHex({ red, green, blue }: Rgba) {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase()
}

/**
 * Loads the bitmap behind an icon, preferring the downloaded cache over the
 * network. Icons without a bitmap (SF Symbols) resolve to null.
 */
async function loadIconImage(
  icon: string,
  iconDark?: string
): Promise<UIImage | null> {
  const source = icon.trim()
  if (!source) return null

  try {
    const resolved = resolveIconSource(source, iconDark)
    // A light/dark pair resolves as a single source object; sample the light one.
    const path =
      typeof resolved.source === 'string'
        ? resolved.source
        : resolved.source.light
    return resolved.kind === 'file'
      ? UIImage.fromFile(path)
      : path.startsWith('http')
        ? await UIImage.fromURL(path)
        : null
  } catch (e) {
    console.error(e)
    return null
  }
}

/** Picks the colour that will read best as a theme colour. */
function pickThemeColor(image: UIImage): string | undefined {
  let candidates: DominantColor[] = []
  try {
    candidates = image.dominantColors(8) ?? []
  } catch (e) {
    console.error(e)
  }

  const opaque = candidates.filter(entry => entry.color.alpha >= 0.5)
  let best: DominantColor | undefined
  let bestScore = 0

  for (const entry of opaque) {
    const l = lightness(entry.color)
    // Near-black and near-white make flat, unhelpful covers; only fall back to
    // them when nothing else exists.
    if (l < 0.08 || l > 0.94) continue
    const score = entry.fraction * (0.35 + saturation(entry.color))
    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }

  const chosen = best ?? opaque[0]
  if (chosen) return toHex(chosen.color)

  try {
    const average = image.averageColor()
    return average ? toHex(average) : undefined
  } catch (e) {
    console.error(e)
    return undefined
  }
}

/** Returns a `#RRGGBB` theme colour sampled from the icon, when it has a bitmap. */
export async function extractIconColor(
  icon: string,
  iconDark?: string
): Promise<string | undefined> {
  const image = await loadIconImage(icon, iconDark)
  if (!image) return undefined
  return pickThemeColor(image)
}

/** One colour of an icon, with the share of the icon it covers. */
export interface IconColorCandidate {
  hex: string
  /** Fraction of the icon covered by this colour, 0..1. */
  fraction: number
}

/** Colours closer than this (in RGB distance) are treated as the same swatch. */
const DUPLICATE_DISTANCE = 0.11

function distance(a: Rgba, b: Rgba) {
  return Math.sqrt(
    (a.red - b.red) ** 2 + (a.green - b.green) ** 2 + (a.blue - b.blue) ** 2
  )
}

/**
 * Every distinct colour of an icon, ordered from most to least dominant, for
 * the colour picker. Near-identical shades are collapsed so a gradient icon
 * does not fill the list with the same hue.
 */
export async function extractIconColors(
  icon: string,
  iconDark?: string,
  count = 16
): Promise<IconColorCandidate[]> {
  const image = await loadIconImage(icon, iconDark)
  if (!image) return []

  let entries: DominantColor[] = []
  try {
    entries = image.dominantColors(count) ?? []
  } catch (e) {
    console.error(e)
  }

  const opaque = entries
    .filter(entry => entry.color.alpha >= 0.5)
    .sort((a, b) => b.fraction - a.fraction)

  const kept: { rgba: Rgba; candidate: IconColorCandidate }[] = []
  for (const entry of opaque) {
    const rgba = entry.color
    if (kept.some(item => distance(item.rgba, rgba) < DUPLICATE_DISTANCE)) {
      continue
    }
    kept.push({
      rgba,
      candidate: { hex: toHex(rgba), fraction: entry.fraction }
    })
  }

  if (kept.length === 0) {
    try {
      const average = image.averageColor()
      if (average && average.alpha >= 0.5) {
        kept.push({
          rgba: average,
          candidate: { hex: toHex(average), fraction: 1 }
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  return kept.map(item => item.candidate)
}
