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
  temperatureUnit: string
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

