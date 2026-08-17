/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-06-03 13:37:23
 * @Description: 
 */
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
  calendar?: any
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
  temperatureUnit: string
  hourlyForecast: HourlyWeather[]
  apparentTemperature: string
  humidity: string
  wind: string
  dailySummary: string | null
}

export type DashboardData = {
  reloadDate?: Date
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

