import { Notification } from "scripting"
import { formatEventDateTime } from "./shared_format"
import { summarizeWeather } from "./shared_weather"
import { type DashboardData, type ReminderResult } from "./shared_types"

const REMINDER_THREAD_ID = "weather-calendar-assistant"

export async function scheduleTodayNotifications(
  dashboard: DashboardData,
  reminderOffsetMinutes = 30,
): Promise<ReminderResult> {
  await Notification.removeAllPendingsOfCurrentScript()

  const now = Date.now()
  const weatherSummary = summarizeWeather(dashboard.weather)

  let scheduledCount = 0
  let skippedCount = 0

  for (const event of dashboard.todayEvents) {
    if (event.isAllDay) {
      skippedCount += 1
      continue
    }

    const triggerAt = event.startDate.getTime() - reminderOffsetMinutes * 60 * 1000
    const delaySeconds = Math.floor((triggerAt - now) / 1000)

    if (delaySeconds < 15) {
      skippedCount += 1
      continue
    }

    const details = [
      `时间：${formatEventDateTime(event)}`,
      event.location ? `地点：${event.location}` : null,
      `天气：${weatherSummary}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" · ")

    await Notification.schedule({
      title: `即将开始：${event.title}`,
      body: details,
      threadIdentifier: REMINDER_THREAD_ID,
      interruptionLevel: "timeSensitive",
      trigger: new TimeIntervalNotificationTrigger({
        timeInterval: delaySeconds,
        repeats: false,
      }),
      customUI: false,
    })

    scheduledCount += 1
  }

  return { scheduledCount, skippedCount }
}
