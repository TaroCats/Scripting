/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-06-03 11:17:39
 * @Description: 
 */
import { type DashboardData, foregroundStyle, loadDashboardData } from "./shared"
import { HStack, VStack, Text, Widget, Notification, useState, useEffect, NavigationStack, List, Button, Navigation, Script } from "scripting"
import { LargeWidget } from "./widget_large"


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



  useEffect(() => {
    refreshDashboard()
  }, [])

  return (
    <NavigationStack>
      <List navigationTitle={"天气日程助手"}>
        {loading && !dashboard ? (
          <VStack><Text>加载中...</Text></VStack>
        ) : null}

        {dashboard ? (
          <>
            <LargeWidget dashboard={dashboard} />
            <HStack>
              <Button title="刷新数据" action={refreshDashboard} />
              {message ? (
                <VStack>
                  <Text font="footnote" foregroundStyle={foregroundStyle}>{`${message}`}</Text>
                </VStack>
              ) : null}
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
