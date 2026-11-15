/**
 * 小组件 / AppIntent 共用的轻量数据层（仅远程开门）。
 *
 * 注意：`core/opendoor.ts` 顶部 import 了 `core/blue.ts`（BLE 全局对象 + 3DES），
 * 小组件扩展里没有这些能力，所以这里只保留 `interpretState` 的判定逻辑副本。
 */
import {
  fetchUserDoors,
  loginByUserId,
  openDoorRemote,
  SessionExpiredError,
} from "./core/api"
import { DEFAULT_CONFIG, K, type ApiConfig, type DoorKey } from "./core/protocol"
import { loadDoorPrefs, normalizePrefs, saveDoorPrefs } from "./core/door_prefs"
import { isExpiringSoon, loadSession, saveSession, type Session } from "./core/session"

export type LogEntry = { ts: number; text: string }

/** 与 index.tsx 保持一致，App 里能直接看到小组件的操作记录 */
const LOG_KEY = "ql_logs"
const LOG_MAX = 200
const LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SELECTED_DOOR_KEY = "ql_selected_door"

/** Storage.get 返回的对象可能被运行时冻结，写入前必须深拷贝 */
function clone<T>(v: T): T {
  if (v == null || typeof v !== "object") return v
  return JSON.parse(JSON.stringify(v)) as T
}

export function loadConfig(): ApiConfig {
  const saved = Storage.get<ApiConfig>(K.config) as ApiConfig | null
  return { ...clone(DEFAULT_CONFIG), ...clone(saved ?? {}) }
}

export function loadDoors(): DoorKey[] {
  const saved = Storage.get<DoorKey[]>(K.doors) as DoorKey[] | null
  return saved && Array.isArray(saved) ? clone(saved) : []
}

export function loadSelectedDoorId(): string {
  return String((Storage.get<string>(SELECTED_DOOR_KEY) as string) ?? "")
}

export function loadLogs(): LogEntry[] {
  const saved = Storage.get<LogEntry[]>(LOG_KEY) as LogEntry[] | null
  if (!saved || !Array.isArray(saved)) return []
  const cutoff = Date.now() - LOG_TTL_MS
  return saved.filter(e => e && typeof e.ts === "number" && e.ts > cutoff).slice(0, LOG_MAX)
}

export function appendLog(text: string): void {
  Storage.set(LOG_KEY, [{ ts: Date.now(), text }, ...loadLogs()].slice(0, LOG_MAX))
}

/** 与 core/opendoor.ts 的 interpretState 判定一致（openDoorState 含义见逆向文档） */
export function interpretState(state: unknown): { ok: boolean; text: string } {
  const n = Number(state)
  if (n === 1) return { ok: true, text: "开门成功" }
  if (n === 3) return { ok: true, text: "开门成功（门已处于开启状态）" }
  if (n === 7) return { ok: false, text: "门禁设备离线" }
  if (Number.isFinite(n) && n >= 8) return { ok: false, text: `开门失败（openDoorState=${n}）` }
  if (state == null || state === "") return { ok: true, text: "请求已下发（无状态码）" }
  return { ok: false, text: `未知状态 openDoorState=${String(state)}` }
}

/** 用 userId 换新 sessionId（30 分钟有效） */
async function renewSession(cur: Session, cfg: ApiConfig): Promise<Session> {
  if (!cur.userId) return cur
  const r = await loginByUserId(cur.userId, { cfg })
  return saveSession({
    token: r.sessionId,
    sessionId: r.sessionId,
    phone: cur.phone,
    userId: cur.userId,
    ttlSec: r.expires,
  })
}

/**
 * 取可用会话：临近过期且有 userId 时自动续期。
 * 续期失败不抛错，沿用旧会话（真正开门时若 401 会再报错并记日志）。
 */
export async function ensureSession(cfg: ApiConfig): Promise<Session | null> {
  const cur = loadSession()
  if (!cur) return null
  if (!isExpiringSoon(cur)) return cur
  try {
    return await renewSession(cur, cfg)
  } catch {
    return cur
  }
}

/** 会话失效时由调用方负责登出，避免在这里重复写清理逻辑 */
export type OpResult = { ok: boolean; text: string; expired?: boolean }

/** 小组件只能走远程通道；结果同步写入 App 日志 */
export async function openDoorFromWidget(params: {
  doorControlId: string
  doorControlName: string
  macAddress: string
}): Promise<OpResult> {
  // 先落一条"收到请求"：如果日志里有这行却没有结果行，说明点击确实生效但请求卡住了，
  // 而不是按钮没反应。排查小组件交互时这两行是唯一线索。
  appendLog(`[小组件] … 收到开门请求 · ${params.doorControlName}`)
  const cfg = loadConfig()
  const session = await ensureSession(cfg)
  if (!session) {
    const text = "未登录，请打开 App 登录"
    appendLog(`[小组件] ${text}`)
    return { ok: false, text }
  }
  try {
    const env = await openDoorRemote(
      { doorControlId: params.doorControlId, macAddress: params.macAddress || undefined },
      { cfg, session }
    )
    const name = env.data?.doorControlName ?? params.doorControlName
    const verdict = interpretState(env.data?.openDoorState)
    appendLog(`[小组件] ${verdict.ok ? "✅" : "❌"} ${verdict.text} · ${name}`)
    return { ok: verdict.ok, text: `${verdict.text} · ${name}` }
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      const text = "会话已失效，请打开 App 重新登录"
      appendLog(`[小组件] ❌ ${text}`)
      return { ok: false, text, expired: true }
    }
    const text = e instanceof Error ? e.message : String(e)
    appendLog(`[小组件] ❌ 开门异常：${text}`)
    return { ok: false, text }
  }
}

/** 同步门禁列表（SyncDoorsIntent 使用） */
export async function syncDoors(): Promise<OpResult> {
  const cfg = loadConfig()
  const session = await ensureSession(cfg)
  if (!session) {
    const text = "未登录，请打开 App 登录"
    appendLog(`[小组件] ${text}`)
    return { ok: false, text }
  }
  try {
    const list = await fetchUserDoors({ cfg, session })
    const doors: DoorKey[] = list.map(d => ({
      doorControlId: d.doorControlId,
      doorControlName: d.doorControlName,
      macAddress: d.macAddress,
      hasBluetoothModule: d.hasBluetoothModule,
      online: d.online,
    }))
    Storage.set(K.doors, doors)
    // 服务端顺序会覆盖本地顺序，这里把 App 里排好的顺序/收藏套回去
    saveDoorPrefs(normalizePrefs(doors.map(d => d.doorControlId), loadDoorPrefs()))
    const text = `已同步 ${list.length} 个门禁`
    appendLog(`[小组件] ${text}`)
    return { ok: true, text }
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      const text = "会话已失效，请打开 App 重新登录"
      appendLog(`[小组件] ${text}`)
      return { ok: false, text, expired: true }
    }
    const text = e instanceof Error ? e.message : String(e)
    appendLog(`[小组件] 同步门禁失败：${text}`)
    return { ok: false, text }
  }
}

/** 下次时间线刷新时间：常规 30 分钟，会话到期时提前一点再刷一次 */
export function buildReloadDate(session: Session | null): Date {
  const now = Date.now()
  let at = now + 30 * 60 * 1000
  if (session?.expiresAt && session.userId) {
    const t = session.expiresAt + 30 * 1000
    if (t > now + 60 * 1000 && t < at) at = t
  }
  return new Date(at)
}
