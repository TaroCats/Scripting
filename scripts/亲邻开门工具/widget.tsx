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
import { BUILD_TAG, type WidgetDiag } from "./core/protocol"
import { readSnapshot, writeWidgetSnapshot } from "./core/snapshot"
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
  // 数据来源优先 App Group 文件：实测扩展进程读不到 App 的私有 Storage（偏好永远是空的，
  // 于是排序永远退回服务端顺序）。文件读不到才退回本地 Storage。
  const snap = readSnapshot()
  // 会话同理：Keychain 读不到时用快照里的（同容器，不进系统「文件」App）
  const session = loadSession() ?? snap?.session ?? null
  const fromFile = Boolean(snap && snap.doors.length > 0)
  const prefs = fromFile && snap ? snap.prefs : loadDoorPrefs()
  const rawDoors = fromFile && snap ? snap.doors : loadDoors()
  // 顺序完全由 App 里的「排序 + 收藏」决定：收藏在前，组内按手动顺序
  const doors = arrangeDoors(rawDoors, prefs)
  const logs = loadLogs()

  const diag: WidgetDiag = {
    ts: Date.now(),
    count: doors.length,
    ids: doors.map(d => d.doorControlId),
    names: doors.map(d => d.doorControlName),
    orderLen: prefs.order.length,
    faveLen: prefs.favorites.length,
    version: BUILD_TAG,
    source: fromFile ? "file" : "storage",
  }
  // 写在 present 之前：即使出图阶段抛错，这条也会落盘，App 里能看到
  writeWidgetSnapshot(diag, doors, prefs)

  const data: WidgetData = {
    session,
    doors,
    selected: doors[0] ?? null,
    favorites: prefs.favorites,
    lastLog: logs[0] ?? null,
    lastResult: snap?.lastResult ?? null,
    appURL: Script.createRunURLScheme(Script.name, { from: "widget", tab: "door" }),
  }

  Widget.present(<Root data={data} />, { policy: "after", date: buildReloadDate(session) })
}

runWidget()
