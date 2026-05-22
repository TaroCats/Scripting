/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 16:21:52
 * @Description: 
 */
import { type AgendaItem, type HourlyWeather, foregroundStyle, formatEventTime } from "./shared"
import { CompleteReminderIntent } from "./app_intents"
import { HStack, VStack, Text, Image, Button } from "scripting"

export function EventLines({
  events,
  maxLines,
}: {
  events: AgendaItem[]
  maxLines: number
}) {
  const displayEvents = events.slice(0, maxLines)

  if (displayEvents.length === 0) {
    return (
      <VStack alignment="leading" spacing={4}>
        <Text foregroundStyle={{
          light: "black",
          dark: "white"
        }} font="footnote">今天没有更多待办</Text>
      </VStack>
    )
  }

  return (
    <VStack alignment="leading" spacing={6}>
      {displayEvents.map((event) => (
        <HStack key={event.identifier} alignment="center" spacing={8}>
          {event.type === "reminder" ? (
            <Button intent={CompleteReminderIntent({ id: event.identifier })}>
              <Image systemName="circle" font="footnote" foregroundStyle="systemBlue" />
            </Button>
          ) : (
            <Image systemName="calendar" font="footnote" foregroundStyle="systemRed" />
          )}
          <VStack alignment="leading" spacing={2}>
            <Text font="footnote" lineLimit={1} bold>
              {event.title}
            </Text>
            <Text font={10} foregroundStyle={{
              light: "black",
              dark: "white"
            }} lineLimit={1}>
              {formatEventTime(event)}
            </Text>
          </VStack>
        </HStack>
      ))}
    </VStack>
  )
}

export function HourlyForecastView({
  forecast,
}: {
  forecast: HourlyWeather[]
}) {
  if (forecast.length === 0) {
    return null
  }

  return (
    <HStack spacing={12} alignment="center">
      {forecast.map((h, i) => (
        <VStack key={i} alignment="center" spacing={4}>
          <Text font={10} foregroundStyle={foregroundStyle}>{h.time}</Text>
          <Image systemName={h.symbolName} font="footnote" foregroundStyle={foregroundStyle} />
          <Text font="footnote" bold foregroundStyle={foregroundStyle}>{h.temperature}</Text>
        </VStack>
      ))}
    </HStack>
  )
}
