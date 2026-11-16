/**
 * 小组件入口。
 *
 * Widget 上下文在 Widget.present 之后立刻销毁，Hooks 不生效，
 * 所以配置、快照、网络请求全部在 present 之前完成。
 *
 * 取数策略：
 *   1. 先读 App Group 里上次的快照；
 *   2. 超过 refreshMinutes 就现场拉一次（超时 6 秒，别撑爆 WidgetKit 的时间预算）；
 *   3. 拉失败且手里有旧数据 → 继续用旧数据，头部标成橙色"陈旧"；
 *   4. 拉失败且没旧数据 → 显示错误原因，告诉用户去 App 里改哪里。
 */
import { AccessoryWidgetBackground, Script, Widget, ZStack } from "scripting"
import { buildSnapshot, pickCards } from "./core/panel"
import { loadConfig, readSnapshot, writeSnapshot } from "./core/store"
import type { PanelSnapshot } from "./core/types"
import {
  CircularView,
  InlineView,
  LargeView,
  MediumView,
  RectangularView,
  SmallView,
  type WidgetData,
} from "./widgets/widget_families"

/** 每个尺寸能塞下的卡数上限（再多的配置也不硬塞） */
const FAMILY_CAP: Record<string, number> = {
  systemSmall: 3,
  systemMedium: 4,
  systemLarge: 5,
  systemExtraLarge: 6,
  systemExtraLargePortrait: 6,
}

function Root({ data }: { data: WidgetData }) {
  // accessoryInline 只允许单行文本，套 ZStack 会被系统丢掉
  if (Widget.family === "accessoryInline") {
    return <InlineView data={data} />
  }
  return (
    <ZStack>
      {Widget.family === "accessoryRectangular" || Widget.family === "accessoryCircular" ? (
        <AccessoryWidgetBackground />
      ) : null}
      {Widget.family === "systemSmall" ? <SmallView data={data} /> : null}
      {Widget.family === "systemMedium" ? <MediumView data={data} /> : null}
      {Widget.family === "systemLarge" ||
      Widget.family === "systemExtraLarge" ||
      Widget.family === "systemExtraLargePortrait" ? (
        <LargeView data={data} />
      ) : null}
      {Widget.family === "accessoryRectangular" ? <RectangularView data={data} /> : null}
      {Widget.family === "accessoryCircular" ? <CircularView data={data} /> : null}
    </ZStack>
  )
}

async function run() {
  const cfg = loadConfig()
  const ttl = Math.max(1, cfg.refreshMinutes) * 60 * 1000
  const startedAt = Date.now()

  let snapshot = readSnapshot()
  if (!snapshot || startedAt - snapshot.fetchedAt > ttl) {
    const fresh = await buildSnapshot(cfg)
    if (fresh.error && snapshot && snapshot.cards.length > 0) {
      // 失败的这一轮不覆盖旧卡，只把原因记下来
      snapshot = { ...snapshot, error: fresh.error }
    } else {
      writeSnapshot(fresh)
      snapshot = fresh
    }
  }

  const effective: PanelSnapshot = snapshot ?? { fetchedAt: 0, cards: [], gateway: null }
  const now = Date.now()
  const stale = !effective.fetchedAt || now - effective.fetchedAt > ttl
  const cap = Math.min(FAMILY_CAP[Widget.family] ?? cfg.maxCards, cfg.maxCards)

  const data: WidgetData = {
    snapshot: effective,
    cards: pickCards(effective, cfg, cap),
    cfg,
    stale,
    now,
    appURL: Script.createRunURLScheme(Script.name, { from: "widget" }),
  }

  Widget.present(<Root data={data} />, { policy: "after", date: new Date(now + ttl) })
}

run()
