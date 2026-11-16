/**
 * 类型分三层：
 *   Wire*  —— magpie 网关原样返回的 JSON（只声明用到的字段，其余忽略）
 *   Panel* —— 小组件/配置页共用的视图模型（已算好剩余百分比、重置倒计时）
 *   PanelConfig —— 主 App 里可配置的项，存在 App Group 容器里
 */

// ── magpie API 原始结构 ────────────────────────────────────────────────────

/** GET /v1/magpie/quotas/cards → data[] 里的一张配额卡的一个窗口 */
export type WireWindow = {
  unlimited?: boolean
  name?: string
  /** 已用百分比 0-100 */
  used?: number
  resetsAt?: string
  resetSecs?: number
  display?: string
  /** 纯文本行（积分、钱包），used 不是读数 */
  text?: boolean
  lane?: string
  amount?: number
  limit?: number
  unit?: string
  balance?: number
  spent?: number
  family?: string
  pool?: string
  credits?: boolean
  extra?: boolean
  heldBy?: string
  holdsWhy?: string
  startsAt?: string
}

/** 一张配额卡：一个订阅账号、一个 key 套餐或一个 key 余额 */
export type WireCard = {
  provider?: string
  name?: string
  /** 内置图标名（claude-color / magpie）或 file:<hash>.<ext> */
  icon?: string
  plan?: string
  user?: string
  alias?: string
  kind?: string
  from?: string
  windows?: WireWindow[]
  /** API key 余额（字符串，可能是 "$12.34" 或多段） */
  balance?: string
  error?: string
  asOf?: string
  readAt?: string
  held?: boolean
}

/** GET /v1/magpie/limit → limits[] 里的一项 */
export type WireLimitPart = {
  period?: string
  days?: number
  hours?: number
  calls?: number
  tokens?: number
  cost?: number
  tokenLimit?: number
  costLimit?: number
  tokensLeft?: number
  costLeft?: number
  spent?: boolean
  start?: string
  reset?: string
  models?: string[]
}

export type WireLimit = {
  limited?: boolean
  key?: string
  limit?: WireLimitPart
  limits?: WireLimitPart[]
}

// ── 视图模型 ──────────────────────────────────────────────────────────────

export type PanelWindow = {
  key: string
  /** 展示名：5 小时 / 7 天 / 额度 */
  label: string
  /** 剩余百分比 0-100；hasShare=false 时无意义 */
  leftPct: number
  hasShare: boolean
  unlimited: boolean
  /** 纯文本行（积分、钱包余额） */
  text?: string
  /** 重置时刻（ms），0 表示未知 */
  resetsAt: number
  /** 额外用量：用尽也不阻断账号 */
  aside: boolean
}

export type PanelCard = {
  id: string
  /** provider id，可能带远程前缀：codex / office/codex */
  provider: string
  /** 供应商短名：Claude / Codex … */
  title: string
  /** magpie 给的图标名（claude-color / magpie / file:<hash>.<ext>），空串表示没有 */
  icon: string
  /** 已缓存到本机的图标文件（file: 图标从 magpie 网页端下载后落盘），没有就是空 */
  iconPath?: string
  /** 套餐或账号 */
  subtitle: string
  kind: "subscription" | "plan" | "balance"
  windows: PanelWindow[]
  balanceText?: string
  error?: string
  /** 该卡最紧张的窗口剩余百分比，用于排序与配色 */
  worst: number
}

export type PanelGateway = {
  ok: boolean
  /** 展示用地址：127.0.0.1:3425 */
  host: string
  keyName: string
  modelCount: number | null
  limited: boolean
  limitText?: string
  /** 该限额窗口的剩余百分比 0-100 */
  limitLeftPct?: number
  /** 重置时刻（ms） */
  limitResetsAt?: number
  error?: string
}

export type PanelSnapshot = {
  fetchedAt: number
  cards: PanelCard[]
  gateway: PanelGateway | null
  /** 整体失败原因（连不上、key 被拒…），部分失败放在各卡 error 里 */
  error?: string
  /** 图标缓存的情况（部分取不到时提示用） */
  iconNote?: string
}

// ── 配置 ─────────────────────────────────────────────────────────────────

export type Metric = "left" | "used"
export type SortMode = "urgent" | "source"

export type PanelConfig = {
  baseURL: string
  /** 网关 key；本机回环可以留空 */
  token: string
  showGateway: boolean
  /** 供应商图标（内置 SVG）；关掉只剩文字，万一某个系统上 SVG 画不出来可以关 */
  showIcons: boolean
  /** 卡片的套餐/账号副标题（如 Max · me@example.com）是否显示 */
  showAccount: boolean
  /** 余额卡、套餐卡是否显示 */
  showAuxCards: boolean
  /** 额外用量 / 积分这类文本行是否显示 */
  showAuxWindows: boolean
  metric: Metric
  sort: SortMode
  /** 小组件里最多显示几张卡 */
  maxCards: number
  /** 小组件刷新间隔（分钟） */
  refreshMinutes: number
  /** 只看这些供应商，逗号分隔；空 = 全部 */
  providerFilter: string
  /**
   * 图标来源（magpie 网页端）。留空 = 自动取网关主机 + 3430 端口。
   * magpie 的自建 provider 图标（favicon）只存在它本机，网关不提供，只有网页端
   * 的 /api/icons/<name> 能取到，而网页端需要 key。
   */
  iconBaseURL: string
  /** magpie web 的 key（链接里的 k=，或 MAGPIE_WEB_KEY）；留空就不带 */
  iconKey: string
}
