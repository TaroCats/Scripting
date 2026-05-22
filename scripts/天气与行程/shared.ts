export type AgendaItem = {
  identifier: string
  title: string
  startDate: Date
  endDate: Date
  location: string | null
  notes: string | null
  isAllDay: boolean
  type: "event" | "reminder"
  isCompleted?: boolean
}

export type HourlyWeather = {
  time: string
  symbolName: string
  temperature: string
}

export type WeatherSummary = {
  condition: string
  symbolName: string
  temperature: string
  highTemperature: string
  lowTemperature: string
  hourlyForecast: HourlyWeather[]
  apparentTemperature: string
  humidity: string
  wind: string
  dailySummary: string | null
}

export type DashboardData = {
  generatedAt: Date
  locationName: string
  weather: WeatherSummary | null
  todayEvents: AgendaItem[]
  upcomingEvents: AgendaItem[]
  warnings: string[]
}

export type ReminderResult = {
  scheduledCount: number
  skippedCount: number
}

const REMINDER_THREAD_ID = "weather-calendar-assistant"
import { DynamicShapeStyle, Notification } from "scripting"
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

export const foregroundStyle: DynamicShapeStyle = {
  light: "black",
  dark: "white"
}

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

export function sortEvents(events: AgendaItem[]) {
  return [...events].sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
}

export function formatPlacemark(placemark: Record<string, unknown> | undefined) {
  if (!placemark) {
    return "当前位置"
  }

  const keys = [
    "name",
    "locality",
    "subLocality",
    "administrativeArea",
  ]

  const parts = keys
    .map((key) => placemark[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0)

  return parts.length > 0 ? parts.join(" ") : "当前位置"
}

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

export function translateWeatherCondition(condition: string): string {
  const translations: Record<string, string> = {
    "blizzard": "暴风雪",
    "blowingDust": "沙尘暴",
    "blowingSnow": "吹雪",
    "breezy": "微风",
    "clear": "晴朗",
    "cloudy": "多云",
    "drizzle": "毛毛雨",
    "flurries": "阵雪",
    "foggy": "雾",
    "freezingDrizzle": "冻毛毛雨",
    "freezingRain": "冻雨",
    "frigid": "严寒",
    "hail": "冰雹",
    "haze": "霾",
    "heavyRain": "大雨",
    "heavySnow": "大雪",
    "hot": "炎热",
    "hurricane": "飓风",
    "isolatedThunderstorms": "局部雷暴",
    "mostlyClear": "大部晴朗",
    "mostlyCloudy": "大部多云",
    "partlyCloudy": "局部多云",
    "rain": "雨",
    "scatteredThunderstorms": "零星雷暴",
    "sleet": "雨夹雪",
    "smoky": "烟雾",
    "snow": "雪",
    "strongStorms": "强雷暴",
    "sunFlurries": "太阳阵雪",
    "sunShowers": "太阳雨",
    "thunderstorms": "雷暴",
    "tropicalStorm": "热带风暴",
    "windy": "大风",
    "wintryMix": "雨雪混合"
  }
  return translations[condition] || condition
}

export function summarizeWeather(weather: WeatherSummary | null) {
  if (!weather) {
    return "天气数据不可用"
  }

  return `${weather.condition} ${weather.temperature}`
}

export async function loadDashboardData(): Promise<DashboardData> {
  const warnings: string[] = []
  const now = new Date()
  const todayEnd = endOfDay(now)
  const todayStart = startOfDay(now)
  const lookAheadEnd = endOfDay(addDays(now, 2))

  let locationName = "未获取定位"
  let weather: WeatherSummary | null = null
  let todayEvents: AgendaItem[] = []
  let upcomingEvents: AgendaItem[] = []

  try {
    const location = await Location.requestCurrent({
      forceRequest: true
    })
    if (!location) {
      warnings.push("未获得定位权限，天气信息不可用。")
    } else {
      try {
        const placemarks = await Location.reverseGeocode(location)
        locationName = formatPlacemark(placemarks?.[0])
      } catch (_error) {
        locationName = "当前位置"
      }

      try {
        const currentWeather = await Weather.requestCurrent(location)
        const forecast = await Weather.requestDailyForecast(location, {
          startDate: now,
          endDate: addDays(now, 1),
        })
        const today = forecast.forecast[0]
        const tomorrow = forecast.forecast[1]

        const hourlyForecastRes = await Weather.requestHourlyForecast(location, {
          startDate: now,
          endDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        })
        const hourlyForecast = hourlyForecastRes.forecast.slice(0, 3).map((h: any) => ({
          time: timeFormatter.string(h.date),
          symbolName: h.symbolName,
          temperature: `${h.temperature.value.toFixed(0)} ${h.temperature.symbol}`,
        }))
        
        weather = {
          condition: translateWeatherCondition(currentWeather.condition),
          symbolName: currentWeather.symbolName,
          temperature: `${currentWeather.temperature.value.toFixed(0)} ${currentWeather.temperature.symbol}`,
          highTemperature: today ? `${today.highTemperature.value.toFixed(0)} ${today.highTemperature.symbol}` : "--",
          lowTemperature: today ? `${today.lowTemperature.value.toFixed(0)} ${today.lowTemperature.value.toFixed(0)}` : "--",
          hourlyForecast,
          apparentTemperature: currentWeather.apparentTemperature.formatted,
          humidity: `${Math.round(currentWeather.humidity * 100)}%`,
          wind: currentWeather.wind.direction.formatted,
          dailySummary: tomorrow
            ? `明日 ${translateWeatherCondition(tomorrow.condition)} ${tomorrow.lowTemperature.value.toFixed(0)} ${tomorrow.lowTemperature.symbol} - ${tomorrow.highTemperature.value.toFixed(0)} ${tomorrow.highTemperature.symbol}`
            : null,
        }
      } catch (_error: any) {
        warnings.push(`天气请求失败，稍后重试。错误信息： ${_error.message || "未知错误"}`)
      }
    }
  } catch (_error: any) {
    warnings.push("定位请求失败，天气信息不可用。")
  }

  try {
    const events = await CalendarEvent.getAll(todayStart, lookAheadEnd)
    const mappedEvents: AgendaItem[] = events.map((event) => ({
      identifier: event.identifier,
      title: event.title || "未命名日程",
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
      location: event.location ?? null,
      notes: event.notes ?? null,
      isAllDay: Boolean(event.isAllDay),
      type: "event",
    }))

    const reminders = await Reminder.getIncompletes({
      endDate: lookAheadEnd,
    })

    const mappedReminders: AgendaItem[] = reminders.map((reminder) => {
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
    })

    const allAgenda = [...mappedEvents, ...mappedReminders]
    const sortedEvents = sortEvents(allAgenda)
    todayEvents = sortedEvents.filter((event) => {
      if (event.isAllDay) {
        return event.startDate.getTime() <= todayEnd.getTime() && event.endDate.getTime() >= todayStart.getTime()
      }

      return event.startDate.getTime() >= todayStart.getTime() && event.startDate.getTime() <= todayEnd.getTime()
    })

    upcomingEvents = sortedEvents.filter((event) => event.endDate.getTime() >= now.getTime()).slice(0, 5)
  } catch (_error) {
    warnings.push("日历读取失败，请确认已授予日历权限。")
  }

  return {
    generatedAt: now,
    locationName,
    weather,
    todayEvents,
    upcomingEvents,
    warnings,
  }
}

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

  return {
    scheduledCount,
    skippedCount,
  }
}

export function buildWidgetReloadDate() {
  return new Date(Date.now() + 5 * 60 * 1000)
}
