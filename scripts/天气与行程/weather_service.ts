import { addDays, formatShortTime } from "./shared_format"
import { translateWeatherCondition } from "./shared_weather"
import { type WeatherSummary } from "./shared_types"

const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000
const WEATHER_CACHE_PATH = `${FileManager.appGroupDocumentsDirectory}/weather_cache.json`

type WeatherCache = {
  fetchedAt: number
  locationName: string
  weather: WeatherSummary
}

async function readWeatherCache(): Promise<WeatherCache | null> {
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

async function writeWeatherCache(input: WeatherCache) {
  try {
    await FileManager.writeAsString(WEATHER_CACHE_PATH, JSON.stringify(input))
  } catch (_error) { }
}

export async function loadWeather(now: Date, warnings: string[], noCache: boolean): Promise<{
  locationName: string
  weather: WeatherSummary | null
}> {
  const weatherCache = await readWeatherCache()
  const isCacheFresh = Boolean(weatherCache && now.getTime() - weatherCache.fetchedAt < WEATHER_CACHE_TTL_MS) && !noCache

  let locationName = "未获取定位"
  let weather: WeatherSummary | null = null

  if (isCacheFresh && weatherCache) {
    console.log("使用缓存天气数据: ", weatherCache.locationName)
    return {
      locationName: weatherCache.locationName,
      weather: weatherCache.weather,
    }
  }

  try {
    const location = await Location.requestCurrent({ forceRequest: true })
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
        apparentTemperature: `${currentWeather.apparentTemperature.value.toFixed(1)}${currentWeather.apparentTemperature.symbol}`,
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
