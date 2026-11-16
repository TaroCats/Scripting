/**
 * 纯展示层工具：百分比、倒计时、数字缩写、供应商短名、配色。
 * 不依赖 Scripting 运行时，主 App 与小组件共用。
 */
import type { KeywordsColor } from "scripting"

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

/** 剩余百分比取整，带百分号 */
export function fmtPct(n: number): string {
  return `${Math.round(clamp(n, 0, 100))}%`
}

/** 百分比数值取整（供 Gauge 之类使用） */
export function pctValue(n: number): number {
  return Math.round(clamp(n, 0, 100))
}

/** 1234 → 1.2k，1234567 → 1.2M，5000000 → 5M */
export function fmtTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0"
  if (n < 1000) return String(Math.round(n))
  const unit = n < 1000 * 1000 ? [n / 1000, "k"] : [n / (1000 * 1000), "M"]
  const value = unit[0] as number
  const text = value < 10 ? value.toFixed(1) : String(Math.round(value))
  return `${text.endsWith(".0") ? text.slice(0, -2) : text}${unit[1]}`
}

export function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0"
  if (n >= 100) return `$${Math.round(n)}`
  return `$${n.toFixed(2)}`
}

/** 毫秒 → 3h12m / 2d4h / 45m / 即将 */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms)) return ""
  if (ms <= 0) return "即将"
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "即将"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) {
    const m = mins % 60
    return m > 0 && hours < 10 ? `${hours}h${m}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const h = hours % 24
  return h > 0 && days < 10 ? `${days}d${h}h` : `${days}d`
}

/** 重置时刻 → 倒计时文案；未知返回 "" */
export function resetIn(resetsAt: number, now: number): string {
  if (!resetsAt) return ""
  return fmtDuration(resetsAt - now)
}

/** 17:03 */
export function fmtClock(ts: number): string {
  if (!ts) return "--:--"
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 3 分钟前 / 2 小时前 */
export function fmtAgo(ts: number, now: number): string {
  if (!ts) return "还没刷新"
  const mins = Math.floor((now - ts) / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/** 剩余越少越危险：红 / 橙 / 绿（都用语义色，随深浅色自动切换） */
export function quotaColor(leftPct: number): KeywordsColor {
  if (leftPct <= 10) return "systemRed"
  if (leftPct <= 30) return "systemOrange"
  return "systemGreen"
}

const PROVIDER_SHORT: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  "chatgpt-api": "ChatGPT",
  copilot: "Copilot",
  gemini: "Gemini",
  antigravity: "AntiGrav",
  kimi: "Kimi",
  moonshot: "Kimi",
  glm: "GLM",
  zhipu: "GLM",
  zcode: "ZCode",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  dashscope: "Qwen",
  minimax: "MiniMax",
  stepfun: "StepFun",
  openrouter: "OpenRouter",
  siliconflow: "Silicon",
  groq: "Groq",
  mistral: "Mistral",
  xai: "Grok",
  grok: "Grok",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  cursor: "Cursor",
  kiro: "Kiro",
  workbuddy: "WorkBuddy",
  trae: "Trae",
  factory: "Factory",
  devin: "Devin",
  zed: "Zed",
  mimo: "MiMo",
  qoder: "Qoder",
  ark: "方舟",
  volcengine: "火山",
  hunyuan: "混元",
  baidu: "千帆",
  tencent: "腾讯云",
  huawei: "华为云",
  longcat: "LongCat",
  vertex: "Vertex",
  bedrock: "Bedrock",
  openai: "OpenAI",
  anthropic: "Anthropic",
}

/** 供应商短名：取 provider id 最后一段查表，查不到用原 name */
export function providerShort(provider: string, fallback = ""): string {
  const id = (provider || "").split("/").pop() || ""
  return PROVIDER_SHORT[id.toLowerCase()] || fallback || id || "magpie"
}

const WINDOW_LABELS: Record<string, string> = {
  allowance: "额度",
  "chat requests": "对话",
  completions: "补全",
  "premium requests": "高级请求",
  month: "月",
  weekly: "周",
  week: "周",
  daily: "日",
  day: "日",
}

/** 窗口名中文化：5 hours → 5 小时 */
export function windowLabel(name: string): string {
  const raw = (name || "").trim()
  if (!raw) return "额度"
  const key = raw.toLowerCase()
  if (WINDOW_LABELS[key]) return WINDOW_LABELS[key]
  const hours = key.match(/^(\d+)\s*hours?$/)
  if (hours) return `${hours[1]} 小时`
  const days = key.match(/^(\d+)\s*days?$/)
  if (days) return `${days[1]} 天`
  const mins = key.match(/^(\d+)\s*minutes?$/)
  if (mins) return `${mins[1]} 分钟`
  return raw
}
