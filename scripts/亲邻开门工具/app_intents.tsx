/**
 * 小组件交互意图。
 *
 * 所有 AppIntent 必须注册在 app_intents.tsx 中；执行时 Script.env === "app_intents"，
 * 可以联网，但不能使用蓝牙（BLE 只在主 App 里可用）。
 * 具体的日志与错误文案由 widget_shared 统一写入，这里只处理会话失效后的登出。
 */
import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { openDoorFromWidget, syncDoors, type OpResult } from "./widget_shared"
import { clearSession } from "./core/session"

/** 会话过期就清掉本地登录态，让小组件下次渲染显示“未登录” */
function handleExpired(result: OpResult): void {
  if (result.expired) clearSession()
}

/** 远程开门（小组件里点击门禁按钮） */
export const OpenDoorIntent = AppIntentManager.register({
  name: "OpenDoorIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (params: { doorControlId: string; doorControlName: string; macAddress: string }) => {
    handleExpired(await openDoorFromWidget(params))
    Widget.reloadAll()
  },
})

/** 同步门禁列表 */
export const SyncDoorsIntent = AppIntentManager.register({
  name: "SyncDoorsIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    handleExpired(await syncDoors())
    Widget.reloadAll()
  },
})
