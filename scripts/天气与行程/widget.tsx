/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-06-03 13:06:12
 * @Description: 天气与行程小部件
 * */
import { ZStack, Widget, AccessoryWidgetBackground } from "scripting"
import { type DashboardData, loadDashboardData, buildWidgetReloadDate } from "./shared"
import { CompactWidget } from "./widget_compact"
import { MediumWidget } from "./widget_medium"
import { LargeWidget } from "./widget_large"
import { RectangularWidget, CircularWidget } from "./widget_accessory"


function Root({ dashboard }: { dashboard: DashboardData }) {
  return (
    <ZStack>
      <AccessoryWidgetBackground />
      {Widget.family === "systemSmall" ? <CompactWidget dashboard={dashboard} /> : null}
      {Widget.family === "systemMedium" ? <MediumWidget dashboard={dashboard} /> : null}
      {Widget.family === "systemLarge" ? <LargeWidget dashboard={dashboard} /> : null}
      {Widget.family === "accessoryRectangular" ? <RectangularWidget dashboard={dashboard} /> : null}
      {Widget.family === "accessoryCircular" ? <CircularWidget dashboard={dashboard} /> : null}
    </ZStack>
  )
}

async function runWidget() {
  const reloadDate = buildWidgetReloadDate()
  let dashboard = await loadDashboardData()
  dashboard = {
    ...dashboard,
    reloadDate,
  }
  Widget.present(<Root dashboard={dashboard} />, {
    policy: "after",
    date: reloadDate,
  })
}

runWidget()
