/**
 * 请求层（H5 / mobileapi 通道）。
 *
 * 这一版不再需要任何签名：`app/login` 与 `doorcontrol/v2/*` 实测只要求
 * 正确的 body 与合法的 sessionId（拼在 query 上）。
 * 旧的网关签名逻辑保留一个开关（cfg.signMode === "header"），默认关闭。
 */
import {
  encryptBodyToBase64,
  randomNumber4,
  signHeader,
  signParams,
  timestampMillis,
} from "./crypto"
import { EP, H5_BASE, OPEN_BASE, SIGN_VERSION, type ApiConfig, type Endpoint } from "./protocol"
import type { Session } from "./session"

export class ApiError extends Error {
  code?: string
  raw?: any

  constructor(message: string, code?: string, raw?: any) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.raw = raw
  }
}

/** 会话失效：调用方应清会话并强制登出 */
export class SessionExpiredError extends ApiError {}

export type Envelope = {
  code: string
  message: string
  data: any
  raw: any
  success?: boolean
}

const SUCCESS_CODES = new Set(["0", "00", "0000", "200", "success", "SUCCESS", "ok"])

function unwrap(json: any): Envelope {
  if (json == null || typeof json !== "object") {
    throw new ApiError("响应不是 JSON 对象", undefined, json)
  }
  const rawCode = json.code ?? json.status ?? json.errcode ?? json.resultCode
  const code = rawCode == null ? "" : String(rawCode)
  const message = String(json.message ?? json.msg ?? json.errmsg ?? json.error ?? "")
  const data = json.data ?? json.result ?? json.res ?? null
  return { code, message, data, raw: json, success: json.success }
}

export function isSuccess(env: Envelope): boolean {
  if (typeof env.success === "boolean") return env.success
  return SUCCESS_CODES.has(env.code)
}

export type RequestTrace = { url: string; headers: Record<string, string>; body: string }

export type RequestOptions = {
  cfg: ApiConfig
  session?: Session | null
  headers?: Record<string, string>
  timeoutSec?: number
  onRequest?: (t: RequestTrace) => void
}

/** 解析额外请求头：JSON 或每行 `Key: Value` */
function parseExtraHeaders(raw: string): Record<string, string> {
  const text = (raw ?? "").trim()
  if (!text) return {}
  if (text.startsWith("{")) {
    try {
      const o = JSON.parse(text)
      const out: Record<string, string> = {}
      for (const k of Object.keys(o)) out[k] = String(o[k])
      return out
    } catch {
      return {}
    }
  }
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":")
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

function baseOf(ep: Endpoint, cfg: ApiConfig): string {
  // 双保险：旧配置里可能没有 openURL 字段
  if (ep.base === "openapi") return cfg.openURL || OPEN_BASE
  return cfg.baseURL || H5_BASE
}

export function buildUrl(
  ep: Endpoint,
  cfg: ApiConfig,
  sessionId?: string,
  extraQuery?: Record<string, string>
): string {
  const base = (baseOf(ep, cfg) || "").replace(/\/+$/, "")
  let url = base + "/" + ep.path.replace(/^\/+/, "")
  const qs: string[] = []
  if (ep.withSession && sessionId) qs.push("sessionId=" + encodeURIComponent(sessionId))
  for (const k of Object.keys(extraQuery ?? {})) {
    qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(extraQuery![k]))
  }
  if (qs.length) url += "?" + qs.join("&")
  return url
}

async function request(
  ep: Endpoint,
  body: Record<string, string>,
  opt: RequestOptions,
  extraQuery?: Record<string, string>
): Promise<Envelope> {
  const { cfg, session } = opt
  if (!baseOf(ep, cfg)) throw new ApiError("未配置接口地址（设置页填写后再试）")

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    ...parseExtraHeaders(cfg.extraHeaders),
    ...(opt.headers ?? {}),
  }

  // 仅当显式切回网关通道时才加签名，H5 通道不需要
  if (cfg.signMode === "header") {
    const ts = timestampMillis()
    const nonce = randomNumber4()
    const payload: Record<string, string> = { ...body, version: cfg.appVersion, timestamp: ts, nonce }
    payload.sign = signParams(payload, cfg)
    const h = { appid: cfg.appId, nonce, timestamp: ts, version: SIGN_VERSION }
    headers.appid = h.appid
    headers.nonce = h.nonce
    headers.timestamp = h.timestamp
    headers.version = h.version
    headers.sign = signHeader(h, cfg.headerSecret)
  }

  let text = JSON.stringify(body)
  if (cfg.encryptBody) {
    const cipher = encryptBodyToBase64(text, cfg)
    headers[cfg.aesHeaderName] = cipher
    text = JSON.stringify({ payload: cipher })
  }

  const url = buildUrl(ep, cfg, session?.sessionId, extraQuery)
  opt.onRequest?.({ url, headers, body: text })

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: text,
    timeout: opt.timeoutSec ?? 15,
  })

  if (res.status === 401) {
    throw new SessionExpiredError(`登录态已失效（401）｜${url}`, "401")
  }
  if (res.status === 403) {
    let hint = ""
    try {
      hint = (await res.text()).slice(0, 160)
    } catch {
      // ignore
    }
    throw new SessionExpiredError(`拒绝访问（403）：${hint}｜${url}`, "403", hint)
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}｜${url}`, String(res.status))
  }

  let json: any
  try {
    json = await res.json()
  } catch {
    throw new ApiError(`响应无法解析为 JSON｜${url}`)
  }

  const env = unwrap(json)
  // 业务层的 401（HTTP 200 + code 401）同样是会话失效
  if (!isSuccess(env) && /^(401|403)$/.test(env.code)) {
    throw new SessionExpiredError(env.message || "登录态已失效", env.code, env.raw)
  }
  return env
}

/* ---------------- 业务接口 ---------------- */

/**
 * 登录：POST app/login  body { mobile, smsCode }
 *
 * 实测：手机号 1234 → "手机号格式错误"；合法手机号 + smsCode → "验证码已经过期"。
 * 说明参数名就是 smsCode，且此接口**不需要签名**。
 *
 * 验证码必须在原 App 里获取（发码接口被 WAF 挡在网关通道）。
 */
export async function loginBySmsCode(
  mobile: string,
  smsCode: string,
  opt: RequestOptions
): Promise<{ sessionId: string; env: Envelope }> {
  // 手机号/验证码里混进空格或全角字符会导致服务端查不到记录（表现为"验证码已经过期"）
  const cleanMobile = mobile.replace(/\D/g, "")
  const cleanCode = smsCode.replace(/\D/g, "")
  const env = await request(EP.login, { mobile: cleanMobile, smsCode: cleanCode }, opt)
  if (!isSuccess(env)) {
    const msg = env.message || "登录失败"
    const hint = /过期|失效/.test(msg)
      ? `${msg}\n（短信验证码通常 5 分钟内有效，请在原 App 获取后立刻填写；` +
        `若刚获取仍报过期，说明该验证码不是 app/login 这条通道下发的）`
      : msg
    throw new ApiError(hint, env.code, env.raw)
  }
  const sid = pickSessionId(env)
  if (!sid) {
    throw new ApiError("登录成功但没解析出 sessionId，返回体：" + JSON.stringify(env.raw).slice(0, 200))
  }
  return { sessionId: sid, env }
}

/**
 * 用 userId 换 sessionId：POST h5/login?userId=xxx（openapi 通道，免验证码）。
 *
 * 实测返回：{"code":0,"data":{"expires":1800,"nickName":"…","sessionId":"h5:xxxx","status":1}}
 * expires 是秒数（1800 = 30 分钟），所以这不是永久会话，需要到期前用 userId 重新换。
 *
 * 注意：这个接口对任意已存在的 userId 都放行，属于对方系统的越权缺陷。
 * 只应填入**你自己账号**的 userId。
 */
export async function loginByUserId(
  userId: string,
  opt: RequestOptions
): Promise<{ sessionId: string; expires: number; nickName?: string }> {
  const env = await request(EP.loginByUserId, {}, opt, { userId })
  if (!isSuccess(env)) throw new ApiError(env.message || "userId 换会话失败", env.code, env.raw)
  const d = env.data ?? {}
  const sid = typeof d === "string" ? d : String(d.sessionId ?? "")
  if (!sid) throw new ApiError("接口未返回 sessionId：" + JSON.stringify(env.raw).slice(0, 200))
  return {
    sessionId: sid,
    expires: Number(d.expires) > 0 ? Number(d.expires) : 1800,
    nickName: typeof d.nickName === "string" ? d.nickName : undefined,
  }
}

/** sessionId 可能出现在 data 字符串、data.sessionId、raw.sessionId 等处 */
function pickSessionId(env: Envelope): string {  const d = env.data
  if (typeof d === "string" && d.length > 8) return d
  const cand = [d?.sessionId, d?.session_id, d?.sid, d?.token, env.raw?.sessionId, env.raw?.session_id]
  for (const c of cand) {
    if (typeof c === "string" && c) return c
  }
  return ""
}

/**
 * 门禁列表：POST doorcontrol/v2/queryUserDoor?sessionId=…&communityId=…
 *
 * 实测要点：
 * - sessionId 必须保留 `h5:` 前缀（去掉会 401）
 * - communityId **必须放 query**；放 body 会 500 NumberFormatException
 * - 返回 data.userDoorDTOS[] + data.commonlyUsedDoor
 */
export async function fetchUserDoors(opt: RequestOptions): Promise<RemoteDoor[]> {
  const { cfg } = opt
  if (!cfg.communityId) {
    throw new ApiError("缺少小区 ID（communityId）。在「接口地址」里填一次，例如 7829")
  }
  const env = await request(EP.doorList, {}, opt, { communityId: cfg.communityId })
  if (!isSuccess(env)) throw new ApiError(env.message || "获取门禁列表失败", env.code, env.raw)

  const data = env.data ?? {}
  const arr: any[] = Array.isArray(data) ? data : (data.userDoorDTOS ?? data.list ?? [])
  const common = data.commonlyUsedDoor

  const norm = (o: any, commonlyUsed = false): RemoteDoor | null => {
    const doorControlId = pickStr(o, ["doorControlId", "doorId", "id", "controlId"])
    if (!doorControlId) return null
    return {
      doorControlId,
      doorControlName:
        pickStr(o, ["doorControlName", "doorName", "name", "deviceName"]) ?? doorControlId,
      macAddress: pickStr(o, ["macAddress", "deviceMac", "mac"]),
      hasBluetoothModule: o?.hasBluetoothModule === true,
      online: pickStr(o, ["online"]),
      commonlyUsed,
    }
  }

  const list = arr.map(o => norm(o)).filter((d): d is RemoteDoor => d !== null)
  const c = common ? norm(common, true) : null
  if (c && !list.some(d => d.doorControlId === c.doorControlId)) list.unshift(c)
  return list
}

/**
 * 远程开门：POST doorcontrol/v2/open?sessionId=…&communityId=…&doorControlId=…&macAddress=…
 *
 * 实测（2026-10-22）：
 *   - 这四个参数**全部必须放在 query**，放 body 会返回「门禁编号和mac地址都为空」
 *   - 用无效 id/mac 探测的返回：{"code":0,"data":{"hasToAudited":0,"openDoorState":7}}
 *     说明接口本身不校验门是否存在，openDoorState 才是真实结果，需按返回值判断
 */
export async function openDoorRemote(
  door: { doorControlId: string; macAddress?: string },
  opt: RequestOptions
) {
  const { cfg } = opt
  const env = await request(EP.openDoor, {}, opt, {
    communityId: cfg.communityId,
    doorControlId: door.doorControlId,
    macAddress: door.macAddress ?? "",
  })
  if (!isSuccess(env)) throw new ApiError(env.message || "远程开门失败", env.code, env.raw)
  return env
}

export type RemoteDoor = {
  doorControlId: string
  doorControlName: string
  macAddress?: string
  /** 该门是否带蓝牙模块。注意 queryUserDoor 与 queryUserDoorByCache 给的值不一致 */
  hasBluetoothModule?: boolean
  /** 在线状态：online / offline（仅 queryUserDoorByCache 返回） */
  online?: string
  commonlyUsed?: boolean
}

function pickStr(o: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o?.[k]
    if (typeof v === "string" && v) return v
    if (typeof v === "number") return String(v)
  }
  return undefined
}
