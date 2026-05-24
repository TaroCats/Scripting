/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 17:20:37
 * @Description: 中型天气日程助手小部件
 * */
import { Font, HStack, VStack, Text, Image, Spacer, ShapeStyle, DynamicShapeStyle } from "scripting"
import { foregroundStyle, formatMonthDay, formatWeekday, type DashboardData } from "./shared"
import { EventLines, HourlyForecastView } from "./widget_components"

function VerticalLabel({ text, font = 10, color = 'systemGray' }: { text: string; font?: number | Font; color?: ShapeStyle | DynamicShapeStyle }) {


  return (
    <VStack alignment="leading" spacing={0}>
      {text.split("").map((ch, index) => (
        <Text key={`${ch}-${index}`} font={font} foregroundStyle={color}>
          {ch}
        </Text>
      ))}
    </VStack>
  )
}

function WeekdayVertical({ date }: { date: Date }) {
  return <VerticalLabel text={formatWeekday(date)} color="systemRed" />
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
        <Spacer />
      </HStack>
      <EventLines events={dashboard.upcomingEvents} maxLines={3} />
      <Spacer />
    </VStack>
  )
}

function WeatherColumn({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather
  return (
    <VStack alignment="leading" spacing={8}>
      {w ? (
        <VStack alignment="center" spacing={10}>
          <HStack alignment="center" spacing={20}>
            <VStack alignment="leading" spacing={4}>
              <Text font="largeTitle" bold>{w.temperature}°</Text>
              <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
                {dashboard.locationName}
              </Text>
            </VStack>
            <VStack alignment="center" spacing={4}>
              <Image systemName={w.symbolName} font="largeTitle" padding={5} />
              <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
                {w.condition}
              </Text>
            </VStack>
          </HStack>

          <HStack alignment="center" spacing={10} padding={{
            horizontal: 10
          }}>
            <HStack alignment="center" spacing={4}>
              <VerticalLabel text="最高" font={8} />
              <Text font={20} >{w.highTemperature}°</Text>
            </HStack>
            <Spacer />
            <HStack alignment="center" spacing={4}>
              <VerticalLabel text="最低" font={8} />
              <Text font={20} >{w.lowTemperature}°</Text>
            </HStack>
          </HStack>

          <HourlyForecastView forecast={w.hourlyForecast} />
        </VStack>
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
