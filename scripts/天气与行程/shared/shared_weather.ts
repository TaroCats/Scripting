import { type WeatherSummary } from "./shared_types"

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

