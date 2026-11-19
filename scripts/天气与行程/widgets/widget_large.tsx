/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-11-19 01:19:29
 * @Description: 大号 / 超大号天气日程助手小部件
 */
import { HStack, VStack, Spacer, Text, Image, Button, Divider, Widget } from "scripting"
import { type DashboardData, type WeatherSummary } from "../shared/shared"
import { RefreshWidgetIntent } from "../app_intents"
import {
  AgendaRows,
  DailyForecastList,
  HourlyStrip,
  SectionTitle,
  WeatherHeader,
  WeatherMetrics,
} from "./widget_components"

/** 天气详情：体感 / 湿度 / 风向 */
function WeatherDetails({ weather }: { weather: WeatherSummary }) {
  const rows = [
    { icon: "thermometer.medium", label: "体感", value: weather.apparentTemperature },
    { icon: "humidity", label: "湿度", value: weather.humidity },
    { icon: "wind", label: "风向", value: weather.wind },
  ]

  return (
    <VStack alignment="leading" spacing={7} frame={{ maxWidth: "infinity" }}>
      {rows.map((row) => (
        <HStack key={row.label} alignment="center" spacing={6} frame={{ maxWidth: "infinity" }}>
          <Image systemName={row.icon} font={11} foregroundStyle="systemGray" frame={{ width: 15 }} />
          <Text font={11} foregroundStyle="systemGray">{row.label}</Text>
          <Spacer />
          <Text font={11} bold lineLimit={1}>{row.value}</Text>
        </HStack>
      ))}
    </VStack>
  )
}

/** 根据可用高度与条数计算行间距，尽量铺满又不溢出 */
function fitAgendaSpacing(count: number, budget: number, min: number, max: number) {
  if (count <= 1) return max
  const raw = Math.floor((budget - count * 18) / (count - 1))
  return Math.max(min, Math.min(max, raw))
}

/** 读取小组件高度；非小组件环境或无效值时用兜底值 */
function widgetHeight(fallback: number) {
  const height = Widget.displaySize?.height
  return typeof height === "number" && height > 100 ? height : fallback
}

/** 大号：扣除头部/逐时/标题/指标后的剩余高度 */
function largeAgendaSpacing(count: number, hasTomorrow: boolean) {
  const height = widgetHeight(361)
  const fixed = 127 + (hasTomorrow ? 87 : 56)
  return fitAgendaSpacing(count, Math.max(60, height - 36 - fixed), 4, 16)
}

/** 超大号左栏：根据条数均摊竖向空间，让日程铺满整列 */
function extraAgendaSpacing(count: number) {
  const height = widgetHeight(376)
  return fitAgendaSpacing(count, Math.max(80, height - 130), 6, 30)
}

/**
 * 大号小组件的纵向布局
 * 顶部日期与实时天气 → 逐时预报 → 日程列表 → 明日天气 → 底部天气指标
 */
function StackedWidget({ dashboard }: { dashboard: DashboardData }) {
  const weather = dashboard.weather
  const events = dashboard.upcomingEvents
  const maxRows = 6
  const showTomorrow = Boolean(weather?.dailySummary) && events.length <= 5
  const rowCount = Math.min(events.length, maxRows)
  const trailing = events.length > maxRows
    ? `还有 ${events.length - maxRows} 项`
    : events.length > 0 ? `共 ${events.length} 项` : undefined

  return (
    <VStack alignment="leading" spacing={8} padding={16}>
      <WeatherHeader dashboard={dashboard} />

      {weather ? (
        <>
          <Divider />
          <HourlyStrip forecast={weather.hourlyForecast} maxHour={6} />
          <Divider />
        </>
      ) : null}

      <SectionTitle
        systemName="calendar"
        text="日程"
        trailing={trailing}
      />
      <AgendaRows
        events={events}
        maxRows={maxRows}
        spacing={largeAgendaSpacing(rowCount, showTomorrow)}
      />

      <Spacer />

      {showTomorrow && weather?.dailySummary ? (
        <>
          <Divider />
          <HStack alignment="center" spacing={5} frame={{ maxWidth: "infinity" }}>
            <Image systemName="sun.max" font={10} foregroundStyle="systemGray" />
            <Text font={10} bold foregroundStyle="systemGray">明日</Text>
            <Text font={11} lineLimit={1}>
              {weather.dailySummary.replace(/^明日\s*/, "")}
            </Text>
            <Spacer />
          </HStack>
        </>
      ) : null}

      <WeatherMetrics weather={weather} />
    </VStack>
  )
}

/**
 * 大号小组件（systemLarge）
 */
export function LargeWidget({ dashboard }: { dashboard: DashboardData }) {
  return <StackedWidget dashboard={dashboard} />
}

/**
 * 竖版超大号小组件（systemExtraLargePortrait）
 * 窄而高：实时天气 → 逐时预报 → 天气指标 → 未来几天 → 日程 → 明日/刷新
 */
export function ExtraLargePortraitWidget({ dashboard }: { dashboard: DashboardData }) {
  const weather = dashboard.weather
  const events = dashboard.upcomingEvents
  const maxRows = 10
  const rowCount = Math.min(events.length, maxRows)
  const trailing = events.length > maxRows
    ? `还有 ${events.length - maxRows} 项`
    : events.length > 0 ? `共 ${events.length} 项` : undefined

  const height = widgetHeight(720)
  const dailyForecast = weather?.dailyForecast ?? []
  // 只有足够高时才展开多日预报
  const maxDays = height >= 600
    ? Math.max(0, Math.min(dailyForecast.length, Math.floor((height - 560) / 32)))
    : 0

  const agendaFixed = 218 + (maxDays > 0 ? 146 : 0)
  const agendaSpacing = fitAgendaSpacing(
    rowCount,
    Math.max(60, height - 36 - agendaFixed),
    4,
    28,
  )

  return (
    <VStack alignment="leading" spacing={9} padding={18}>
      <WeatherHeader dashboard={dashboard} />

      {weather ? (
        <>
          <Divider />
          <HourlyStrip forecast={weather.hourlyForecast} maxHour={6} />
          <Divider />
          <WeatherMetrics weather={weather} showRefresh={false} />
        </>
      ) : null}

      {maxDays > 0 ? (
        <>
          <Divider />
          <SectionTitle systemName="sun.max" text="未来几天" />
          <DailyForecastList forecast={dailyForecast} maxDays={maxDays} />
        </>
      ) : null}

      <Spacer />

      <SectionTitle systemName="calendar" text="日程" trailing={trailing} />
      <AgendaRows events={events} maxRows={maxRows} spacing={agendaSpacing} />

      <Spacer />

      <Divider />
      <HStack alignment="center" spacing={5} frame={{ maxWidth: "infinity" }}>
        {weather?.dailySummary ? (
          <>
            <Image systemName="sun.max" font={10} foregroundStyle="systemGray" />
            <Text font={10} bold foregroundStyle="systemGray">明日</Text>
            <Text font={11} lineLimit={1}>
              {weather.dailySummary.replace(/^明日\s*/, "")}
            </Text>
          </>
        ) : (
          <Text font={10} foregroundStyle="systemGray" lineLimit={1}>{dashboard.locationName}</Text>
        )}
        <Spacer />
        <Button intent={RefreshWidgetIntent({})} buttonStyle="plain">
          <HStack alignment="center" spacing={2}>
            <Image systemName="arrow.clockwise" font={9} foregroundStyle="systemGray" />
            <Text font={9} foregroundStyle="systemGray">刷新</Text>
          </HStack>
        </Button>
      </HStack>
    </VStack>
  )
}

/**
 * 超大号小组件（systemExtraLarge / systemExtraLargePortrait）
 * 左右分栏：左侧日程，右侧天气信息
 */
export function ExtraLargeWidget({ dashboard }: { dashboard: DashboardData }) {
  const size = Widget.displaySize
  // 竖版或近方形尺寸下，左右分栏会被挤压，改用纵向堆叠
  if (size && size.height > size.width) {
    return <ExtraLargePortraitWidget dashboard={dashboard} />
  }

  const weather = dashboard.weather
  const events = dashboard.upcomingEvents
  const maxRows = 8
  const trailing = events.length > maxRows
    ? `还有 ${events.length - maxRows} 项`
    : events.length > 0 ? `共 ${events.length} 项` : undefined

  const dailyForecast = weather?.dailyForecast ?? []
  // 根据右栏可用高度决定展示几天，避免溢出
  const dailyDays = Math.max(0, Math.min(dailyForecast.length, Math.floor((widgetHeight(376) - 278) / 24)))

  return (
    <HStack alignment="top" spacing={18} padding={18}>
      <VStack
        alignment="leading"
        spacing={8}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      >
        <WeatherHeader dashboard={dashboard} />
        <Divider />
        <SectionTitle
          systemName="calendar"
          text="日程"
          trailing={trailing}
        />
        <AgendaRows events={events} maxRows={maxRows} spacing={extraAgendaSpacing(Math.min(events.length, maxRows))} />
        <Spacer />
      </VStack>

      <Divider />

      <VStack
        alignment="leading"
        spacing={10}
        frame={{ width: 250, maxHeight: "infinity", alignment: "topLeading" }}
      >
        {weather ? (
          <>
            <SectionTitle systemName="clock" text="逐时预报" />
            <HourlyStrip forecast={weather.hourlyForecast} maxHour={6} />
            <Divider />
            <SectionTitle systemName="thermometer.medium" text="天气详情" />
            <WeatherDetails weather={weather} />
            {dailyDays > 0 ? (
              <>
                <Divider />
                <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity" }}>
                  <SectionTitle systemName="sun.max" text="未来几天" />
                  <DailyForecastList forecast={dailyForecast} maxDays={dailyDays} />
                </VStack>
              </>
            ) : weather.dailySummary ? (
              <>
                <Divider />
                <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity" }}>
                  <SectionTitle systemName="sun.max" text="明日天气" />
                  <Text font={11} foregroundStyle="systemGray" lineLimit={2}>
                    {weather.dailySummary.replace(/^明日\s*/, "")}
                  </Text>
                </VStack>
              </>
            ) : null}
          </>
        ) : (
          <Text font={11} foregroundStyle="systemGray" lineLimit={3}>
            {dashboard.warnings?.join(" ") || "天气数据不可用"}
          </Text>
        )}

        <Spacer />

        <HStack alignment="center" spacing={8} frame={{ maxWidth: "infinity" }}>
          <Text font={10} foregroundStyle="systemGray" lineLimit={1}>{dashboard.locationName}</Text>
          <Spacer />
          <Button intent={RefreshWidgetIntent({})} buttonStyle="plain">
            <HStack alignment="center" spacing={2}>
              <Image systemName="arrow.clockwise" font={9} foregroundStyle="systemGray" />
              <Text font={9} foregroundStyle="systemGray">刷新</Text>
            </HStack>
          </Button>
        </HStack>
      </VStack>
    </HStack>
  )
}
