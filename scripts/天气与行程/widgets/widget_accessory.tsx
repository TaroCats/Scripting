/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 15:34:47
 * @Description: 
 */
import { type DashboardData, formatEventTime } from "../shared/shared"
import { HStack, VStack, Text, Image } from "scripting"

export function RectangularWidget({ dashboard }: { dashboard: DashboardData }) {
  const nextEvent = dashboard.upcomingEvents[0]
  const w = dashboard.weather

  return (
    <VStack alignment="leading" spacing={4}>
      <HStack alignment="center" spacing={4}>
        <Image systemName={w?.symbolName ?? "cloud"} font="footnote" shadow={{ color: "systemGray", radius: 2, y: 1 }} />
        <Text font="headline" bold>{w?.temperature ?? "--"}</Text>
        <Text font="footnote">{w ? `H:${w.highTemperature} L:${w.lowTemperature}` : ""}</Text>
      </HStack>
      {nextEvent ? (
        <VStack alignment="leading" spacing={0}>
          <Text font="footnote" lineLimit={1} bold>{nextEvent.title}</Text>
          <Text font={10} lineLimit={1}>{formatEventTime(nextEvent)}</Text>
        </VStack>
      ) : (
        <Text font="footnote" lineLimit={2}>今天没有待办事项</Text>
      )}
    </VStack>
  )
}

export function CircularWidget({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather
  return (
    <VStack alignment="center" spacing={2}>
      <Image systemName={w?.symbolName ?? "cloud"} font="headline" shadow={{ color: "systemGray", radius: 2, y: 1 }} />
      <Text font="caption" bold>{w?.temperature ?? "--"}</Text>
    </VStack>
  )
}
