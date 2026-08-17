import { sortEvents } from "./shared_format"
import { type AgendaItem } from "./shared_types"

function isTitleSimilar(title1: string, title2: string, threshold: number): boolean {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

  const norm1 = normalize(title1)
  const norm2 = normalize(title2)

  if (norm1 === norm2) return true
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true

  // 基于 Levenshtein 距离的模糊匹配
  const maxLen = Math.max(norm1.length, norm2.length)
  if (maxLen === 0) return true

  const distance = levenshtein(norm1, norm2)
  return 1 - distance / maxLen >= threshold
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function filterSimilarTitleEvents(events: AgendaItem[], similarityThreshold = 0.9): AgendaItem[] {
  const result: AgendaItem[] = []
  for (const event of events) {
    const isSimilar = result.some(existing =>
      isTitleSimilar(existing.title, event.title, similarityThreshold)
    )
    if (!isSimilar) result.push(event)
  }
  return result
}

function mapEvent(event: any): AgendaItem {
  return {
    identifier: event.identifier,
    type: "event",
    title: event.title || "未命名日程",
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    location: event.location ?? null,
    notes: event.notes ?? null,
    isAllDay: Boolean(event.isAllDay),
    calendar: event.calendar,
  }
}

function mapReminder(reminder: any): AgendaItem {
  let startDate = new Date()
  let endDate = new Date()
  let isAllDay = false

  if (reminder.dueDateComponents) {
    const d = reminder.dueDateComponents
    const now = new Date()
    const hasTime = d.hour != null
    isAllDay = !hasTime

    startDate = new Date(
      d.year ?? now.getFullYear(),
      (d.month ?? now.getMonth() + 1) - 1,
      d.day ?? now.getDate(),
      hasTime && d.hour != null ? d.hour : 0,
      hasTime && d.minute != null ? d.minute : 0
    )
    endDate = new Date(startDate.getTime() + (isAllDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000))
  }

  return {
    identifier: reminder.identifier,
    title: reminder.title || "未命名提醒",
    startDate,
    endDate,
    location: null,
    notes: reminder.notes ?? null,
    isAllDay,
    type: "reminder",
    isCompleted: false,
  }
}

export async function loadAgenda(
  now: Date,
  todayStart: Date,
  todayEnd: Date,
  lookAheadEnd: Date,
  warnings: string[],
): Promise<{ todayEvents: AgendaItem[]; upcomingEvents: AgendaItem[] }> {
  let todayEvents: AgendaItem[] = []
  let upcomingEvents: AgendaItem[] = []

  try {
    const events = await CalendarEvent.getAll(todayStart, lookAheadEnd)
    const mappedEvents = events
      .filter((event) => event.calendar?.title != "中国大陆节假日")
      .map(mapEvent)

    const reminders = await Reminder.getIncompletes({ endDate: lookAheadEnd })
    const mappedReminders = reminders.map(mapReminder)

    const sortedEvents = sortEvents([...mappedEvents, ...mappedReminders])

    todayEvents = sortedEvents.filter((event) => {
      if (event.isAllDay) {
        return event.startDate.getTime() <= todayEnd.getTime() && event.endDate.getTime() >= todayStart.getTime()
      }
      return event.startDate.getTime() >= todayStart.getTime() && event.startDate.getTime() <= todayEnd.getTime()
    })

    const showReminder = Storage.get("showReminder") ?? true
    upcomingEvents = filterSimilarTitleEvents(sortedEvents, 0.85)
      .filter((event) => showReminder ? event.type : event.type === "event")
      .filter((event) => event.endDate.getTime() >= now.getTime())
      .slice(0, 10)
  } catch (_error) {
    warnings.push("日历读取失败，请确认已授予日历权限。")
  }

  return { todayEvents, upcomingEvents }
}
