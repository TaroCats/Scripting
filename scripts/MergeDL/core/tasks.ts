import { aria2AddUri } from "./aria2"
import { cloudreveCreateDownload } from "./cloudreve"
import { loadAria2Config, loadCloudreveConfig, loadMode } from "./config"
import type { CloudreveToken, DownloaderMode, InboxJob } from "./types"

export function validatedUrl(raw: string): string {
  const url = raw.trim()
  if (!/^(https?:\/\/|magnet:)/i.test(url)) {
    throw new Error("仅支持 http(s) 或 magnet 链接")
  }
  return url
}

export async function pushUrlTo(
  raw: string,
  mode: DownloaderMode,
  destination?: string,
): Promise<string> {
  const url = validatedUrl(raw)
  if (mode === "cloudreve") {
    const config = loadCloudreveConfig()
    await cloudreveCreateDownload(url, destination || config.dst)
    return "已推送到 Cloudreve 离线下载"
  }
  await aria2AddUri(loadAria2Config(), url)
  return "已推送到 aria2"
}

/** Safari-intercepted jobs carry the channel chosen in the floating panel. */
export async function pushJob(job: InboxJob): Promise<string> {
  const mode: DownloaderMode =
    job.channel === "aria2" || job.channel === "cloudreve" ? job.channel : loadMode()
  return pushUrlTo(job.url, mode)
}

/** Fallback for older queued jobs without a channel. */
export async function pushUrl(raw: string): Promise<string> {
  return pushUrlTo(raw, loadMode())
}

export function tokenStatus(token: CloudreveToken | null): string {
  if (!token) return "未登录"
  const accessLeft = Math.max(0, token.accessExpires - Date.now())
  const refreshLeft = Math.max(0, token.refreshExpires - Date.now())
  if (refreshLeft <= 0) return "登录已过期"
  const minutes = Math.ceil(accessLeft / 60000)
  return `令牌有效 · 约 ${minutes} 分钟后自动刷新`
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : "—"
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error || "未知错误")
}
