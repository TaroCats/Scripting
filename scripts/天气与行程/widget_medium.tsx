/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 17:20:37
 * @Description: 中型天气日程助手小部件
 * */
import { HStack, VStack, Text, Image, Spacer, Widget } from "scripting"
import { foregroundStyle, type DashboardData } from "./shared"
import { EventLines, HourlyForecastView } from "./widget_components"

export function MediumWidget({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather

  return (
    <HStack padding={16} spacing={16} alignment="top">
      <VStack alignment="leading" spacing={8}>
        {w ? (
          <>
            <HStack alignment="center" spacing={8}>
              <Image systemName={w.symbolName} font="largeTitle" foregroundStyle="systemBlue" />
              <VStack alignment="center" spacing={8}>
                <Text font="title2" bold>{w.temperature}</Text>
                <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
                  {w.condition}
                </Text>
              </VStack>
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

      <Spacer />

      <VStack alignment="leading" spacing={8}>
        <Text font="headline" bold>近期待办</Text>
        <EventLines events={dashboard.upcomingEvents} maxLines={3} />
        <Spacer />
      </VStack>
    </HStack>
  )
}
