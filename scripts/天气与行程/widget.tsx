import { ZStack, Widget } from "scripting"
import { type DashboardData, loadDashboardData, buildWidgetReloadDate } from "./shared"
import { CompactWidget } from "./widget_compact"
import { MediumWidget } from "./widget_medium"
import { LargeWidget } from "./widget_large"
import { RectangularWidget, CircularWidget } from "./widget_accessory"


function Root({ dashboard }: { dashboard: DashboardData }) {
  return (
    <ZStack background="systemBackground">
      {Widget.family === "systemSmall" ? <CompactWidget dashboard={dashboard} /> : null}
      {Widget.family === "systemMedium" ? <MediumWidget dashboard={dashboard} /> : null}
      {Widget.family === "systemLarge" ? <LargeWidget dashboard={dashboard} /> : null}
      {Widget.family === "accessoryRectangular" ? <RectangularWidget dashboard={dashboard} /> : null}
      {Widget.family === "accessoryCircular" ? <CircularWidget dashboard={dashboard} /> : null}
    </ZStack>
  )
}

async function runWidget() {
  const dashboard = await loadDashboardData()
  console.log(dashboard)
  Widget.present(<Root dashboard={dashboard} />, {
    policy: "after",
    date: buildWidgetReloadDate(),
  })
}

runWidget()
