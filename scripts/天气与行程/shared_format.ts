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

function createFormatter(dateStyle: DateFormatterStyle, timeStyle: DateFormatterStyle) {
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
const dayNumberFormatter = new DateFormatter()
dayNumberFormatter.locale = "zh_CN"
dayNumberFormatter.dateFormat = "dd"
dayNumberFormatter.timeZone = "Asia/Shanghai"

/** @ts-ignore */
const weekdayFormatter = new DateFormatter()
weekdayFormatter.locale = "zh_CN"
weekdayFormatter.dateFormat = "EEEE"
weekdayFormatter.timeZone = "Asia/Shanghai"

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
  return dayNumberFormatter.string(date)
}

export function formatWeekday(date: Date) {
  return weekdayFormatter.string(date).replace("星期", "周")
}
