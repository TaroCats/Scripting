/**
 * 小组件交互意图。所有 AppIntent 必须注册在 app_intents.tsx。
 * 执行环境是 app_intents 扩展，可以联网，不适合做重活：拉一次配额卡就返回。
 */
import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { buildSnapshot } from "./core/panel"
import { loadConfig, writeSnapshot } from "./core/store"

/** 手动刷新：拉一次面板，写快照，再让所有小组件重取时间线 */
export const RefreshPanelIntent = AppIntentManager.register({
  name: "RefreshPanelIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    const cfg = loadConfig()
    const snap = await buildSnapshot(cfg, 10000)
    // 整轮都失败时不要把上一份好数据冲掉
    if (!snap.error || snap.cards.length > 0) writeSnapshot(snap)
    Widget.reloadAll()
  },
})
