/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 16:21:52
 * @Description: 
 */
import { addDays, type AgendaItem, type HourlyWeather, foregroundStyle, startOfDay } from "./shared"
import { CompleteReminderIntent } from "./app_intents"
import { HStack, VStack, Text, Image, Button } from "scripting"

type DayGroup = {
  key: string
  title: string
  events: AgendaItem[]
}

function getDayKey(dayStart: Date) {
  return `${dayStart.getFullYear()}-${dayStart.getMonth()}-${dayStart.getDate()}`
}

function getDayTitle(dayStart: Date, todayStart: Date) {
  const offsetDays = Math.round((dayStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
  if (offsetDays === 0) return "今天"
  if (offsetDays === 1) return "明天"
  if (offsetDays === 2) return "后天"
  return `${dayStart.getMonth() + 1}月${dayStart.getDate()}日`
}

function getEventEndInclusiveStartOfDay(event: AgendaItem) {
  const endExclusive = startOfDay(event.endDate)
  return endExclusive.getTime() === event.endDate.getTime() ? addDays(endExclusive, -1) : endExclusive
}

function collectDayStarts(events: AgendaItem[]) {
  const dayStartMap = new Map<number, Date>()

  for (const event of events) {
    const start = startOfDay(event.startDate)
    const endInclusive = getEventEndInclusiveStartOfDay(event)

    for (let d = start; d.getTime() <= endInclusive.getTime(); d = addDays(d, 1)) {
      dayStartMap.set(d.getTime(), d)
    }
  }

  return [...dayStartMap.values()].sort((a, b) => a.getTime() - b.getTime())
}

function isOverlappingDay(event: AgendaItem, dayStart: Date) {
  const dayEndExclusive = addDays(dayStart, 1)
  return event.startDate.getTime() < dayEndExclusive.getTime() && event.endDate.getTime() > dayStart.getTime()
}

function groupEventsByDay(events: AgendaItem[], todayStart: Date): DayGroup[] {
  const dayStarts = collectDayStarts(events)

  return dayStarts
    .map((dayStart) => {
      const groupEvents = events
        .filter((event) => isOverlappingDay(event, dayStart))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

      return {
        key: getDayKey(dayStart),
        title: getDayTitle(dayStart, todayStart),
        events: groupEvents,
      }
    })
    .filter((g) => g.events.length > 0)
}

function takeGroupsByTotalLines(groups: DayGroup[], maxLines: number): DayGroup[] {
  const displayGroups: DayGroup[] = []
  let used = 0

  for (const group of groups) {
    if (used >= maxLines) break
    const remaining = Math.max(0, maxLines - used)
    const sliced = group.events.slice(0, remaining)
    if (sliced.length === 0) continue
    displayGroups.push({ ...group, events: sliced })
    used += sliced.length
  }

  return displayGroups
}

export function EventLines({
  events,
  maxLines,
}: {
  events: AgendaItem[]
  maxLines: number
}) {
  const todayStart = startOfDay(new Date())

  if (events.length === 0) {
    return (
      <VStack alignment="leading" spacing={4}>
        <Text foregroundStyle={foregroundStyle} font="footnote">今天没有更多待办</Text>
      </VStack>
    )
  }

  const groups = groupEventsByDay(events, todayStart)
  const displayGroups = takeGroupsByTotalLines(groups, maxLines)
  return (
    <VStack alignment="leading" spacing={8} padding={4}>
      {displayGroups.map((group) => (
        <VStack key={group.key} alignment="leading">
          <Text
            foregroundStyle="systemGray"
            font={10}
            bold
          >
            {group.title}
          </Text>
          {group.events.map((event) => (
            <HStack key={`${group.key}-${event.identifier}`} alignment="center" spacing={8}>
              {event.type === "reminder" && (
                <Button intent={CompleteReminderIntent({ id: event.identifier })} background={undefined}>
                  <Image systemName="circle" font="footnote" foregroundStyle="systemBlue" />
                </Button>
              )}
              <VStack alignment="leading" spacing={2}>
                <Text font="footnote" lineLimit={1} bold>
                  {event.title}
                </Text>
              </VStack>
            </HStack>
          ))}
        </VStack>
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
          <Image systemName={h.symbolName} font={16} foregroundStyle={foregroundStyle} />
          <Text font="footnote" bold foregroundStyle={foregroundStyle}>{h.temperature}</Text>
        </VStack>
      ))}
    </HStack>
  )
}
