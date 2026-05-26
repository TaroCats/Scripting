/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 16:24:02
 * @Description: 
 */
import { VStack, Spacer} from "scripting"
import { type DashboardData } from "./shared"

import { AgendaColumn, WeatherColumn } from "./widget_components"

export function LargeWidget({ dashboard }: { dashboard: DashboardData }) {
  return (
    <VStack alignment="leading" padding={16}>
      <AgendaColumn dashboard={dashboard} />
      <Spacer />
      <WeatherColumn dashboard={dashboard} maxHour={6} />
    </VStack>
  )
}
