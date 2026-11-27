import { fetch } from "scripting"
import {
  clearCloudreveToken,
  loadCloudreveConfig,
  saveCloudreveEndpoint,
  saveCloudreveToken,
} from "./config"
import type { CloudFolder, CloudreveToken, DownloadTask } from "./types"

type CloudreveReply<T> = {
  code?: number
  msg?: string
  data?: T
  error?: string
}

type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

function apiUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/api/v4${path}`
}

function parseExpiry(value: unknown, fallbackHours: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Date.parse(String(value ?? ""))
  return Number.isFinite(parsed)
    ? parsed
    : Date.now() + fallbackHours * 60 * 60 * 1000
}

function toToken(data: any): CloudreveToken {
  return {
    accessToken: String(data?.access_token || ""),
    refreshToken: String(data?.refresh_token || ""),
    accessExpires: parseExpiry(data?.access_expires, 6),
    refreshExpires: parseExpiry(data?.refresh_expires, 24 * 30),
  }
}

async function request<T>(
  path: string,
  init: RequestOptions = {},
  accessToken?: string,
): Promise<T> {
  const config = loadCloudreveConfig()
  if (!config.baseUrl) throw new Error("请先填写 Cloudreve 站点地址")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(apiUrl(config.baseUrl, path), {
    ...init,
    headers,
  })
  if (!response.ok) {
    const error = new Error(`Cloudreve HTTP ${response.status}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  const reply = (await response.json()) as CloudreveReply<T>
  if (reply.code === 203) {
    throw new Error("该账号启用了两步验证，请用 OAuth 应用授权代替密码登录")
  }
  if (reply.code === 40026 || reply.code === 40027) {
    throw new Error("站点要求图形验证码，请先在网页登录后改用 OAuth 授权")
  }
  if (reply.code !== 0) {
    throw new Error(reply.msg || reply.error || `Cloudreve 错误 ${reply.code ?? ""}`)
  }
  return reply.data as T
}

/** Login with email + password; Cloudreve v4 returns access + refresh tokens. */
export async function cloudreveLogin(
  baseUrl: string,
  email: string,
  password: string,
  dst: string,
): Promise<CloudreveToken> {
  if (!/^https?:\/\//i.test(baseUrl.trim())) {
    throw new Error("Cloudreve 地址必须以 http:// 或 https:// 开头")
  }
  if (!email.trim() || !password) throw new Error("请填写邮箱和密码")
  // request() reads the endpoint from storage, so persist it before signing in.
  saveCloudreveEndpoint(baseUrl, email, dst)
  const data = await request<any>("/session/token", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  })
  const token = toToken(data?.token)
  if (!token.accessToken || !token.refreshToken) {
    throw new Error("登录响应中没有令牌，请确认这是 Cloudreve v4 站点")
  }
  saveCloudreveToken(token)
  return token
}

let refreshing: Promise<CloudreveToken> | null = null

/** Password sign-in and refresh both rotate the refresh token; always persist the new pair. */
export async function cloudreveRefresh(): Promise<CloudreveToken> {
  const current = loadCloudreveConfig().token
  if (!current?.refreshToken) {
    throw new Error("Cloudreve 尚未登录")
  }
  if (Date.now() >= current.refreshExpires) {
    clearCloudreveToken()
    throw new Error("Cloudreve 登录已过期，请重新登录")
  }
  if (!refreshing) {
    refreshing = (async () => {
      const data = await request<any>("/session/token/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      })
      const token = toToken(data)
      if (!token.accessToken || !token.refreshToken) {
        throw new Error("刷新令牌失败：响应中没有新令牌")
      }
      saveCloudreveToken(token)
      return token
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** Refresh a few minutes before expiry, and reuse an in-flight refresh. */
export async function ensureAccessToken(): Promise<string> {
  const token = loadCloudreveConfig().token
  if (!token?.accessToken) throw new Error("Cloudreve 尚未登录")
  if (token.accessExpires - Date.now() > 120_000) return token.accessToken
  const refreshed = await cloudreveRefresh()
  return refreshed.accessToken
}

async function authorizedRequest<T>(
  path: string,
  init: RequestOptions = {},
): Promise<T> {
  const access = await ensureAccessToken()
  try {
    return await request<T>(path, init, access)
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    if (status !== 401) throw error
    const fresh = await cloudreveRefresh()
    return request<T>(path, init, fresh.accessToken)
  }
}

export async function cloudreveCreateDownload(url: string, dst: string): Promise<void> {
  await authorizedRequest("/workflow/download", {
    method: "POST",
    body: JSON.stringify({
      dst: dst.trim() || "cloudreve://my",
      src: [url],
    }),
  })
}

/** List folders under a Cloudreve URI (type 1 entries). */
export async function cloudreveListFolders(uri: string): Promise<CloudFolder[]> {
  const target = uri.trim() || "cloudreve://my"
  const data = await authorizedRequest<any>(
    `/file?uri=${encodeURIComponent(target)}&page=0&page_size=200`,
  )
  const files = (data as any)?.files || []
  return files
    .filter((item: any) => Number(item?.type) === 1)
    .map((item: any) => ({
      id: String(item?.id || ""),
      name: String(item?.name || "未命名"),
      path: String(item?.path || target),
    }))
}

function mapTask(item: any): DownloadTask {
  const download = item?.summary?.props?.download || {}
  const total = Number(download.total || 0)
  const downloaded = Number(download.downloaded || 0)
  const name =
    String(download.name || "") ||
    String(item?.summary?.props?.src_str || "") ||
    String(item?.id || "Cloudreve 任务")
  return {
    id: String(item?.id || ""),
    name,
    total,
    downloaded,
    progress: total > 0 ? Math.min(1, downloaded / total) : 0,
    speed: Number(download.download_speed || 0),
    status: String(item?.status || download.state || ""),
    source: "cloudreve",
    phase: String(item?.summary?.phase || ""),
  }
}

export async function cloudreveListTasks(): Promise<DownloadTask[]> {
  const config = loadCloudreveConfig()
  if (!config.token) return []
  const [ongoing, finished] = await Promise.all([
    authorizedRequest<any>("/workflow?category=downloading&page_size=20"),
    authorizedRequest<any>("/workflow?category=downloaded&page_size=20"),
  ])
  const items = [
    ...((ongoing as any)?.tasks || []),
    ...((finished as any)?.tasks || []),
  ]
  const seen = new Set<string>()
  const result: DownloadTask[] = []
  for (const item of items) {
    const task = mapTask(item)
    if (!task.id || seen.has(task.id)) continue
    seen.add(task.id)
    result.push(task)
  }
  return result
}

export async function cloudreveLogout(): Promise<void> {
  const token = loadCloudreveConfig().token
  if (token?.refreshToken) {
    try {
      await request("/session/token", {
        method: "DELETE",
        body: JSON.stringify({ refresh_token: token.refreshToken }),
      })
    } catch {
      // Local logout must succeed even if the server is unreachable.
    }
  }
  clearCloudreveToken()
}
