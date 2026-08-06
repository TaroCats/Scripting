import { type AgendaItem } from "./shared_types"

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export function sortEvents<T extends { startDate: Date }>(events: T[]) {
  return [...events].sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
}

export function formatPlacemark(placemark: Record<string, unknown> | undefined) {
  if (!placemark) return "当前位置"
  const keys = ["name", "locality", "subLocality", "administrativeArea"]
  const parts = keys
    .map((key) => placemark[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
  return parts.length > 0 ? parts.join(" ") : "当前位置"
}

export function createFormatter(dateStyle: DateFormatterStyle, timeStyle: DateFormatterStyle) {
  /** @ts-ignore */
  const formatter = new DateFormatter()
  formatter.locale = "zh_CN"
  formatter.dateStyle = dateStyle
  formatter.timeStyle = timeStyle
  return formatter
}

/** @ts-ignore */
const dayFormatter = createFormatter(DateFormatterStyle.medium, DateFormatterStyle.none)
/** @ts-ignore */
const timeFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.short)
/** @ts-ignore */
const dayTimeFormatter = createFormatter(DateFormatterStyle.medium, DateFormatterStyle.short)
/** @ts-ignore */
const dayFormatter2 = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)
/** @ts-ignore */
const weekdayFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)
/** @ts-ignore */
const lunarFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)

export function formatEventTime(event: AgendaItem) {
  if (event.isAllDay) return "全天"
  return `${timeFormatter.string(event.startDate)} - ${timeFormatter.string(event.endDate)}`
}

export function formatEventDateTime(event: AgendaItem) {
  if (event.isAllDay) return `${dayFormatter.string(event.startDate)} 全天`
  return `${dayTimeFormatter.string(event.startDate)} - ${timeFormatter.string(event.endDate)}`
}

export function formatShortTime(date: Date) {
  return timeFormatter.string(date)
}

export function formatDay(date: Date) {
  dayFormatter2.locale = "zh_CN"
  dayFormatter2.dateFormat = "dd"
  dayFormatter2.timeZone = "Asia/Shanghai"
  return dayFormatter2.string(date)
}

export function formatWeekday(date: Date) {
  weekdayFormatter.locale = "zh_CN"
  weekdayFormatter.dateFormat = "EEEE"
  weekdayFormatter.timeZone = "Asia/Shanghai"
  return weekdayFormatter.string(date).replace("星期", "周")
}

export function formatLunarDate(date: Date) {
  lunarFormatter.locale = "zh_CN"
  lunarFormatter.calendar = "chinese"
  lunarFormatter.dateFormat = "MMMMd"
  lunarFormatter.timeZone = "Asia/Shanghai"
  return lunarFormatter.string(date)
}
