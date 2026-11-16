/**
 * 各尺寸的小组件视图。数据在 Widget.present 之前一次性备好，这里只负责画。
 *
 * 尺寸策略：
 *   systemSmall  3 张最紧张的卡（紧凑行）
 *   systemMedium 网关紧凑行 + 2 列 × 2 卡
 *   systemLarge  网关完整条 + 最多 5 张卡的明细
 *   锁屏矩形/圆形/单行 只给最紧张的那一张
 */
import { Divider, Gauge, HStack, Link, Spacer, Text, VStack } from "scripting"
import { fmtAgo, fmtClock, fmtPct, quotaColor } from "../core/format"
import type { PanelCard, PanelConfig, PanelSnapshot } from "../core/types"
import { CompactCard, DetailCard, EmptyHint, GatewayLine, Header, primaryWindow } from "./widget_parts"

export type WidgetData = {
  snapshot: PanelSnapshot
  cards: PanelCard[]
  cfg: PanelConfig
  stale: boolean
  now: number
  appURL: string
}

function Empty({ data, compact }: { data: WidgetData; compact?: boolean }) {
  if (data.snapshot.error) {
    return <EmptyHint text="连不上网关" sub={compact ? "打开 MagPanel 检查地址与 key" : data.snapshot.error} />
  }
  return <EmptyHint text="还没有配额卡" sub="在 magpie 里登录供应商，然后打开 MagPanel 刷新一次" />
}

export function SmallView({ data }: { data: WidgetData }) {
  const cards = data.cards.slice(0, 3)
  return (
    <VStack alignment="leading" spacing={7} padding={{ vertical: 12, horizontal: 14 }}>
      <Header
        snapshot={data.snapshot}
        stale={data.stale}
        count={cards.length}
        clock={fmtClock(data.snapshot.fetchedAt)}
        title={data.cfg.title}
        showTitleIcon={data.cfg.showTitleIcon}
      />
      {cards.length === 0 ? (
        <Empty data={data} compact />
      ) : (
        cards.map(card => <CompactCard card={card} metric={data.cfg.metric} now={data.now} showIcons={data.cfg.showIcons} />)
      )}
    </VStack>
  )
}

export function MediumView({ data }: { data: WidgetData }) {
  const cards = data.cards.slice(0, 4)
  const left = cards.filter((_, i) => i % 2 === 0)
  const right = cards.filter((_, i) => i % 2 === 1)
  return (
    <VStack alignment="leading" spacing={8} padding={{ vertical: 12, horizontal: 14 }}>
      <Header
        snapshot={data.snapshot}
        stale={data.stale}
        count={cards.length}
        clock={fmtClock(data.snapshot.fetchedAt)}
        title={data.cfg.title}
        showTitleIcon={data.cfg.showTitleIcon}
      />
      {data.cfg.showGateway && data.snapshot.gateway ? <GatewayLine gateway={data.snapshot.gateway} now={data.now} compact /> : null}
      {cards.length === 0 ? (
        <Empty data={data} compact />
      ) : (
        <HStack alignment="top" spacing={14}>
          <VStack alignment="leading" spacing={9} frame={{ maxWidth: "infinity" }}>
            {left.map(card => (
              <CompactCard card={card} metric={data.cfg.metric} now={data.now} showIcons={data.cfg.showIcons} />
            ))}
          </VStack>
          <VStack alignment="leading" spacing={9} frame={{ maxWidth: "infinity" }}>
            {right.map(card => (
              <CompactCard card={card} metric={data.cfg.metric} now={data.now} showIcons={data.cfg.showIcons} />
            ))}
          </VStack>
        </HStack>
      )}
    </VStack>
  )
}

export function LargeView({ data }: { data: WidgetData }) {
  const cards = data.cards.slice(0, 5)
  return (
    <VStack alignment="leading" spacing={8} padding={{ vertical: 14, horizontal: 16 }}>
      <Header
        snapshot={data.snapshot}
        stale={data.stale}
        count={cards.length}
        clock={fmtClock(data.snapshot.fetchedAt)}
        title={data.cfg.title}
        showTitleIcon={data.cfg.showTitleIcon}
      />
      {data.cfg.showGateway && data.snapshot.gateway ? <GatewayLine gateway={data.snapshot.gateway} now={data.now} /> : null}
      {data.cfg.showGateway && data.snapshot.gateway ? <Divider /> : null}
      {cards.length === 0 ? (
        <Empty data={data} />
      ) : (
        cards.map(card => <DetailCard card={card} metric={data.cfg.metric} now={data.now} maxWindows={3} showIcons={data.cfg.showIcons} />)
      )}
      <Spacer />
      <Link url={data.appURL}>
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
          更新于 {fmtAgo(data.snapshot.fetchedAt, data.now)}
        </Text>
      </Link>
    </VStack>
  )
}

/** 锁屏矩形：两行，最紧张的两张卡 */
export function RectangularView({ data }: { data: WidgetData }) {
  const cards = data.cards.slice(0, 2)
  if (cards.length === 0) {
    return <Text font="caption2">magpie 无数据</Text>
  }
  return (
    <VStack alignment="leading" spacing={1}>
      {cards.map(card => {
        const win = primaryWindow(card)
        return (
          <HStack spacing={4}>
            <Text font="caption2" lineLimit={1}>
              {card.title}
            </Text>
            <Spacer />
            <Text
              font="caption2"
              bold
              lineLimit={1}
              foregroundStyle={win && win.hasShare ? quotaColor(win.leftPct) : "secondaryLabel"}
            >
              {win && win.hasShare ? fmtPct(data.cfg.metric === "used" ? 100 - win.leftPct : win.leftPct) : "—"}
            </Text>
          </HStack>
        )
      })}
    </VStack>
  )
}

/** 锁屏圆形：全局最紧张的余量 */
export function CircularView({ data }: { data: WidgetData }) {
  const card = data.cards[0]
  const win = card ? primaryWindow(card) : null
  const left = win && win.hasShare ? win.leftPct : 100
  return (
    <Gauge
      value={data.cfg.metric === "used" ? 100 - left : left}
      min={0}
      max={100}
      label={<Text>余</Text>}
      currentValueLabel={<Text font="caption2">{win && win.hasShare ? fmtPct(data.cfg.metric === "used" ? 100 - left : left) : "--"}</Text>}
      gaugeStyle="accessoryCircular"
    />
  )
}

/** 锁屏单行：一行纯文本 */
export function InlineView({ data }: { data: WidgetData }) {
  const card = data.cards[0]
  const win = card ? primaryWindow(card) : null
  const value = win && win.hasShare ? fmtPct(data.cfg.metric === "used" ? 100 - win.leftPct : win.leftPct) : "--"
  return <Text>{`magpie ${card ? card.title : ""} ${value}`}</Text>
}
