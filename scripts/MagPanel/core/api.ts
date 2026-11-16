/**
 * magpie 网关客户端。
 *
 * 用到的三个端点（都在网关端口上，默认 3425）：
 *   GET /v1/magpie/quotas/cards  → {"data": [SubscriptionQuota]}  供应商余量卡
 *   GET /v1/magpie/limit         → {limited, key, limit, limits} 调用方 key 的限额
 *   GET /v1/models               → {"data": [...]}               可用模型数
 *
 * 鉴权：本机回环（同一台电脑）任何 token 都放行；跨机器必须带启用的网关
 * key，否则 401；magpie 没开「Share on local network」时远端一律 403。
 * 这两个 403/401 的文案差别很大，所以错误要分开说，别糊成"请求失败"。
 */
import { fetch } from "scripting"
import type { PanelConfig, WireCard, WireLimit } from "./types"

export const WIDGET_TIMEOUT_MS = 6000
export const APP_TIMEOUT_MS = 10000

export class PanelRequestError extends Error {
  status: number
  hint: string

  constructor(message: string, status = 0, hint = "") {
    super(message)
    this.name = "PanelRequestError"
    this.status = status
    this.hint = hint
  }
}

/** 补全协议、去掉尾部斜杠；空串表示没配 */
export function normalizeBaseURL(raw: string): string {
  let base = (raw || "").trim()
  if (!base) return ""
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`
  return base.replace(/\/+$/, "")
}

/** http://127.0.0.1:3425 → 127.0.0.1:3425 */
export function displayHost(baseURL: string): string {
  return normalizeBaseURL(baseURL).replace(/^https?:\/\//i, "")
}

export function isLoopback(baseURL: string): boolean {
  const host = displayHost(baseURL).split(":")[0].toLowerCase()
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]"
}

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" }
  const key = (token || "").trim()
  if (key) {
    headers.Authorization = `Bearer ${key}`
    headers["x-api-key"] = key
  }
  return headers
}

function hintForStatus(status: number, path: string): string {
  switch (status) {
    case 401:
      return "key 没被接受：填一个已启用的网关 key（magpie 的 Gateway keys 页可复制）"
    case 403:
      return "被拒绝：跨机器访问需要在 magpie 打开「Share on local network」，且该 key 有读取配额/管理权限"
    case 404:
      return `网关没有 ${path}：magpie 版本过旧，或地址指向了别的服务`
    case 429:
      return "这个 key 已超出限额，等窗口重置"
    default:
      return status >= 500 ? "网关内部错误，看一眼 magpie 的日志" : "请求被拒绝"
  }
}

/** magpie 的错误体形如 {"error":{"code":"gateway_key_held","message":"…"}}，码比状态码说得更具体 */
function errorCodeOf(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown } }
    const code = parsed?.error?.code
    return typeof code === "string" ? code : ""
  } catch {
    return ""
  }
}

function hintForError(status: number, path: string, body: string): string {
  switch (errorCodeOf(body)) {
    case "gateway_key_held":
      return "这个 key 被限制在预算/模型/账号上，读不到账号的配额卡；在 magpie 的 Gateway keys 里给它打开 Quotas"
    case "gateway_key_read_only":
      return "这个 key 是只读 key：配额能读，不能用；换一个完整权限的 key"
    case "gateway_key_limit":
      return "这个 key 本轮额度已用满，等它重置"
    default:
      return hintForStatus(status, path)
  }
}

async function getJSON<T>(cfg: PanelConfig, path: string, timeoutMs: number): Promise<T> {
  const base = normalizeBaseURL(cfg.baseURL)
  if (!base) throw new PanelRequestError("还没填网关地址", 0, "在 MagPanel 里填 http://<主机>:3425")
  const url = `${base}${path}`
  let res: Awaited<ReturnType<typeof fetch>>
  try {
    res = await fetch(url, { method: "GET", headers: authHeaders(cfg.token), timeout: timeoutMs })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new PanelRequestError(
      `连不上 ${displayHost(base)}`,
      0,
      isLoopback(base)
        ? `本机地址失败（${msg}）：确认 magpie 正在运行，或把地址改成局域网 IP`
        : `网络不可达（${msg}）：确认手机和 magpie 在同一网段，地址带端口 3425`
    )
  }
  if (res.status < 200 || res.status >= 300) {
    let body = ""
    try {
      body = (await res.text()).slice(0, 400)
    } catch {
      body = ""
    }
    throw new PanelRequestError(`HTTP ${res.status}｜${path}`, res.status, hintForError(res.status, path, body))
  }
  let text = ""
  try {
    text = await res.text()
  } catch {
    throw new PanelRequestError("读取响应失败", res.status, "网关返回了空响应")
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PanelRequestError(
      "响应不是 JSON",
      res.status,
      `可能被代理/登录页拦截了：${text.slice(0, 80).replace(/\s+/g, " ")}`
    )
  }
}

/** 供应商余量卡；magpie 用 {"data": [...]} 包一层 */
export async function fetchCards(cfg: PanelConfig, timeoutMs = WIDGET_TIMEOUT_MS): Promise<WireCard[]> {
  const body = await getJSON<{ data?: WireCard[] }>(cfg, "/v1/magpie/quotas/cards", timeoutMs)
  if (!body || !Array.isArray(body.data)) {
    throw new PanelRequestError("配额响应缺少 data 数组", 200, "magpie 版本可能过旧，没有 /v1/magpie/quotas/cards")
  }
  return body.data
}

/** 调用方 key 的限额；未设限额时 limited=false */
export async function fetchLimit(cfg: PanelConfig, timeoutMs = WIDGET_TIMEOUT_MS): Promise<WireLimit | null> {
  try {
    return await getJSON<WireLimit>(cfg, "/v1/magpie/limit", timeoutMs)
  } catch {
    // 网关信息是附加项，拿不到不该拖垮整块面板
    return null
  }
}

/** 可用模型数；拿不到返回 null */
export async function fetchModelCount(cfg: PanelConfig, timeoutMs = WIDGET_TIMEOUT_MS): Promise<number | null> {
  try {
    const body = await getJSON<{ data?: unknown[] }>(cfg, "/v1/models", timeoutMs)
    return Array.isArray(body?.data) ? body.data.length : null
  } catch {
    return null
  }
}

/** 配置页的"测试连接"：只关心能不能读到、读到几张卡 */
export async function probeConfig(cfg: PanelConfig): Promise<string> {
  const cards = await fetchCards(cfg, APP_TIMEOUT_MS)
  const limit = await fetchLimit(cfg, APP_TIMEOUT_MS)
  const parts = [`连通正常，${cards.length} 张配额卡`]
  if (limit?.limited) parts.push(`key「${limit.key ?? "?"}」有限额`)
  else parts.push("key 无额度限制")
  return parts.join(" · ")
}
