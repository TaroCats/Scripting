/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 16:24:02
 * @Description: 
 */
import { foregroundStyle, type DashboardData } from "./shared"
import { EventLines, HourlyForecastView } from "./widget_components"
import { HStack, VStack, Text, Image, Spacer } from "scripting"

export function LargeWidget({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather

  return (
    <VStack alignment="leading">
      {w ? (
        <VStack alignment="leading" spacing={8}>
          <HStack alignment="center" spacing={12}>
            <Image systemName={w.symbolName} font="largeTitle" foregroundStyle="systemBlue" />
            <VStack alignment="leading" spacing={2}>
              <Text font="title" bold>{w.temperature}</Text>
              <Text font="subheadline" foregroundStyle={foregroundStyle}>
                {w.condition}
              </Text>
            </VStack>
          </HStack>
          <Spacer />
          <Text font="headline" bold>未来3小时</Text>
          <HourlyForecastView forecast={w.hourlyForecast} />
        </VStack>
      ) : (
        <Text font="footnote">天气不可用</Text>
      )}

      <Spacer />
      <Text font="headline" bold>近期待办</Text>
      <EventLines events={dashboard.upcomingEvents} maxLines={3} />
    </VStack>
  )
}
