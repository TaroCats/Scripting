/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-26 17:37:00
 * @Description: 中型天气日程助手小部件
 * */
import { HStack, Spacer, ZStack } from "scripting"
import { type DashboardData } from "./shared"
import { AgendaColumn, WeatherColumn } from "./widget_components"



export function MediumWidget({ dashboard }: { dashboard: DashboardData }) {

  return (
    <HStack padding={16} alignment="top">
      <AgendaColumn dashboard={dashboard} />
      <Spacer />
      <WeatherColumn dashboard={dashboard} maxHour={2} hasSpacer={true} />
    </HStack>
  )
}
