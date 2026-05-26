/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-26 17:35:54
 * @Description: 
 */
import { addDays, type AgendaItem, type HourlyWeather, foregroundStyle, startOfDay, DashboardData, formatMonthDay, formatWeekday } from "./shared"
import { CompleteReminderIntent, RefreshWidgetIntent } from "./app_intents"
import { HStack, Spacer, VStack, Text, Image, Button, Font, ShapeStyle, DynamicShapeStyle, Rectangle } from "scripting"

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
        <Text foregroundStyle={foregroundStyle} font="footnote">
          最近无事发生
        </Text>
      </VStack>
    )
  }

  const groups = groupEventsByDay(events, todayStart)
  const displayGroups = takeGroupsByTotalLines(groups, maxLines)
  return (
    <VStack alignment="leading" spacing={6}>
      {displayGroups.map((group) => (
        <VStack key={group.key} alignment="leading" spacing={2}>
          <Text foregroundStyle="systemGray" font={10} bold >
            {group.title}
          </Text>
          {group.events.map((event) => (
            event.type === "reminder" ? (
              <Button intent={CompleteReminderIntent({ id: event.identifier })} buttonStyle="plain" key={`${group.key}-${event.identifier}`}>
                <HStack alignment="center" spacing={4}>
                  <Image systemName="circle" font="footnote" foregroundStyle="systemBlue" />
                  <Text font={12} lineLimit={1} bold>
                    {event.title}
                  </Text>
                </HStack>
              </Button>
            ) : (
              <Text font={12} lineLimit={1} bold>
                {event.title}
              </Text>
            )
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
          <Text font="footnote" bold foregroundStyle={foregroundStyle}>{h.temperature}°</Text>
        </VStack>
      ))}
    </HStack>
  )
}

export function VerticalLabel({ text, font = 10, color = 'systemGray' }: { text: string; font?: number | Font; color?: ShapeStyle | DynamicShapeStyle }) {
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

export function WeekdayVertical() {
  const date = new Date()
  return <VerticalLabel text={formatWeekday(date)} color="systemRed" />
}

export function WeatherColumn({ dashboard, maxHour = 3, hasSpacer = false }: { dashboard: DashboardData; maxHour?: number; hasSpacer?: boolean }) {
  const w = dashboard.weather
  if (!w) {
    return (
      <>
        <Text font="footnote">{dashboard.warnings?.join(", ")} </Text>
        <Spacer />
      </>
    )
  }


  return (
    <VStack alignment="leading" spacing={10}>
      <HStack alignment="top" spacing={10}>
        <Image systemName={w.symbolName} font="largeTitle" padding={{ top: 5 }} />
        <Text font="largeTitle" bold>{w.temperature}°</Text>
      </HStack>
      <HStack alignment="center" spacing={4}>
        <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
          {dashboard.locationName}
        </Text>
        <Text font="footnote" foregroundStyle={foregroundStyle} lineLimit={1}>
          {w.condition}
        </Text>
        <Button intent={RefreshWidgetIntent({})} buttonStyle="plain" >
          <HStack alignment="bottom" spacing={2}>
            <Image systemName="arrow.clockwise" font={8} foregroundStyle="systemGray" />
            <Text font={8} foregroundStyle="systemGray">
              刷新
            </Text>
          </HStack>
        </Button>
      </HStack>

      {hasSpacer && <Spacer />}

      <HStack alignment="center" spacing={10}>
        <VStack alignment="center" spacing={10}>
          <HStack alignment="center" spacing={4}>
            <VerticalLabel text="最高" font={8} />
            <Text font={16} >{w.highTemperature}°</Text>
          </HStack>
          <HStack alignment="center" spacing={4}>
            <VerticalLabel text="最低" font={8} />
            <Text font={16} >{w.lowTemperature}°</Text>
          </HStack>
        </VStack>
        <HourlyForecastView forecast={w.hourlyForecast.slice(0, maxHour)} />
      </HStack>
    </VStack>
  )
}

export function AgendaColumn({ dashboard, maxLines = 3 }: { dashboard: DashboardData; maxLines?: number }) {
  const now = new Date()
  return (
    <VStack alignment="leading" spacing={8}>
      <HStack alignment="center" spacing={6}>
        <Text font="largeTitle" bold>{formatMonthDay(now)}</Text>
        <Rectangle
          fill="systemGray"
          stroke={{
            shapeStyle: "systemGray",
            strokeStyle: {
              lineWidth: 1,
              lineJoin: "round"
            }
          }}
          opacity={0.3}
          frame={{ width: .2, height: 20 }}
        />
        <WeekdayVertical />
        <Spacer />
      </HStack>
      <EventLines events={dashboard.upcomingEvents} maxLines={maxLines} />
    </VStack>
  )
}