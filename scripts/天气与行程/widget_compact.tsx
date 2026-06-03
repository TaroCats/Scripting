/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-06-03 11:21:17
 * @Description: 小型天气日程助手小部件
 */
import { HStack, VStack, Text, Image, Spacer } from "scripting"
import { foregroundStyle, type DashboardData } from "./shared"
import { EventLines } from "./widget_components"

export function CompactWidget({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather
  return (
    <VStack alignment="leading" padding={12} spacing={8}>
      {w ? (
        <VStack alignment="leading" spacing={2}>
          <HStack alignment="center" spacing={4}>
            <Image systemName={w.symbolName} font="title2" />
            <Text font="title2" bold>{w.temperature}°</Text>
          </HStack>
          <Text font={10} bold foregroundStyle={foregroundStyle} lineLimit={1}>
            {w.condition}
          </Text>
        </VStack>
      ) : (
        <Text font="footnote">天气不可用</Text>
      )}
      <Spacer />
      <EventLines events={dashboard.upcomingEvents} maxLines={3} />
    </VStack>
  )
}
