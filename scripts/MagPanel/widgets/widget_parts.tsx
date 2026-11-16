/**
 * 小组件通用零件。所有颜色都用语义色（label / secondaryLabel / systemGreen…），
 * 深浅色与透明背景模式下都能自动适配，不要写死 RGB。
 */
import { Button, HStack, Image, ProgressView, Spacer, SVG, Text, VStack } from "scripting"
import type { KeywordsColor } from "scripting"
import { RefreshPanelIntent } from "../app_intents"
import { MAGPIE_ICON } from "../core/icons"
import { ProviderIconView } from "./icon_view"
import { fmtPct, quotaColor, resetIn } from "../core/format"
import type { PanelCard, PanelGateway, PanelSnapshot, PanelWindow } from "../core/types"
import type { Metric } from "../core/types"

/** 主窗口：最紧张的那个有百分比的窗口 */
export function primaryWindow(card: PanelCard): PanelWindow | null {
  const shares = card.windows.filter(w => w.hasShare && !w.aside)
  if (shares.length) return shares.reduce((a, b) => (a.leftPct <= b.leftPct ? a : b))
  return card.windows.find(w => w.hasShare) ?? card.windows[0] ?? null
}

/** 按配置决定条上显示的数值：剩余还是已用 */
export function metricPct(w: PanelWindow, metric: Metric): number {
  return metric === "used" ? 100 - w.leftPct : w.leftPct
}

export function StatusDot({ ok, tint }: { ok: boolean; tint?: KeywordsColor }) {
  return (
    <Text font="caption2" foregroundStyle={tint ?? (ok ? "systemGreen" : "systemRed")}>
      ●
    </Text>
  )
}

/**
 * 供应商图标。magpie 给的可能是内置图标名、插件给的 http(s) 地址，或它自己抓的
 * favicon（`file:`，取不到）。解析顺序见 core/icons.ts：icon → provider id → 显示名，
 * 最后是 magpie 同款 generic 占位（见 widgets/icon_view.tsx）。
 */
export function ProviderIcon({ card, size = 11 }: { card: PanelCard; size?: number }) {
  return <ProviderIconView icon={card.icon} iconPath={card.iconPath} provider={card.provider} name={card.title} size={size} />
}

/** magpie 自己的喜鹊图标，和标题文字同高 */
export function MagpieIcon({ size = 12 }: { size?: number }) {
  if (!MAGPIE_ICON) return <StatusDot ok />
  return <SVG code={MAGPIE_ICON} resizable scaleToFit interpolation="high" frame={{ width: size, height: size }} />
}

export function Header(props: {
  snapshot: PanelSnapshot
  stale: boolean
  count: number
  clock: string
  title: string
  showTitleIcon: boolean
}) {
  const { snapshot, stale, count, clock, title, showTitleIcon } = props
  const broken = Boolean(snapshot.error)
  const tone: KeywordsColor = broken ? "systemRed" : stale ? "systemOrange" : "tertiaryLabel"
  return (
    <HStack spacing={4}>
      {showTitleIcon ? <MagpieIcon /> : <StatusDot ok={!broken && !stale} />}
      <Text font="caption2" bold lineLimit={1}>
        {title}
      </Text>
      <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
        {broken ? "离线" : `${count} 卡`}
      </Text>
      <Spacer />
      <Text font="caption2" foregroundStyle={tone} monospacedDigit lineLimit={1}>
        {stale ? `陈旧 ${clock}` : clock}
      </Text>
      <Button intent={RefreshPanelIntent(undefined)} buttonStyle="plain">
        <Image systemName="arrow.clockwise" font="caption2" foregroundStyle="secondaryLabel" />
      </Button>
    </HStack>
  )
}

/** 只给有百分比的窗口调用；无百分比的窗口由调用方跳过 */
export function QuotaBar({ window, metric }: { window: PanelWindow; metric: Metric }) {
  const value = metricPct(window, metric)
  return <ProgressView value={value} total={100} tint={quotaColor(window.leftPct)} />
}

/** 一行窗口：5 小时 ▓▓▓ 62% · 3h */
export function WindowLine(props: { window: PanelWindow; metric: Metric; now: number; showBar?: boolean }) {
  const { window, metric, now, showBar = true } = props
  const left = resetIn(window.resetsAt, now)
  const color = window.hasShare ? quotaColor(window.leftPct) : "secondaryLabel"
  return (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={4}>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          {window.label}
        </Text>
        <Spacer />
        <Text font="caption2" foregroundStyle={color} monospacedDigit lineLimit={1}>
          {window.hasShare ? fmtPct(metricPct(window, metric)) : window.text ?? "--"}
        </Text>
        {left ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" monospacedDigit lineLimit={1}>
            · {left}
          </Text>
        ) : null}
      </HStack>
      {showBar ? <QuotaBar window={window} metric={metric} /> : null}
    </VStack>
  )
}

/** 紧凑卡：图标 + 标题 + 主窗口百分比 + 条（小尺寸/中尺寸用） */
export function CompactCard(props: { card: PanelCard; metric: Metric; now: number; showIcons?: boolean }) {
  const { card, metric, now, showIcons = true } = props
  const win = primaryWindow(card)
  const icon = showIcons ? <ProviderIcon card={card} size={11} /> : null

  if (card.error && !win) {
    return (
      <VStack alignment="leading" spacing={1}>
        <HStack spacing={3}>
          {icon}
          <Text font="caption2" bold lineLimit={1}>
            {card.title}
          </Text>
        </HStack>
        <Text font="caption2" foregroundStyle="systemOrange" lineLimit={1}>
          读取失败
        </Text>
      </VStack>
    )
  }
  if (!win) {
    // 余额卡这类没有窗口的卡：直接把余额当数值显示，别浪费一行配额条
    if (card.balanceText) {
      return (
        <HStack spacing={4}>
          {icon}
          <Text font="caption2" bold lineLimit={1}>
            {card.title}
          </Text>
          <Spacer />
          <Text font="caption2" bold foregroundStyle="secondaryLabel" monospacedDigit lineLimit={1}>
            {card.balanceText}
          </Text>
        </HStack>
      )
    }
    return (
      <VStack alignment="leading" spacing={1}>
        <HStack spacing={3}>
          {icon}
          <Text font="caption2" bold lineLimit={1}>
            {card.title}
          </Text>
        </HStack>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          {card.subtitle || "—"}
        </Text>
      </VStack>
    )
  }

  const left = resetIn(win.resetsAt, now)
  const color = win.hasShare ? quotaColor(win.leftPct) : "secondaryLabel"
  return (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={3}>
        {icon}
        <Text font="caption2" bold lineLimit={1}>
          {card.title}
        </Text>
        {card.subtitle ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
            {card.subtitle}
          </Text>
        ) : null}
        <Spacer />
        <Text font="caption2" bold foregroundStyle={color} monospacedDigit lineLimit={1}>
          {win.hasShare ? fmtPct(metricPct(win, metric)) : win.text ?? "--"}
        </Text>
      </HStack>
      {win.hasShare ? <QuotaBar window={win} metric={metric} /> : null}
      <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1} monospacedDigit>
        {[win.label, left].filter(Boolean).join(" · ")}
      </Text>
    </VStack>
  )
}

/** 完整卡：图标 + 标题 + 最多 n 个窗口（大尺寸用） */
export function DetailCard(props: {
  card: PanelCard
  metric: Metric
  now: number
  maxWindows: number
  showIcons?: boolean
}) {
  const { card, metric, now, maxWindows, showIcons = true } = props
  const wins = card.windows.filter(w => w.hasShare || w.text).slice(0, maxWindows)
  return (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={4}>
        {showIcons ? <ProviderIcon card={card} size={12} /> : null}
        <Text font="caption" bold lineLimit={1}>
          {card.title}
        </Text>
        {card.subtitle ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
            {card.subtitle}
          </Text>
        ) : null}
        <Spacer />
        {!card.subtitle && card.kind === "balance" ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel">
            余额
          </Text>
        ) : null}
      </HStack>
      {card.error && !wins.length ? (
        <Text font="caption2" foregroundStyle="systemOrange" lineLimit={2}>
          {card.error}
        </Text>
      ) : null}
      {wins.map(w => (
        <WindowLine window={w} metric={metric} now={now} showBar={w.hasShare} />
      ))}
      {card.balanceText ? (
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          余额 {card.balanceText}
        </Text>
      ) : null}
    </VStack>
  )
}

/** 网关条：状态 + 地址 + 模型数 + key 限额 */
export function GatewayLine(props: { gateway: PanelGateway; now: number; compact?: boolean }) {
  const { gateway, now, compact } = props
  const left = resetIn(gateway.limitResetsAt ?? 0, now)
  if (compact) {
    return (
      <HStack spacing={4}>
        <StatusDot ok={gateway.ok} tint={gateway.ok ? "systemTeal" : "systemRed"} />
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
          {gateway.host}
        </Text>
        <Spacer />
        <Text font="caption2" foregroundStyle="tertiaryLabel" monospacedDigit lineLimit={1}>
          {gateway.limited && gateway.limitLeftPct !== undefined
            ? `额度余 ${fmtPct(gateway.limitLeftPct)}`
            : gateway.modelCount !== null
              ? `${gateway.modelCount} 模型`
              : "已连接"}
        </Text>
      </HStack>
    )
  }
  return (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={4}>
        <StatusDot ok={gateway.ok} />
        <Text font="caption2" bold lineLimit={1}>
          网关
        </Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1} monospacedDigit>
          {gateway.host}
        </Text>
        <Spacer />
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
          {gateway.modelCount !== null ? `${gateway.modelCount} 模型` : ""}
        </Text>
      </HStack>
      {gateway.limited ? (
        <HStack spacing={4}>
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>
            {gateway.keyName ? `key ${gateway.keyName}` : "key 限额"}
          </Text>
          <Spacer />
          <Text font="caption2" monospacedDigit foregroundStyle={quotaColor(gateway.limitLeftPct ?? 100)} lineLimit={1}>
            {gateway.limitText ?? ""}
          </Text>
          {left ? (
            <Text font="caption2" foregroundStyle="tertiaryLabel" monospacedDigit>
              · {left}
            </Text>
          ) : null}
        </HStack>
      ) : null}
      {gateway.error ? (
        <Text font="caption2" foregroundStyle="systemOrange" lineLimit={1}>
          {gateway.error}
        </Text>
      ) : null}
    </VStack>
  )
}

/** 没配置 / 读不到时的空态 */
export function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text font="caption" bold lineLimit={2}>
        {text}
      </Text>
      {sub ? (
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={3}>
          {sub}
        </Text>
      ) : null}
    </VStack>
  )
}
