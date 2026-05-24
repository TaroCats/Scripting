/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 17:20:37
 * @Description: 中型天气日程助手小部件
 * */
import { HStack, VStack, Text, Image, Spacer } from "scripting"
import { foregroundStyle, formatMonthDay, formatWeekday, type DashboardData } from "./shared"
import { EventLines, HourlyForecastView } from "./widget_components"

function WeekdayVertical({ date }: { date: Date }) {
  const weekdayChars = formatWeekday(date).split("")

  return (
    <VStack alignment="center" spacing={0}>
      {weekdayChars.map((ch, index) => (
        <Text key={`${ch}-${index}`} font={10} foregroundStyle="systemRed">
          {ch}
        </Text>
      ))}
    </VStack>
  )
}

function AgendaColumn({
  dashboard,
  now,
}: {
  dashboard: DashboardData
  now: Date
}) {
  return (
    <VStack alignment="leading" spacing={8}>
      <HStack alignment="center" spacing={4}>
        <Text font="largeTitle" bold>{formatMonthDay(now)}</Text>
        <Text font={12} foregroundStyle="systemGray">|</Text>
        <WeekdayVertical date={now} />
      </HStack>
      <EventLines events={dashboard.upcomingEvents} maxLines={3} />
      <Spacer />
    </VStack>
  )
}

function WeatherColumn({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather
  const l = dashboard.locationName
  return (
    <VStack alignment="leading" spacing={8}>
      {w ? (
        <>
          <HStack alignment="center" spacing={20}>
            <VStack alignment="center" spacing={4}>
              <HStack alignment="center" spacing={4}>
                <Text font="largeTitle" bold>{w.temperature}</Text>
                <Text font={24}>{w.temperatureUnit}</Text>
              </HStack>
              <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
                {l} {w.condition}
              </Text>
            </VStack>
            <Image systemName={w.symbolName} font="largeTitle" />
          </HStack>
          <Spacer />
          <HourlyForecastView forecast={w.hourlyForecast} />
        </>
      ) : (
        <>
          <Text font="footnote">{dashboard.warnings?.join(", ")} </Text>
          <Spacer />
        </>
      )}
    </VStack>
  )
}

export function MediumWidget({ dashboard }: { dashboard: DashboardData }) {
  const now = new Date()

  return (
    <HStack padding={16} spacing={16} alignment="top">
      <AgendaColumn dashboard={dashboard} now={now} />

      <Spacer />

      <WeatherColumn dashboard={dashboard} />
    </HStack>
  )
}
