/**
 * 请求层。
 *
 * 只做三件事：拼公共参数、签名、解包。
 * 主机名/签名顺序/响应外壳都是 UNKNOWN，集中在 config 与本文件，便于实测后单点修正。
 */
import { encryptBodyToBase64, signParams } from "./crypto"
import { EP, type ApiConfig } from "./protocol"
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
}

const SUCCESS_CODES = new Set(["0", "00", "0000", "200", "success", "SUCCESS", "ok"])

/**
 * 响应外壳在静态分析里只能看到字段名（code / data / res / openDoorState），
 * 没有看到完整包体，因此这里对常见外壳做兼容解析。
 */
function unwrap(json: any): Envelope {
  if (json == null || typeof json !== "object") {
    throw new ApiError("响应不是 JSON 对象", undefined, json)
  }
  const rawCode = json.code ?? json.status ?? json.errcode ?? json.errCode ?? json.resultCode
  const code = rawCode == null ? "" : String(rawCode)
  const message = String(json.message ?? json.msg ?? json.errmsg ?? json.error ?? "")
  const data = json.data ?? json.result ?? json.res ?? json.content ?? null
  return { code, message, data, raw: json }
}

export function isSuccess(env: Envelope): boolean {
  return SUCCESS_CODES.has(env.code) || env.code === ""
}

function nonce(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export type RequestOptions = {
  cfg: ApiConfig
  session?: Session | null
  /** 额外 header，例如 Cookie */
  headers?: Record<string, string>
  timeoutSec?: number
}

async function post(path: string, params: Record<string, string>, opt: RequestOptions): Promise<Envelope> {
  const { cfg, session } = opt
  if (!cfg.baseURL) throw new ApiError("未配置 baseURL（设置页填写后再试）")

  const payload: Record<string, string> = {
    ...params,
    appId: cfg.appId,
    channel: cfg.channel,
    version: cfg.appVersion,
    timestamp: String(Date.now()),
    nonce: nonce(),
  }
  if (session?.token) payload.token = session.token
  if (session?.sessionId) payload.sessionId = session.sessionId
  if (cfg.signMode === "md5") payload.sign = signParams(payload, cfg)

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    ...(opt.headers ?? {}),
  }

  let body = JSON.stringify(payload)
  if (cfg.encryptBody) {
    const cipher = encryptBodyToBase64(body, cfg)
    // UNKNOWN：密文放 header 还是 body 未验证。header 名来自字符串 "AesHeader"。
    headers[cfg.aesHeaderName] = cipher
    body = JSON.stringify({ payload: cipher })
  }

  const url = cfg.baseURL.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "")
  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    timeout: opt.timeoutSec ?? 15,
  })

  if (res.status === 401 || res.status === 403) {
    throw new SessionExpiredError("登录态已失效", String(res.status))
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, String(res.status))
  }

  let json: any
  try {
    json = await res.json()
  } catch {
    throw new ApiError("响应无法解析为 JSON")
  }

  const env = unwrap(json)
  if (/401|token|login|expire|invalid/i.test(env.code + env.message) && !isSuccess(env)) {
    throw new SessionExpiredError(env.message || "登录态已失效", env.code, env.raw)
  }
  return env
}

/* ---------------- 具体业务接口 ---------------- */

/** 发送短信验证码：对应 interfaceSendValidCode（参数 mobile） */
export async function sendValidCode(mobile: string, opt: RequestOptions) {
  return post(EP.sendValidCode, { mobile }, opt)
}

/** 验证码登录：对应 app/api/app/v1/login（参数 mobile + validCode） */
export async function loginByCode(mobile: string, validCode: string, opt: RequestOptions) {
  const env = await post(EP.login, { mobile, validCode }, opt)
  if (!isSuccess(env)) throw new ApiError(env.message || "登录失败", env.code, env.raw)
  return env
}

/** 登录态检查：保活心跳 */
export async function checkLogin(opt: RequestOptions) {
  return post(EP.checkLogin, {}, opt)
}

export async function logout(opt: RequestOptions) {
  return post(EP.logout, {}, opt)
}

/**
 * 远程开门：open/doorcontrol/v2/open
 * 响应字段来自分析：data.code / data.res / data.openDoorState / data.doorControlName
 */
export async function openDoorRemote(doorControlId: string, opt: RequestOptions) {
  const env = await post(EP.openDoor, { doorControlId }, opt)
  if (!isSuccess(env)) throw new ApiError(env.message || "远程开门失败", env.code, env.raw)
  return env
}
