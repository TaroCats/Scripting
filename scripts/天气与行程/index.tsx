import { type AgendaItem, type DashboardData, foregroundStyle, formatEventDateTime, formatEventTime, loadDashboardData, scheduleTodayNotifications, summarizeWeather } from "./shared"
import { HStack, VStack, Text, Image, Spacer, Widget, Notification, useState, useEffect, NavigationStack, List, Button, Navigation, Script } from "scripting"

function EventBlock({
  events,
}: {
  events: AgendaItem[]
}) {
  return (
    <VStack>
      {events.length === 0 ? (
        <HStack>
          <Text foregroundStyle={foregroundStyle}>暂无数据</Text>
        </HStack>
      ) : (
        events.map((event) => (
          <HStack key={event.identifier} alignment="center">
            <VStack alignment="leading">
              <Text font="headline">{event.title}</Text>
              <HStack>
                <Image systemName="clock" foregroundStyle={foregroundStyle} font="footnote" />
                <Text font="subheadline" foregroundStyle={foregroundStyle}>{formatEventDateTime(event)}
                </Text>
              </HStack>
              {event.location ? (
                <HStack>
                  <Image systemName="mappin.and.ellipse" foregroundStyle={foregroundStyle} font="footnote" />
                  <Text font="subheadline" foregroundStyle={foregroundStyle}>{event.location}
                  </Text>
                </HStack>
              ) : null}
            </VStack>
            <Spacer />
            {event.type === "reminder" ? (
              <Image systemName="circle" foregroundStyle="systemBlue" />
            ) : (
              <Image systemName="calendar" foregroundStyle="systemRed" />
            )}
          </HStack>
        ))
      )}
    </VStack>
  )
}

function WeatherBlock({ dashboard }: { dashboard: DashboardData }) {
  return (
    <VStack>
      {dashboard.weather ? (
        <VStack alignment="leading" spacing={8}>
          <HStack>
            <Image systemName={dashboard.weather.symbolName} font="title" foregroundStyle="systemBlue" />
            <Text font="title">{dashboard.weather.temperature}</Text>
            <Spacer />
            <Text font="headline" foregroundStyle={foregroundStyle}>{dashboard.locationName}</Text>
          </HStack>
          <Text font="subheadline" foregroundStyle={foregroundStyle}>{`${dashboard.weather.condition} · H:${dashboard.weather.highTemperature} L:${dashboard.weather.lowTemperature} · 体感 ${dashboard.weather.apparentTemperature} · 湿度 ${dashboard.weather.humidity}`}</Text>
          <Text font="footnote" foregroundStyle={foregroundStyle}>{`风速 ${dashboard.weather.wind}`}</Text>
          {dashboard.weather.dailySummary ? (
            <Text font="footnote" foregroundStyle={foregroundStyle}>{dashboard.weather.dailySummary}</Text>
          ) : null}
        </VStack>
      ) : (
        <Text foregroundStyle={foregroundStyle}>天气数据不可用</Text>
      )}
    </VStack>
  )
}

function SummaryBlock({ dashboard }: { dashboard: DashboardData }) {
  const nextEvent = dashboard.upcomingEvents[0]
  const upcomingCount = dashboard.todayEvents.filter((event) => {
    return event.endDate.getTime() >= Date.now()
  }).length

  return (
    <VStack navigationTitle="今日摘要">
      <VStack alignment="leading" spacing={4}>
        <HStack>
          <Image systemName="list.bullet.clipboard" foregroundStyle="systemGreen" />
          <Text>{`今日行程与提醒：${dashboard.todayEvents.length} 项 (待开始 ${upcomingCount} 项)`}</Text>
        </HStack>
        <HStack>
          <Image systemName="cloud.sun" foregroundStyle="systemYellow" />
          <Text>{`天气提醒结合：${summarizeWeather(dashboard.weather)}`}</Text>
        </HStack>
        {nextEvent ? (
          <HStack>
            <Image systemName="arrow.right.circle" foregroundStyle="systemOrange" />
            <Text>{`下一项：${nextEvent.title} · ${formatEventTime(nextEvent)}`}</Text>
          </HStack>
        ) : (
          <HStack>
            <Image systemName="checkmark.circle" foregroundStyle="systemGreen" />
            <Text>今天没有待开始的行程</Text>
          </HStack>
        )}
      </VStack>
    </VStack>
  )
}

function WarningBlock({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null
  }

  return (
    <VStack navigationTitle="需要注意">
      {warnings.map((warning, index) => (
        <HStack key={`${warning}-${index}`}>
          <Image systemName="exclamationmark.triangle" foregroundStyle="systemRed" />
          <Text foregroundStyle="systemRed">{warning}</Text>
        </HStack>
      ))}
    </VStack>
  )
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(() => {
    const title = Notification.current?.request?.content?.title
    return title ? `通过通知进入：${title}` : ""
  })

  const refreshDashboard = async () => {
    setLoading(true)
    setMessage("正在刷新天气和日程...")

    try {
      const nextDashboard = await loadDashboardData()
      setDashboard(nextDashboard)
      setMessage(`已刷新：${nextDashboard.generatedAt.toLocaleTimeString("zh-CN")}`)
      await Widget.reloadAll()
    } catch (error) {
      const text = error instanceof Error ? error.message : "刷新失败"
      setMessage(text)
    } finally {
      setLoading(false)
    }
  }

  const scheduleReminders = async () => {
    if (!dashboard) {
      setMessage("请先完成一次数据刷新。")
      return
    }

    if (dashboard.todayEvents.length === 0) {
      setMessage("今日日程为空，无需安排提醒。")
      return
    }

    setMessage("正在安排今日日程提醒...")

    try {
      const result = await scheduleTodayNotifications(dashboard, 30)
      setMessage(`已安排 ${result.scheduledCount} 条提醒，跳过 ${result.skippedCount} 条。`)
    } catch (error) {
      const text = error instanceof Error ? error.message : "安排提醒失败"
      setMessage(text)
    }
  }

  useEffect(() => {
    refreshDashboard()
  }, [])

  return (
    <NavigationStack>
      <List navigationTitle={"天气日程助手"}>
        {message ? (
          <VStack>
            <Text font="footnote" foregroundStyle={{
              light: "black",
              dark: "white"
            }}>{`${message}`}</Text>
          </VStack>
        ) : null}

        {loading && !dashboard ? (
          <VStack><Text>加载中...</Text></VStack>
        ) : null}

        {dashboard ? (
          <>
            <SummaryBlock dashboard={dashboard} />
            <WeatherBlock dashboard={dashboard} />
            <EventBlock events={dashboard.todayEvents} />
            <EventBlock events={dashboard.upcomingEvents} />
            <WarningBlock warnings={dashboard.warnings} />

            <HStack navigationTitle="操作">
              <Button title="刷新数据" action={refreshDashboard} />
              <Button title="为今日日程安排提醒" action={scheduleReminders} />
            </HStack>
          </>
        ) : null}
      </List>
    </NavigationStack>
  )
}

async function runApp() {
  await Navigation.present({
    element: <App />,
  })

  Script.exit()
}

runApp()
