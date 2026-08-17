import { ZStack, Widget, AccessoryWidgetBackground } from "scripting"
import { type DashboardData, loadDashboardData, buildWidgetReloadDate } from "./shared/shared"
import { CompactWidget } from "./widgets/widget_compact"
import { MediumWidget } from "./widgets/widget_medium"
import { LargeWidget } from "./widgets/widget_large"
import { RectangularWidget, CircularWidget } from "./widgets/widget_accessory"

function Root({ dashboard }: { dashboard: DashboardData }) {
  return (
    <ZStack>
      {Widget.family === "accessoryRectangular" || Widget.family === "accessoryCircular" ? <AccessoryWidgetBackground /> : null}
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
