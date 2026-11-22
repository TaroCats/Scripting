/**
 * A curated catalogue of SF Symbol base names, grouped so the picker can be
 * browsed without relying on an API to enumerate the system symbol library
 * (Scripting does not expose one). Names here are the *base* form; the picker
 * appends a variant suffix such as `.fill` or `.circle` when one is chosen.
 *
 * Every name is validated with `UIImage.fromSFSymbol` before it is offered, so
 * an entry that is unavailable on the current iOS version is simply skipped
 * instead of rendering a blank tile.
 */

export interface SFSymbolGroup {
  /** i18n key used as the section title. */
  titleKey: string
  names: string[]
}

export const SF_SYMBOL_GROUPS: SFSymbolGroup[] = [
  {
    titleKey: 'sfGroupCommon',
    names: [
      'star', 'heart', 'house', 'bookmark', 'flag', 'tag', 'bolt',
      'sparkles', 'moon', 'cloud', 'cloud.sun', 'cloud.rain',
      'cloud.bolt', 'cloud.snow', 'cloud.fog', 'flame', 'drop',
      'leaf', 'tree', 'circle', 'square', 'triangle', 'diamond',
      'seal', 'rosette', 'bell', 'gift', 'key', 'lock',
      'eye', 'eye.slash', 'magnifyingglass', 'gearshape', 'wrench',
      'hammer', 'pencil', 'scribble', 'paperclip', 'link', 'photo',
      'camera', 'video', 'music.note', 'play', 'pause', 'stop',
      'forward', 'backward', 'repeat', 'shuffle', 'volume', 'speaker'
    ]
  },
  {
    titleKey: 'sfGroupCommunication',
    names: [
      'message', 'message.circle', 'message.fill', 'bubble.left',
      'bubble.right', 'bubble.left.and.bubble.right', 'envelope',
      'envelope.circle', 'envelope.open', 'phone', 'phone.circle',
      'video.circle',
      'at', 'mail', 'mail.stack', 'person.crop.circle.badge.exclamationmark',
      'questionmark.circle', 'exclamationmark.circle', 'info.circle',
      'bell.and.waveform', 'teletype', 'faxmachine', 'map'
    ]
  },
  {
    titleKey: 'sfGroupObjects',
    names: [
      'app', 'app.dashed', 'app.badge', 'app.gift', 'appclip',
      'folder', 'folder.circle', 'doc', 'doc.circle', 'doc.text',
      'doc.plaintext', 'book', 'book.circle', 'book.fill', 'newspaper',
      'calendar', 'calendar.circle', 'clock', 'alarm', 'timer',
      'stopwatch', 'archivebox', 'trash', 'internaldrive',
      'externaldrive', 'opticaldisc', 'server.rack', 'desktopcomputer',
      'laptopcomputer', 'ipad', 'iphone', 'tv',
      'printer', 'scanner', 'keyboard', 'display'
    ]
  },
  {
    titleKey: 'sfGroupArrows',
    names: [
      'arrow.up', 'arrow.down', 'arrow.left', 'arrow.right',
      'arrow.up.circle', 'arrow.down.circle', 'arrow.left.circle',
      'arrow.right.circle', 'arrow.up.square', 'arrow.down.square',
      'arrow.left.square', 'arrow.right.square', 'arrow.uturn.backward',
      'arrow.uturn.forward', 'arrow.left.arrow.right',
      'arrow.up.and.down', 'arrow.down.and.line.horizontal.and.arrow.up',
      'chevron.up', 'chevron.down', 'chevron.left', 'chevron.right',
      'chevron.up.chevron.down', 'chevron.left.chevron.right',
      'chevron.left.forwardslash.chevron.right', 'lessthan', 'greaterthan',
      'equal', 'plus', 'minus', 'multiply', 'divide', 'xmark', 'checkmark'
    ]
  },
  {
    titleKey: 'sfGroupPeople',
    names: [
      'person', 'person.circle', 'person.fill', 'person.crop.circle',
      'person.2', 'person.3', 'person.bust', 'figure.walk',
      'figure.run', 'figure.stand', 'figure.seated.side',
      'hand.raised', 'hand.thumbsup', 'hand.thumbsdown', 'hand.point.up.left',
      'hand.draw', 'hand.pinch',
      'eye', 'brain', 'heart.circle', 'heart.square'
    ]
  },
  {
    titleKey: 'sfGroupTransport',
    names: [
      'car', 'car.circle', 'car.fill', 'bus', 'tram',
      'bicycle', 'scooter', 'airplane', 'airplane.circle',
      'sailboat', 'fuelpump', 'parkingsign', 'steeringwheel',
      'location', 'location.circle', 'map', 'map.circle',
      'map.fill', 'signpost.left', 'signpost.right'
    ]
  },
  {
    titleKey: 'sfGroupNature',
    names: [
      'sun.max', 'sun.min', 'moon.stars', 'moon.zzz', 'sparkle',
      'cloud.drizzle', 'cloud.hail', 'cloud.sleet', 'cloud.sun.rain',
      'cloud.bolt.rain', 'wind', 'tornado', 'hurricane', 'thermometer',
      'thermometer.sun', 'thermometer.snowflake', 'umbrella', 'umbrella.fill',
      'snowflake', 'wave.3.right', 'flame', 'flame.fill',
      'leaf', 'leaf.fill', 'tree.fill', 'ant', 'bird', 'fish',
      'cat', 'dog', 'tortoise', 'pawprint'
    ]
  },
  {
    titleKey: 'sfGroupHealth',
    names: [
      'heart.fill', 'heart.circle.fill', 'heart.square.fill',
      'waveform.path.ecg', 'cross', 'cross.circle', 'cross.fill',
      'medical.thermometer', 'syringe', 'pills', 'pill', 'capsule',
      'bed.double', 'bed.double.fill', 'figure.walk', 'dumbbell.fill',
      'eyeglasses', 'ear', 'nose', 'brain', 'lungs', 'stethoscope'
    ]
  },
  {
    titleKey: 'sfGroupBusiness',
    names: [
      'dollarsign.circle', 'eurosign.circle',
      'creditcard', 'creditcard.circle', 'wallet.pass', 'banknote',
      'chart.bar', 'chart.line.uptrend.xyaxis', 'chart.pie',
      'chart.xyaxis.line', 'briefcase', 'briefcase.fill', 'bag',
      'cart', 'cart.fill', 'basket.fill', 'storefront', 'dollarsign'
    ]
  },
  {
    titleKey: 'sfGroupSymbols',
    names: [
      'questionmark', 'questionmark.circle', 'exclamationmark',
      'exclamationmark.triangle', 'info', 'info.circle', 'xmark.circle',
      'checkmark.circle', 'checkmark.square', 'minus.circle',
      'plus.circle', 'plus.square', 'multiply.circle', 'divide.circle',
      'asterisk.circle', 'bolt.circle', 'bubbles.and.sparkles',
      'sparkles', 'sparkle', 'circle.grid.3x3', 'square.grid.2x2',
      'square.grid.3x3', 'circle.grid.cross',
      'command', 'option', 'control', 'shift', 'capslock', 'delete.left',
      'clear', 'infinity', 'function'
    ]
  }
]

/** Variant suffixes appended to a base symbol name. `none` keeps the base. */
export interface SFSymbolVariant {
  id: string
  /** Suffix appended to the base name. Empty means the base name itself. */
  suffix: string
  /** i18n key for the human readable label. */
  labelKey: string
}

export const SF_SYMBOL_VARIANTS: SFSymbolVariant[] = [
  { id: 'none', suffix: '', labelKey: 'sfVariantNone' },
  { id: 'fill', suffix: '.fill', labelKey: 'sfVariantFill' },
  { id: 'circle', suffix: '.circle', labelKey: 'sfVariantCircle' },
  { id: 'circle.fill', suffix: '.circle.fill', labelKey: 'sfVariantCircleFill' },
  { id: 'square', suffix: '.square', labelKey: 'sfVariantSquare' },
  { id: 'rectangle', suffix: '.rectangle', labelKey: 'sfVariantRectangle' },
  { id: 'slash', suffix: '.slash', labelKey: 'sfVariantSlash' }
]

/**
 * Applies a variant to a base name. When the base already ends with the same
 * suffix (common for names stored as `.fill` directly), the suffix is not
 * appended a second time.
 */
export function composeSymbolName(base: string, suffix: string): string {
  const clean = base.trim()
  if (!clean || !suffix) return clean
  return clean.endsWith(suffix) ? clean : `${clean}${suffix}`
}

/**
 * Splits a stored symbol name into a base name and the matching variant id,
 * so the picker can open with the current choice selected.
 */
export function splitSymbolName(name: string): { base: string; variantId: string } {
  const clean = name.trim()
  // Longest suffix first so `.circle.fill` wins over `.fill` / `.circle`.
  const ordered = [...SF_SYMBOL_VARIANTS].sort(
    (a, b) => b.suffix.length - a.suffix.length
  )
  for (const variant of ordered) {
    if (variant.suffix && clean.endsWith(variant.suffix)) {
      return {
        base: clean.slice(0, -variant.suffix.length),
        variantId: variant.id
      }
    }
  }
  return { base: clean, variantId: 'none' }
}
