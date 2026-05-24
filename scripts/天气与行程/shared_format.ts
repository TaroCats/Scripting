import { type AgendaItem } from "./shared_types"

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
const monthDayFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)
/** @ts-ignore */
const weekdayFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)
/** @ts-ignore */
const lunarFormatter = createFormatter(DateFormatterStyle.none, DateFormatterStyle.none)

export function formatEventTime(event: AgendaItem) {
  if (event.isAllDay) {
    return "全天"
  }

  return `${timeFormatter.string(event.startDate)} - ${timeFormatter.string(event.endDate)}`
}

export function formatEventDateTime(event: AgendaItem) {
  if (event.isAllDay) {
    return `${dayFormatter.string(event.startDate)} 全天`
  }

  return `${dayTimeFormatter.string(event.startDate)} - ${timeFormatter.string(event.endDate)}`
}

export function formatShortTime(date: Date) {
  return timeFormatter.string(date)
}

export function formatMonthDay(date: Date) {
  monthDayFormatter.locale = "zh_CN"
  monthDayFormatter.dateFormat = "dd"
  monthDayFormatter.timeZone = "Asia/Shanghai"
  return monthDayFormatter.string(date)
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

