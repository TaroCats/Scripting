import { addDays, endOfDay, startOfDay } from "./shared_format"
import { loadWeather } from "./weather_service"
import { loadAgenda } from "./agenda_service"
import { type DashboardData } from "./shared_types"

export async function loadDashboardData(noCache = false): Promise<DashboardData> {
  const warnings: string[] = []
  const now = new Date()
  const todayEnd = endOfDay(now)
  const todayStart = startOfDay(now)
  const lookAheadEnd = endOfDay(addDays(now, 45))

  const { locationName, weather } = await loadWeather(now, warnings, noCache)
  const { todayEvents, upcomingEvents } = await loadAgenda(now, todayStart, todayEnd, lookAheadEnd, warnings)

  return {
    generatedAt: now,
    locationName,
    weather,
    todayEvents,
    upcomingEvents,
    warnings,
  }
}

export function buildWidgetReloadDate() {
  return new Date(Date.now() + 5 * 60 * 1000)
}
