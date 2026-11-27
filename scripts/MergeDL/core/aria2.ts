import { fetch } from "scripting"
import type { Aria2Config, DownloadTask } from "./types"

type RpcReply = {
  jsonrpc?: string
  id?: string | number
  result?: any
  error?: { code?: number; message?: string }
}

let sequence = 0

async function rpc(config: Aria2Config, method: string, params: any[] = []): Promise<any> {
  const endpoint = config.rpcUrl.trim()
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error("aria2 RPC 地址必须以 http:// 或 https:// 开头")
  }
  const body = {
    jsonrpc: "2.0",
    id: ++sequence,
    method,
    params: config.secret ? [`token:${config.secret}`, ...params] : params,
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`aria2 HTTP ${response.status}`)
  }
  const reply = (await response.json()) as RpcReply
  if (reply.error) {
    throw new Error(reply.error.message || `aria2 RPC 错误 ${reply.error.code ?? ""}`)
  }
  return reply.result
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function toTask(status: any): DownloadTask {
  const total = Number(status.totalLength || 0)
  const downloaded = Number(status.completedLength || 0)
  const file = status.files?.[0]
  const name =
    (file && basename(String(file.path || ""))) ||
    status.bittorrent?.info?.name ||
    String(status.gid || "aria2 任务")
  return {
    id: String(status.gid || ""),
    name,
    total,
    downloaded,
    progress: total > 0 ? Math.min(1, downloaded / total) : 0,
    speed: Number(status.downloadSpeed || 0),
    status: String(status.status || "unknown"),
    source: "aria2",
  }
}

export async function aria2Test(config: Aria2Config): Promise<string> {
  const version = await rpc(config, "aria2.getVersion")
  return String(version?.version || "已连接")
}

export async function aria2AddUri(config: Aria2Config, url: string): Promise<string> {
  const gid = await rpc(config, "aria2.addUri", [[url], {}])
  return String(gid || "")
}

export async function aria2Remove(config: Aria2Config, gid: string): Promise<void> {
  await rpc(config, "aria2.remove", [gid])
}

export async function aria2ListTasks(config: Aria2Config): Promise<DownloadTask[]> {
  const emptyConfig = !config.rpcUrl
  if (emptyConfig) return []
  const [active, waiting, stopped] = await Promise.all([
    rpc(config, "aria2.tellActive"),
    rpc(config, "aria2.tellWaiting", [0, 50]),
    rpc(config, "aria2.tellStopped", [0, 50]),
  ])
  const seen = new Set<string>()
  const result: DownloadTask[] = []
  for (const item of [...(active || []), ...(waiting || []), ...(stopped || [])]) {
    const task = toTask(item)
    if (!task.id || seen.has(task.id)) continue
    seen.add(task.id)
    result.push(task)
  }
  return result
}
