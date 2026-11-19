import { addDays, type AgendaItem, type DailyWeather, type HourlyWeather, type WeatherSummary, foregroundStyle, startOfDay, DashboardData, formatDay, formatShortTime, formatWeekday } from "../shared/shared"
import { CompleteReminderIntent, RefreshWidgetIntent, ToggleReminderIntent } from "../app_intents"
import { HStack, Spacer, VStack, Text, Image, Button, Font, ShapeStyle, DynamicShapeStyle, Divider, FlowLayout, RoundedRectangle } from "scripting"

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
      <Text foregroundStyle={foregroundStyle} font="footnote">
        最近无事发生
      </Text>
    )
  }

  const groups = groupEventsByDay(events, todayStart)
  const displayGroups = takeGroupsByTotalLines(groups, maxLines)
  return (
    <FlowLayout spacing={6} frame={{ maxWidth: 'infinity'}}>
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
    </FlowLayout>
  )
}

export function HourlyForecastView({ forecast }: { forecast: HourlyWeather[] }) {
  if (forecast.length === 0) {
    return null
  }
  console.log(forecast)
  return (
    <FlowLayout spacing={6} frame={{ maxWidth: forecast.length * 35 }}>
      {forecast.map((h, i) => (
        <VStack key={i} alignment="center" spacing={4} frame={{ height: 40 }}>
          <Text font={10} foregroundStyle={foregroundStyle} frame={{ height: 10 }}>{h.time}</Text>
          <Image systemName={h.symbolName} font={16} foregroundStyle={foregroundStyle} symbolRenderingMode='multicolor' frame={{ height: 20 }} shadow={{ color: "systemGray", radius: 2, y: 1 }} />
          <Text font="footnote" bold foregroundStyle={foregroundStyle} frame={{ height: 10 }}>{h.temperature}°</Text>
        </VStack>
      ))}
    </FlowLayout>
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
      <HStack alignment="center" spacing={10} frame={{height: 40}}>
        <Image systemName={w.symbolName} font="largeTitle" symbolRenderingMode='multicolor' shadow={{ color: "systemGray", radius: 2, y: 1 }} />
        <Text font="largeTitle" bold frame={{ height: 40 }}>{w.temperature}°</Text>
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

      <HStack spacing={10} frame={{ height: 40 }}>
        <VStack alignment="center" spacing={10} >
          <HStack alignment="top" spacing={4} frame={{ height: 20 }}>
            <VerticalLabel text="最高" font={8} />
            <Text font={20} bold frame={{ height: 20 }}>{w.highTemperature}°</Text>
          </HStack>
          <HStack alignment="bottom" spacing={4} frame={{ height: 20 }}>
            <VerticalLabel text="最低" font={8} />
            <Text font={20} bold frame={{ height: 20 }}>{w.lowTemperature}°</Text>
          </HStack>
        </VStack>
        <HourlyForecastView forecast={w.hourlyForecast.slice(0, maxHour)} />
      </HStack>
    </VStack>
  )
}

export function AgendaColumn({ dashboard, maxLines = 10 }: { dashboard: DashboardData; maxLines?: number }) {
  const now = new Date()
  return (
    <VStack alignment="leading" spacing={8}>
      <Button intent={ToggleReminderIntent({})} buttonStyle="plain" >
        <HStack alignment="center" spacing={6}>
          <Text font="largeTitle" bold>{formatDay(now)}</Text>
          <Divider frame={{ height: 30 }} />
          <WeekdayVertical />
          <Spacer />
        </HStack>
      </Button>
      <EventLines events={dashboard.upcomingEvents} maxLines={maxLines} />
    </VStack>
  )
}

/* ------------------------------------------------------------------
 * 大号 / 超大号小组件专用布局组件
 * ------------------------------------------------------------------ */

/** 日程时间标签：全天 / 今天 / 进行中 / 09:00 / 11/22 */
function scheduleLabel(event: AgendaItem, now: Date) {
  const todayStart = startOfDay(now)
  const tomorrowStart = addDays(todayStart, 1)
  const startTime = event.startDate.getTime()

  if (event.isAllDay) {
    if (startTime < todayStart.getTime()) return "全天"
    if (startTime < tomorrowStart.getTime()) return "今天"
    return `${event.startDate.getMonth() + 1}/${event.startDate.getDate()}`
  }

  if (startTime < now.getTime()) return "进行中"
  if (startTime < tomorrowStart.getTime()) return formatShortTime(event.startDate)
  return `${event.startDate.getMonth() + 1}/${event.startDate.getDate()}`
}

/** 日期徽标：大号日期数字 + 月份 / 星期 */
export function DateBadge({ date, fontSize = 38 }: { date: Date; fontSize?: number }) {
  return (
    <HStack alignment="center" spacing={7}>
      <Text font={fontSize} bold lineLimit={1}>{formatDay(date)}</Text>
      <VStack alignment="leading" spacing={0}>
        <Text font={9} bold foregroundStyle="systemGray">{`${date.getMonth() + 1}月`}</Text>
        <Text font={11} bold foregroundStyle="systemRed">{formatWeekday(date)}</Text>
      </VStack>
    </HStack>
  )
}

/** 顶部：日期 + 当前天气 */
export function WeatherHeader({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather
  const now = new Date()

  return (
    <HStack alignment="center" spacing={10} frame={{ maxWidth: "infinity" }}>
      <Button intent={ToggleReminderIntent({})} buttonStyle="plain">
        <DateBadge date={now} />
      </Button>
      <Spacer />
      {w ? (
        <HStack alignment="center" spacing={8}>
          <Image
            systemName={w.symbolName}
            font={30}
            symbolRenderingMode="multicolor"
            shadow={{ color: "systemGray", radius: 2, y: 1 }}
            frame={{ width: 38, height: 38 }}
          />
          <VStack alignment="leading" spacing={1}>
            <Text font={30} bold lineLimit={1}>{w.temperature}°</Text>
            <Text font={10} foregroundStyle="systemGray" lineLimit={1}>
              {`${w.condition} · ${w.highTemperature}°/${w.lowTemperature}°`}
            </Text>
          </VStack>
        </HStack>
      ) : (
        <Text font={10} foregroundStyle="systemGray" lineLimit={2} frame={{ maxWidth: 160 }}>
          {dashboard.warnings?.join(" ") || "天气不可用"}
        </Text>
      )}
    </HStack>
  )
}

/** 等宽逐时预报行，占满整行宽度 */
export function HourlyStrip({ forecast, maxHour = 6 }: { forecast: HourlyWeather[]; maxHour?: number }) {
  if (forecast.length === 0) return null
  const items = forecast.slice(0, maxHour)

  return (
    <HStack spacing={0} frame={{ maxWidth: "infinity" }}>
      {items.map((h, i) => (
        <VStack key={i} alignment="center" spacing={4} frame={{ maxWidth: "infinity" }}>
          <Text font={10} foregroundStyle="systemGray" lineLimit={1}>{h.time}</Text>
          <Image
            systemName={h.symbolName}
            font={18}
            symbolRenderingMode="multicolor"
            shadow={{ color: "systemGray", radius: 2, y: 1 }}
            frame={{ height: 22 }}
          />
          <Text font={12} bold lineLimit={1}>{h.temperature}°</Text>
        </VStack>
      ))}
    </HStack>
  )
}

/** 未来几天预报：星期 + 图标 + 最低/最高 */
export function DailyForecastList({ forecast, maxDays = 5 }: { forecast: DailyWeather[]; maxDays?: number }) {
  if (forecast.length === 0 || maxDays <= 0) return null

  return (
    <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
      {forecast.slice(0, maxDays).map((day, index) => (
        <HStack key={`${day.day}-${index}`} alignment="center" spacing={8} frame={{ maxWidth: "infinity" }}>
          <Text font={11} foregroundStyle="systemGray" lineLimit={1} frame={{ width: 34, alignment: "leading" }}>
            {day.day}
          </Text>
          <Image
            systemName={day.symbolName}
            font={14}
            symbolRenderingMode="multicolor"
            frame={{ width: 20 }}
          />
          <Spacer />
          <Text font={11} foregroundStyle="systemGray" lineLimit={1} frame={{ width: 26, alignment: "trailing" }}>
            {day.low}°
          </Text>
          <Text font={11} bold lineLimit={1} frame={{ width: 26, alignment: "trailing" }}>
            {day.high}°
          </Text>
        </HStack>
      ))}
    </VStack>
  )
}

/** 小节标题（左侧图标 + 文字，右侧可跟说明） */export function SectionTitle({ systemName, text, trailing }: { systemName: string; text: string; trailing?: string }) {
  return (
    <HStack alignment="center" spacing={4} frame={{ maxWidth: "infinity" }}>
      <Image systemName={systemName} font={10} foregroundStyle="systemGray" />
      <Text font={10} bold foregroundStyle="systemGray">{text}</Text>
      <Spacer />
      {trailing ? <Text font={10} foregroundStyle="systemGray" lineLimit={1}>{trailing}</Text> : null}
    </HStack>
  )
}

/** 单条日程：时间标签 + 色条/提醒圆圈 + 标题 */
function AgendaRow({ event, now }: { event: AgendaItem; now: Date }) {
  const row = (
    <HStack alignment="center" spacing={6} frame={{ maxWidth: "infinity" }}>
      <Text font={10} monospacedDigit foregroundStyle="systemGray" lineLimit={1} frame={{ width: 34, alignment: "leading" }}>
        {scheduleLabel(event, now)}
      </Text>
      {event.type === "reminder"
        ? <Image systemName="circle" font={11} foregroundStyle="systemBlue" />
        : <RoundedRectangle cornerRadius={2} fill="systemBlue" frame={{ width: 3, height: 13 }} />}
      <Text font={13} bold lineLimit={1} truncationMode="tail">{event.title}</Text>
      <Spacer />
      {event.location ? <Image systemName="mappin" font={9} foregroundStyle="systemGray" /> : null}
    </HStack>
  )

  return event.type === "reminder"
    ? <Button intent={CompleteReminderIntent({ id: event.identifier })} buttonStyle="plain">{row}</Button>
    : row
}

/** 日程列表（按时间顺序，自动去重跨天重复展示） */
export function AgendaRows({ events, maxRows = 6, spacing = 6 }: { events: AgendaItem[]; maxRows?: number; spacing?: number }) {
  const now = new Date()

  if (events.length === 0) {
    return (
      <HStack alignment="center" spacing={6} frame={{ maxWidth: "infinity" }}>
        <Image systemName="checkmark.circle" font={12} foregroundStyle="systemGray" />
        <Text font={11} foregroundStyle="systemGray">近期没有日程安排</Text>
        <Spacer />
      </HStack>
    )
  }

  return (
    <VStack alignment="leading" spacing={spacing} frame={{ maxWidth: "infinity" }}>
      {events.slice(0, maxRows).map((event) => (
        <AgendaRow key={`${event.type}-${event.identifier}`} event={event} now={now} />
      ))}
    </VStack>
  )
}

/** 天气指标小项 */
function WeatherMetric({ systemName, text }: { systemName: string; text: string }) {
  return (
    <HStack alignment="center" spacing={3}>
      <Image systemName={systemName} font={10} foregroundStyle="systemGray" />
      <Text font={10} foregroundStyle="systemGray" lineLimit={1}>{text}</Text>
    </HStack>
  )
}

/** 底部：体感 / 湿度 / 风向 + 刷新 */
export function WeatherMetrics({ weather, showRefresh = true }: { weather: WeatherSummary | null; showRefresh?: boolean }) {
  return (
    <HStack alignment="center" spacing={12} frame={{ maxWidth: "infinity" }}>
      {weather ? (
        <>
          <WeatherMetric systemName="thermometer.medium" text={`体感 ${weather.apparentTemperature}`} />
          <WeatherMetric systemName="humidity" text={weather.humidity} />
          <WeatherMetric systemName="wind" text={weather.wind} />
        </>
      ) : (
        <Text font={10} foregroundStyle="systemGray">天气数据不可用</Text>
      )}
      <Spacer />
      {showRefresh ? (
        <Button intent={RefreshWidgetIntent({})} buttonStyle="plain">
          <HStack alignment="center" spacing={2}>
            <Image systemName="arrow.clockwise" font={9} foregroundStyle="systemGray" />
            <Text font={9} foregroundStyle="systemGray">刷新</Text>
          </HStack>
        </Button>
      ) : null}
    </HStack>
  )
}
