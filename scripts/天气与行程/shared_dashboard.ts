import { Notification } from "scripting"
import { addDays, endOfDay, startOfDay } from "./shared_date"
import { formatEventDateTime, formatShortTime } from "./shared_format"
import { sortEvents } from "./shared_misc"
import { summarizeWeather, translateWeatherCondition } from "./shared_weather"
import { type AgendaItem, type DashboardData, type ReminderResult, type WeatherSummary } from "./shared_types"

const REMINDER_THREAD_ID = "weather-calendar-assistant"

const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000
const WEATHER_CACHE_PATH = `${FileManager.appGroupDocumentsDirectory}/weather_cache.json`

async function readWeatherCache(): Promise<{
  fetchedAt: number
  locationName: string
  weather: WeatherSummary
} | null> {
  try {
    const exists = await FileManager.exists(WEATHER_CACHE_PATH)
    if (!exists) return null

    const text = await FileManager.readAsString(WEATHER_CACHE_PATH)
    const parsed = JSON.parse(text) as {
      fetchedAt?: unknown
      locationName?: unknown
      weather?: unknown
    }

    if (typeof parsed.fetchedAt !== "number") return null
    if (typeof parsed.locationName !== "string") return null
    if (!parsed.weather || typeof parsed.weather !== "object") return null

    return {
      fetchedAt: parsed.fetchedAt,
      locationName: parsed.locationName,
      weather: parsed.weather as WeatherSummary,
    }
  } catch (_error) {
    return null
  }
}

async function writeWeatherCache(input: {
  fetchedAt: number
  locationName: string
  weather: WeatherSummary
}) {
  try {
    await FileManager.writeAsString(WEATHER_CACHE_PATH, JSON.stringify(input))
  } catch (_error) {}
}

async function loadWeatherPart(now: Date, warnings: string[], noCache: boolean): Promise<{
  locationName: string
  weather: WeatherSummary | null
}> {
  const weatherCache = await readWeatherCache()
  const isWeatherCacheFresh = Boolean(weatherCache && now.getTime() - weatherCache.fetchedAt < WEATHER_CACHE_TTL_MS) && !noCache

  let locationName = "未获取定位"
  let weather: WeatherSummary | null = null

  if (isWeatherCacheFresh && weatherCache) {
    console.log("使用缓存天气数据: ", weatherCache.locationName)
    return {
      locationName: weatherCache.locationName,
      weather: weatherCache.weather,
    }
  }

  try {
    const location = await Location.requestCurrent({
      forceRequest: true
    })
    if (!location) {
      warnings.push("未获得定位权限，天气信息不可用。")
      return { locationName, weather }
    }

    try {
      const placemarks = await Location.reverseGeocode(location)
      locationName = placemarks?.[0]?.subLocality || "当前位置"
      console.log("获取到的定位信息:", locationName)
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
        endDate: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      })
      const hourlyForecast = hourlyForecastRes.forecast.slice(0, 6).map((h: any) => ({
        time: formatShortTime(h.date),
        symbolName: `${h.symbolName}.fill`,
        temperature: `${h.temperature.value.toFixed(0)}`,
      }))
      
      weather = {
        condition: translateWeatherCondition(currentWeather.condition),
        symbolName: `${currentWeather.symbolName}.fill`,
        temperature: currentWeather.temperature.value.toFixed(0),
        temperatureUnit: currentWeather.temperature.symbol,
        highTemperature: today ? `${today.highTemperature.value.toFixed(0)}` : "--",
        lowTemperature: today ? `${today.lowTemperature.value.toFixed(0)}` : "--",
        hourlyForecast,
        apparentTemperature: currentWeather.apparentTemperature.formatted,
        humidity: `${Math.round(currentWeather.humidity * 100)}%`,
        wind: currentWeather.wind.direction.formatted,
        dailySummary: tomorrow
          ? `明日 ${translateWeatherCondition(tomorrow.condition)} ${tomorrow.lowTemperature.value.toFixed(0)} ${tomorrow.lowTemperature.symbol} - ${tomorrow.highTemperature.value.toFixed(0)} ${tomorrow.highTemperature.symbol}`
          : null,
      }

      await writeWeatherCache({
        fetchedAt: now.getTime(),
        locationName,
        weather,
      })
    } catch (_error: any) {
      warnings.push(`天气请求失败，稍后重试。错误信息： ${_error.message || "未知错误"}`)
    }
  } catch (_error: any) {
    warnings.push("定位请求失败，天气信息不可用。")
  }

  if (!weather && weatherCache?.weather) {
    warnings.push("天气请求失败，已使用缓存数据（可能已过期）。")
    return {
      locationName: weatherCache.locationName,
      weather: weatherCache.weather,
    }
  }

  return { locationName, weather }
}

async function loadAgendaPart(now: Date, todayStart: Date, todayEnd: Date, lookAheadEnd: Date, warnings: string[]) {
  let todayEvents: AgendaItem[] = []
  let upcomingEvents: AgendaItem[] = []

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

    upcomingEvents = sortedEvents.filter((event) => event.endDate.getTime() >= now.getTime()).slice(0, 10)
  } catch (_error) {
    warnings.push("日历读取失败，请确认已授予日历权限。")
  }

  return { todayEvents, upcomingEvents }
}

export async function loadDashboardData(noCache = false): Promise<DashboardData> {
  const warnings: string[] = []
  const now = new Date()
  const todayEnd = endOfDay(now)
  const todayStart = startOfDay(now)
  const lookAheadEnd = endOfDay(addDays(now, 45))

  const { locationName, weather } = await loadWeatherPart(now, warnings, noCache)
  const { todayEvents, upcomingEvents } = await loadAgendaPart(now, todayStart, todayEnd, lookAheadEnd, warnings)

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

