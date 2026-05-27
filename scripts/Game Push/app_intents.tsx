/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-27 10:40:31
 * @Description: 游戏推送应用意图
 * */
import { stepWidgetIndex } from "./shared"

import { Widget, AppIntentManager, AppIntentProtocol } from "scripting"

export const NextGameIntent = AppIntentManager.register({
  name: "GamePushNextGameIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async ({ total }: { total: number }) => {
    await stepWidgetIndex(total)
    await Widget.reloadAll()
  },
})

export const RefreshWidgetIntent = AppIntentManager.register({
  name: "GamePushRefreshWidgetIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    await Widget.reloadAll()
  },
})

