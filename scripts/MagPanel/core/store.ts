/**
 * 配置与快照的落地层。
 *
 * 为什么用 App Group 文件而不是只靠 Storage：
 * 这个仓库里已经踩过一次 —— 小组件扩展进程读不到主 App 的私有 Storage 域，
 * 拿到的是空对象。App Group 的 Documents 目录是文档保证扩展进程可读的
 * （FileManager.appGroupDocumentsDirectory），所以配置和配额快照都走文件，
 * Storage（shared 域）只作为兜底通道。
 *
 * 安全边界：网关 key 由用户自己填，只写进 App Group 容器，不进源码、
 * 不进日志、不显示在小组件上。
 */
import { Widget } from "scripting"
import type { PanelConfig, PanelSnapshot } from "./types"

export const DEFAULT_CONFIG: PanelConfig = {
  baseURL: "http://127.0.0.1:3425",
  title: "magpie",
  showTitleIcon: true,
  token: "",
  showGateway: true,
  showIcons: true,
  showAccount: true,
  showAuxCards: true,
  showAuxWindows: false,
  metric: "left",
  sort: "urgent",
  maxCards: 4,
  refreshMinutes: 15,
  providerFilter: "",
  iconBaseURL: "",
  iconKey: "",
}

const CONFIG_FILE = "magpanel_config.json"
const SNAPSHOT_FILE = "magpanel_snapshot.json"
const CONFIG_KEY = "magpanel_config"
const SNAPSHOT_KEY = "magpanel_snapshot"

function groupPath(name: string): string | null {
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    return dir ? `${dir}/${name}` : null
  } catch {
    return null
  }
}

function readJSON<T>(name: string): T | null {
  const path = groupPath(name)
  if (!path) return null
  try {
    if (!FileManager.existsSync(path)) return null
    const text = FileManager.readAsStringSync(path)
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function writeJSON(name: string, value: unknown): boolean {
  const path = groupPath(name)
  if (!path) return false
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    if (dir && !FileManager.existsSync(dir)) FileManager.createDirectorySync(dir, true)
    FileManager.writeAsStringSync(path, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Storage 里的对象可能被运行时冻结，写入前深拷贝 */
function clone<T>(v: T): T {
  if (v == null || typeof v !== "object") return v
  return JSON.parse(JSON.stringify(v)) as T
}

export function normalizeConfig(raw: Partial<PanelConfig> | null): PanelConfig {
  const src = raw ?? {}
  const baseURL = String(src.baseURL ?? DEFAULT_CONFIG.baseURL).trim() || DEFAULT_CONFIG.baseURL
  return {
    baseURL,
    title: (String(src.title ?? DEFAULT_CONFIG.title).trim() || DEFAULT_CONFIG.title).slice(0, 24),
    showTitleIcon: src.showTitleIcon !== false,
    token: String(src.token ?? "").trim(),
    showGateway: src.showGateway !== false,
    showIcons: src.showIcons !== false,
    showAccount: src.showAccount !== false,
    showAuxCards: src.showAuxCards !== false,
    showAuxWindows: src.showAuxWindows === true,
    metric: src.metric === "used" ? "used" : "left",
    sort: src.sort === "source" ? "source" : "urgent",
    maxCards: Math.min(8, Math.max(1, Math.round(Number(src.maxCards ?? DEFAULT_CONFIG.maxCards) || 4))),
    refreshMinutes: Math.min(120, Math.max(5, Math.round(Number(src.refreshMinutes ?? DEFAULT_CONFIG.refreshMinutes) || 15))),
    providerFilter: String(src.providerFilter ?? "").trim(),
    iconBaseURL: String(src.iconBaseURL ?? "").trim(),
    iconKey: String(src.iconKey ?? "").trim(),
  }
}

export function loadConfig(): PanelConfig {
  let fromStore: Partial<PanelConfig> | null = null
  try {
    fromStore = Storage.get<Partial<PanelConfig>>(CONFIG_KEY, { shared: true })
  } catch {
    fromStore = null
  }
  const fromFile = readJSON<Partial<PanelConfig>>(CONFIG_FILE)
  // 文件优先：它是扩展进程唯一可靠能读到的那份
  return normalizeConfig({ ...(clone(fromStore ?? {})), ...(clone(fromFile ?? {})) })
}

export function saveConfig(cfg: PanelConfig): void {
  const next = normalizeConfig(clone(cfg))
  writeJSON(CONFIG_FILE, next)
  try {
    Storage.set(CONFIG_KEY, next, { shared: true })
  } catch {
    // 文件那份已经写了，Storage 失败不影响小组件
  }
}

export function readSnapshot(): PanelSnapshot | null {
  const fromFile = readJSON<PanelSnapshot>(SNAPSHOT_FILE)
  if (fromFile && typeof fromFile.fetchedAt === "number" && Array.isArray(fromFile.cards)) return fromFile
  try {
    const fromStore = Storage.get<PanelSnapshot>(SNAPSHOT_KEY, { shared: true })
    if (fromStore && typeof fromStore.fetchedAt === "number" && Array.isArray(fromStore.cards)) return fromStore
  } catch {
    // ignore
  }
  return null
}

export function writeSnapshot(snap: PanelSnapshot): void {
  writeJSON(SNAPSHOT_FILE, snap)
  try {
    Storage.set(SNAPSHOT_KEY, snap, { shared: true })
  } catch {
    // ignore
  }
}

export function clearSnapshot(): void {
  const path = groupPath(SNAPSHOT_FILE)
  try {
    if (path && FileManager.existsSync(path)) FileManager.removeSync(path)
  } catch {
    // ignore
  }
  try {
    Storage.remove(SNAPSHOT_KEY, { shared: true })
  } catch {
    // ignore
  }
}

/** 让所有已添加的小组件重新取时间线 */
export function reloadWidgets(): void {
  try {
    Widget.reloadAll()
  } catch {
    // 在纯 App 环境里不保证可用
  }
}
