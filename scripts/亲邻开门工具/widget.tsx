/**
 * 小组件入口。
 *
 * Widget 上下文在 `Widget.present` 之后立即销毁，Hooks 也不生效，
 * 所以配置、门禁、会话都必须在 present 之前一次性读好。
 * 渲染阶段不发起网络请求（避免超时白屏），会话续期与联网都放在
 * 点击按钮触发的 AppIntent 里（见 app_intents.tsx）。
 * 小组件只支持远程开门，蓝牙开门请回到主 App。
 */
import { AccessoryWidgetBackground, Script, Text, Widget, ZStack } from "scripting"
import { arrangeDoors, loadDoorPrefs } from "./core/door_prefs"
import { BUILD_TAG, K, type WidgetDiag } from "./core/protocol"
import { loadSession } from "./core/session"
import {
  buildReloadDate,
  loadDoors,
  loadLogs,
} from "./widget_shared"
import {
  CircularWidget,
  LargeWidget,
  MediumWidget,
  RectangularWidget,
  SmallWidget,
  type WidgetData,
} from "./widget_views"

function Root({ data }: { data: WidgetData }) {
  // accessoryInline 只允许单行文本，套在 ZStack 里会被系统丢弃
  if (Widget.family === "accessoryInline") {
    return <Text>{data.selected?.doorControlName ?? "亲邻开门"}</Text>
  }

  // 注意：这里**不能**在根容器上挂 widgetURL。
  // 根级 widgetURL 会让整块区域变成"打开 App"的点击目标，把内部 Button 的
  // AppIntent 抢掉，表现就是点小组件按钮毫无反应。打开 App 的入口改由各视图里的
  // <Link url={data.appURL}> 承担（见 widget_views.tsx）。
  return (
    <ZStack>
      {Widget.family === "accessoryRectangular" || Widget.family === "accessoryCircular" ? (
        <AccessoryWidgetBackground />
      ) : null}
      {Widget.family === "systemSmall" ? <SmallWidget data={data} /> : null}
      {Widget.family === "systemMedium" ? <MediumWidget data={data} /> : null}
      {Widget.family === "systemLarge" ||
      Widget.family === "systemExtraLarge" ||
      Widget.family === "systemExtraLargePortrait" ? (
        <LargeWidget data={data} />
      ) : null}
      {Widget.family === "accessoryRectangular" ? <RectangularWidget data={data} /> : null}
      {Widget.family === "accessoryCircular" ? <CircularWidget data={data} /> : null}
    </ZStack>
  )
}

function runWidget() {
  // ensureSession 里会联网，渲染阶段只读本地会话；真正续期在 intent 里做
  const session = loadSession()
  const prefs = loadDoorPrefs()
  // 顺序完全由 App 里的「排序 + 收藏」决定：收藏在前，组内按手动顺序
  const doors = arrangeDoors(loadDoors(), prefs)
  const logs = loadLogs()

  // 渲染指纹：App 的「我的 → 数据快照」会把它读出来。
  // 时间戳不更新 = 小组件根本没重跑；BUILD_TAG 不是最新 = 桌面跑的是旧代码。
  try {
    const diag: WidgetDiag = {
      ts: Date.now(),
      count: doors.length,
      ids: doors.map(d => d.doorControlId),
      names: doors.map(d => d.doorControlName),
      orderLen: prefs.order.length,
      faveLen: prefs.favorites.length,
      version: BUILD_TAG,
    }
    Storage.set(K.widgetDiag, diag)
  } catch { /* 诊断写不进去不影响出图 */ }

  const data: WidgetData = {
    session,
    doors,
    selected: doors[0] ?? null,
    favorites: prefs.favorites,
    lastLog: logs[0] ?? null,
    appURL: Script.createRunURLScheme(Script.name, { from: "widget", tab: "door" }),
  }

  Widget.present(<Root data={data} />, { policy: "after", date: buildReloadDate(session) })
}

runWidget()
