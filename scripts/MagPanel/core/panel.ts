/**
 * 把网关的原始 JSON 收敛成小组件能直接画的数据。
 *
 * 关键换算：
 *   magpie 的 window.used 是"已用百分比"（0-100），小组件主打"余量"，
 *   所以 leftPct = 100 - used。纯文本行（积分、钱包）没有百分比，不能当 0% 画。
 */
import { fetchCards, fetchLimit, fetchModelCount, displayHost, PanelRequestError, WIDGET_TIMEOUT_MS } from "./api"
import { clamp, fmtMoney, fmtTokens, providerShort, windowLabel } from "./format"
import { cacheCardIcons } from "./icon_cache"
import type {
  PanelCard,
  PanelConfig,
  PanelGateway,
  PanelSnapshot,
  PanelWindow,
  WireCard,
  WireLimit,
  WireLimitPart,
  WireWindow,
} from "./types"

function parseTime(raw?: string): number {
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : 0
}

function toWindow(w: WireWindow, index: number): PanelWindow | null {
  const label = windowLabel(String(w.name ?? w.lane ?? ""))
  const resetsAt = parseTime(w.resetsAt)
  const unlimited = w.unlimited === true
  const used = typeof w.used === "number" && Number.isFinite(w.used) ? w.used : null

  if (w.text) {
    const text = String(w.display ?? "").trim()
    if (!text) return null
    return {
      key: `${label}-${index}`,
      label,
      leftPct: 0,
      hasShare: false,
      unlimited: false,
      text,
      resetsAt,
      aside: true,
    }
  }
  if (unlimited) {
    return {
      key: `${label}-${index}`,
      label,
      leftPct: 100,
      hasShare: false,
      unlimited: true,
      text: "无限",
      resetsAt,
      aside: true,
    }
  }
  if (used === null) {
    // 只有余额数字的钱包窗口（balance 字段），当作文本行
    if (typeof w.balance === "number") {
      const unit = w.unit ? ` ${w.unit}` : ""
      return {
        key: `${label}-${index}`,
        label,
        leftPct: 0,
        hasShare: false,
        unlimited: false,
        text: `${fmtTokens(w.balance)}${unit}`,
        resetsAt,
        aside: true,
      }
    }
    return null
  }
  return {
    key: `${label}-${index}`,
    label,
    leftPct: clamp(100 - used, 0, 100),
    hasShare: true,
    unlimited: false,
    resetsAt,
    aside: w.extra === true,
  }
}

function cardKind(card: WireCard): PanelCard["kind"] {
  if (card.kind === "plan" || card.kind === "balance") return card.kind
  if (card.kind === "subscription") return "subscription"
  if (typeof card.balance === "string" && card.balance.trim()) return "balance"
  return "subscription"
}

/**
 * 分池 credits：WorkBuddy 的 Credits / Extra credits，Qoder 的 Add-on / Dedicated /
 * Shared credits 都是"Total credits"的组成部分。magpie 的 Aside 字段带 `json:"-"`
 * 不下发，所以只能按窗口名判断。
 */
const CREDIT_POOL_NAMES = new Set([
  "credits",
  "extra credits",
  "add-on credits",
  "dedicated credits",
  "shared credits",
])

function normWindowName(name?: string): string {
  return String(name ?? "").trim().toLowerCase()
}

/** 这张卡有没有"合计"窗口（Total credits）本身就是一个真实读数 */
function hasCreditWhole(card: WireCard): boolean {
  return (card.windows ?? []).some(
    w => normWindowName(w?.name) === "total credits" && !w.text && typeof w.used === "number"
  )
}

export function toPanelCard(card: WireCard): PanelCard {
  const provider = String(card.provider ?? "")
  const kind = cardKind(card)
  // 有 Total credits 时，Credits / Extra credits 这些分池只是它的拆解，不重复占行
  const mergeCreditPools = hasCreditWhole(card)
  const windows = (card.windows ?? [])
    .filter(w => !mergeCreditPools || !CREDIT_POOL_NAMES.has(normWindowName(w?.name)))
    .map((w, i) => toWindow(w ?? {}, i))
    .filter((w): w is PanelWindow => w !== null)

  const shares = windows.filter(w => w.hasShare && !w.aside)
  const worst = shares.length ? Math.min(...shares.map(w => w.leftPct)) : 101

  const subtitleParts: string[] = []
  const plan = String(card.plan ?? "").trim()
  const account = String(card.alias ?? card.user ?? "").trim()
  if (plan) subtitleParts.push(plan)
  if (account) subtitleParts.push(account)
  if (card.from) subtitleParts.push(`经 ${card.from}`)

  return {
    id: `${provider}|${account}|${kind}`,
    provider,
    title: providerShort(provider, String(card.name ?? "").trim()),
    icon: String(card.icon ?? "").trim(),
    subtitle: subtitleParts.join(" · "),
    kind,
    windows,
    balanceText: typeof card.balance === "string" ? card.balance.trim() : undefined,
    error: card.error ? String(card.error) : undefined,
    worst,
  }
}

function periodLabel(l: WireLimitPart): string {
  switch (l.period) {
    case "day":
      return "今日"
    case "week":
      return "本周"
    case "month":
      return "本月"
    case "total":
      return "总计"
    case "days":
      return `${l.days ?? 0}天周期`
    case "hours":
      return `${l.hours ?? 0}小时周期`
    case "account":
      return "账号窗口"
    default:
      return ""
  }
}

/** 限额 → 一行文案 + 剩余百分比（取最小的那个 cap） */
export function toGateway(limit: WireLimit | null, modelCount: number | null, cfg: PanelConfig): PanelGateway {
  const base: PanelGateway = {
    ok: limit !== null,
    host: displayHost(cfg.baseURL),
    keyName: String(limit?.key ?? "").trim(),
    modelCount,
    limited: false,
  }
  if (!limit) return { ...base, ok: false, error: "网关信息读取失败" }
  if (!limit.limited) return { ...base, ok: true, limitText: undefined }

  const part = limit.limit ?? limit.limits?.[0]
  if (!part) return { ...base, ok: true }

  const bits: string[] = []
  const shares: number[] = []
  if (typeof part.tokenLimit === "number" && part.tokenLimit > 0) {
    bits.push(`${fmtTokens(part.tokens ?? 0)}/${fmtTokens(part.tokenLimit)} 令牌`)
    shares.push(clamp(((part.tokensLeft ?? part.tokenLimit - (part.tokens ?? 0)) / part.tokenLimit) * 100, 0, 100))
  }
  if (typeof part.costLimit === "number" && part.costLimit > 0) {
    bits.push(`${fmtMoney(part.cost ?? 0)}/${fmtMoney(part.costLimit)}`)
    shares.push(clamp(((part.costLeft ?? part.costLimit - (part.cost ?? 0)) / part.costLimit) * 100, 0, 100))
  }
  const where = periodLabel(part)
  const limitText = bits.length ? `${where}${where ? " " : ""}${bits.join(" · ")}` : undefined

  return {
    ...base,
    ok: true,
    limited: true,
    limitText,
    limitLeftPct: shares.length ? Math.min(...shares) : undefined,
    limitResetsAt: parseTime(part.reset),
  }
}

function splitFilter(raw: string): string[] {
  return (raw || "")
    .split(/[,，\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function filterCards(cards: PanelCard[], cfg: PanelConfig): PanelCard[] {
  const wants = splitFilter(cfg.providerFilter)
  let out = cards.filter(card => {
    if (!cfg.showAuxCards && card.kind !== "subscription") return false
    if (!cfg.showAuxWindows) {
      // 只保留有百分比条或有错误提示的卡，纯文本行（积分/钱包）按开关隐藏
      const usable = card.windows.some(w => w.hasShare || w.unlimited)
      if (!usable && !card.error && !card.balanceText) return false
    }
    if (wants.length) {
      const hay = `${card.provider} ${card.title}`.toLowerCase()
      if (!wants.some(w => hay.includes(w))) return false
    }
    return true
  })
  if (cfg.sort === "urgent") {
    out = [...out].sort((a, b) => {
      if (a.error && !b.error) return 1
      if (b.error && !a.error) return -1
      return a.worst - b.worst
    })
  }
  return out
}

/** 按配置抹掉不该出现在屏幕上的信息：账户/套餐副标题（邮箱、plan 名） */
export function applyDisplay(cards: PanelCard[], cfg: PanelConfig): PanelCard[] {
  if (cfg.showAccount) return cards
  return cards.map(card => (card.subtitle ? { ...card, subtitle: "" } : card))
}

/** 小组件实际要画的卡（按配置过滤 + 抹掉账户信息 + 截断） */
export function pickCards(snap: PanelSnapshot, cfg: PanelConfig, max?: number): PanelCard[] {
  return applyDisplay(filterCards(snap.cards, cfg), cfg).slice(0, max ?? cfg.maxCards)
}

export function isFresh(snap: PanelSnapshot | null, cfg: PanelConfig, now: number): boolean {
  if (!snap) return false
  return now - snap.fetchedAt < Math.max(1, cfg.refreshMinutes) * 60 * 1000
}

/** 拉一次完整面板并落盘 */
export async function buildSnapshot(cfg: PanelConfig, timeoutMs = WIDGET_TIMEOUT_MS): Promise<PanelSnapshot> {
  const snapshot: PanelSnapshot = { fetchedAt: Date.now(), cards: [], gateway: null }

  const gatewayPromise = cfg.showGateway
    ? Promise.all([fetchLimit(cfg, timeoutMs), fetchModelCount(cfg, timeoutMs)])
    : Promise.resolve(null)

  try {
    const wire = await fetchCards(cfg, timeoutMs)
    snapshot.cards = wire.map(toPanelCard)
    // 自建 provider 的图标只挂在 magpie 网页端，顺手拉一次落盘
    const icons = await cacheCardIcons(cfg, snapshot.cards)
    if (icons.failed > 0) {
      snapshot.iconNote = `${icons.failed} 个图标取不到（${icons.error || "未知原因"}）`
    }
  } catch (e) {
    snapshot.error = e instanceof PanelRequestError ? `${e.message}｜${e.hint}` : e instanceof Error ? e.message : String(e)
  }

  const gateway = await gatewayPromise
  if (gateway) {
    const [limit, modelCount] = gateway
    snapshot.gateway = toGateway(limit, modelCount, cfg)
    if (!snapshot.error && snapshot.gateway && !snapshot.gateway.ok) {
      snapshot.gateway.error = "限额信息读取失败（可能该 key 无管理权限）"
    }
  }

  snapshot.fetchedAt = Date.now()
  return snapshot
}
