/**
 * 对外开门接口 —— 让**其他 App / 其他脚本**直接调起本脚本开门。
 *
 * ─────────────────────────────────────────────────────────────
 * 调用方式
 * ─────────────────────────────────────────────────────────────
 *
 * 1) 其他 Scripting 脚本（推荐，参数保留原生类型）：
 *
 * ```ts
 * const r = await Script.run<OpenReply>({
 *   name: "亲邻开门工具",
 *   queryParameters: { mode: "openDoor" },
 * })
 * if (r?.ok) console.log(r.message)
 * ```
 *
 * 2) URL scheme（快捷指令 / 其他 App 打开链接，参数一律是字符串）：
 *
 * ```
 * scripting://run/亲邻开门工具?mode=openDoor&door=1
 * scripting://run/亲邻开门工具?mode=openDoor&doorControlId=123&ble=false
 * ```
 *
 * 触发条件：`Script.queryParameters.mode === "openDoor"`（也接受 `open`）。
 * 没带这个参数时脚本按原来的方式启动 UI，行为完全不变。
 *
 * ─────────────────────────────────────────────────────────────
 * 参数
 * ─────────────────────────────────────────────────────────────
 *
 * | 参数            | 说明                                                                 |
 * | --------------- | ------------------------------------------------------------------ |
 * | `mode`          | 必填，`openDoor` 才算对外调用                                          |
 * | `door`          | 选门：doorControlId 精确 → 名称（精确/包含）→ 1 起序号（按 App 显示顺序） |
 * | `doorControlId` | 直接指定 id，优先于 `door`；可配合 `macAddress` 开一条本机没记录的门      |
 * | `macAddress`    | 与 `doorControlId` 一起直传时使用                                     |
 * | `name`          | 仅用于日志/返回值的显示名（本机列表里没有这条门禁时）                     |
 * | `ble`           | `false` / `0` 只走远程；缺省允许蓝牙优先                               |
 * | `timeoutMs`     | 整个开门流程上限，缺省 20000，允许 1000–60000                          |
 * | `silent`        | `true` 时不往「日志」页写记录，缺省 false                              |
 *
 * 都不传 = 开 App 里当前选中的那扇门（没选中就是列表第一项，收藏优先）。
 *
 * ─────────────────────────────────────────────────────────────
 * 返回值（`Script.exit(reply)` 交回调用方）
 * ─────────────────────────────────────────────────────────────
 *
 * ```jsonc
 * {
 *   "ok": true,
 *   "code": "ok",              // ok | open_failed | no_door | not_logged_in | session_expired | timeout | error
 *   "via": "ble",              // ble | remote | none
 *   "message": "开门成功 · 1 号楼大门",
 *   "doorControlId": "123",
 *   "doorControlName": "1 号楼大门",
 *   "at": 1763737200000,
 *   "build": "2026-11-16-b",
 *   "sessionExpired": false,   // 可选：仅在会话失效时为 true
 *   "steps": ["选门 → …", "ble", "…"]   // 最后 12 条执行步骤，便于调用方排查
 * }
 * ```
 *
 * 约定：`ok` 是唯一的成功判据；`code` 说明原因，`message` 是给人看的文案。
 * 只有服务端明确返回 **401** 时才会清掉本机登录态，403（多为网关拦截）只上报不登出。
 */
import { Script, Widget } from "scripting"
import { SessionExpiredError } from "./api"
import { openDoor, type OpenVia, type OpenOutcome } from "./opendoor"
import { DEFAULT_BLE_SETTINGS, BUILD_TAG, K, type BleSettings, type DoorKey } from "./protocol"
import { arrangeDoors, loadDoorPrefs } from "./door_prefs"
import { clearSession } from "./session"
import { canAutoRenew, ensureFreshSession, withSessionRefresh } from "./session_refresh"
import { recordResult } from "./snapshot"
import { appendLog, loadConfig, loadDoors } from "../widget_shared"

/** 认得出这两种写法即可，避免调用方大小写/同义词踩坑 */
const MODE_VALUES = new Set(["opendoor", "open"])
const DEFAULT_TIMEOUT_MS = 20000
const MIN_TIMEOUT_MS = 1000
const MAX_TIMEOUT_MS = 60000
/** 返回体里最多带几条步骤，够排查又不会撑大 IPC 载荷 */
const MAX_STEPS = 12

const SELECTED_DOOR_KEY = "ql_selected_door"

export type ExternalCode =
  | "ok"
  | "open_failed"
  | "no_door"
  | "not_logged_in"
  | "session_expired"
  | "timeout"
  | "error"

export type ExternalReply = {
  ok: boolean
  code: ExternalCode
  via: OpenVia
  message: string
  doorControlId: string
  doorControlName: string
  at: number
  build: string
  sessionExpired?: boolean
  steps: string[]
}

export type ExternalParams = {
  /** 选门表达式：id / 名称 / 1 起序号 */
  door: string
  doorControlId: string
  macAddress: string
  name: string
  allowBle: boolean
  timeoutMs: number
  silent: boolean
}

/* ────────────────────────── 参数解析（兼容字符串与原生类型） ────────────────────────── */

function str(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return ""
}

function bool(v: unknown, dflt: boolean): boolean {
  if (v == null) return dflt
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v !== 0
  const s = String(v).trim().toLowerCase()
  if (!s) return dflt
  if (["1", "true", "yes", "on", "y", "是"].includes(s)) return true
  if (["0", "false", "no", "off", "n", "否"].includes(s)) return false
  return dflt
}

function num(v: unknown, dflt: number, min: number, max: number): number {
  const n = Number(str(v))
  if (!Number.isFinite(n) || n <= 0) return dflt
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** 本次启动是不是"外部调用开门"；不是就按普通启动走 UI */
export function isExternalRequest(
  qp: Record<string, any> | null | undefined = Script.queryParameters as Record<string, any>
): boolean {
  if (!qp || typeof qp !== "object") return false
  return MODE_VALUES.has(str((qp as Record<string, any>).mode ?? (qp as Record<string, any>).action).toLowerCase())
}

export function readExternalParams(qp: Record<string, any>): ExternalParams {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (qp[k] !== undefined && qp[k] !== null && str(qp[k]) !== "") return qp[k]
    }
    return undefined
  }
  return {
    door: str(get("door", "doorName", "index")),
    doorControlId: str(get("doorControlId", "doorId", "id")),
    macAddress: str(get("macAddress", "mac")),
    name: str(get("name", "doorControlName")),
    allowBle: bool(get("ble", "allowBle", "enableBle"), true),
    timeoutMs: num(get("timeoutMs", "timeout"), DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    silent: bool(get("silent"), false),
  }
}

/* ────────────────────────── 选门 ────────────────────────── */

/** 选门表达式里表示"就按首页那个"的写法（与不传 door 等价） */
const DEFAULT_ALIASES = new Set(["", "home", "default", "selected", "首页", "当前", "默认"])

/** 解析目标门禁：显式 id → 名称 → 序号 → 首页当前选中的门 */
function pickDoor(
  p: ExternalParams,
  doors: DoorKey[],
  arranged: DoorKey[]
): { door: DoorKey | null; how: string } {
  if (p.doorControlId) {
    const hit = doors.find(d => String(d.doorControlId) === p.doorControlId)
    if (hit) return { door: hit, how: `doorControlId=${p.doorControlId}` }
    // 本机列表里没有：调用方明确给了 id（可带 mac）就照开，不因为"没同步过"拒绝
    if (p.macAddress || p.name) {
      return {
        door: {
          doorControlId: p.doorControlId,
          doorControlName: p.name || p.doorControlId,
          macAddress: p.macAddress || undefined,
        },
        how: `doorControlId=${p.doorControlId}（本机无记录，按直传参数开）`,
      }
    }
    return { door: null, how: "" }
  }

  if (p.door && !DEFAULT_ALIASES.has(p.door.toLowerCase())) {
    const s = p.door
    const byId = doors.find(d => String(d.doorControlId) === s)
    if (byId) return { door: byId, how: `door=${s}（id）` }
    const byName = doors.find(d => d.doorControlName === s) ?? doors.find(d => d.doorControlName.includes(s))
    if (byName) return { door: byName, how: `door=${s}（名称）` }
    if (/^\d+$/.test(s)) {
      const i = Number(s) - 1
      if (i >= 0 && i < arranged.length) return { door: arranged[i], how: `door=${s}（序号）` }
    }
    return { door: null, how: "" }
  }

  // ── 没指定门：打开「开门页当前选中的那扇」──
  // 与 App 首页完全同一套算法：`ql_selected_door` 命中就用它，
  // 否则退到列表第一项（收藏优先、组内按用户拖动顺序）。
  const sel = String((Storage.get<string>(SELECTED_DOOR_KEY) as string) ?? "")
  if (sel) {
    const hit = arranged.find(d => String(d.doorControlId) === sel)
    if (hit) return { door: hit, how: "默认（开门页选中的门）" }
  }
  if (arranged.length > 0) return { door: arranged[0], how: "默认（开门页第一项）" }
  return { door: null, how: "" }
}

function loadBle(): BleSettings {
  const saved = Storage.get<BleSettings>(K.ble) as BleSettings | null
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_BLE_SETTINGS)) as BleSettings
  // Storage 返回的对象可能被冻结，必须先深拷贝再交给下层修改
  const clone = JSON.parse(JSON.stringify(saved)) as BleSettings
  return { ...(JSON.parse(JSON.stringify(DEFAULT_BLE_SETTINGS)) as BleSettings), ...clone }
}

/* ────────────────────────── 超时保护 ────────────────────────── */

type Deadline<T> =
  | { kind: "done"; value: T }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" }

/**
 * 给整条开门流程套一个总时限。
 *
 * `Script.run` 的调用方会一直等到本脚本 `Script.exit`，蓝牙扫描卡住就会把对方一起吊死，
 * 所以这里必须有兜底：到点就如实回一个 `timeout`，不假装成功。
 * 注意超时只是"不再等"，底层动作可能仍在收尾（尤其是已写出的 BLE 帧）。
 */
function withDeadline<T>(task: Promise<T>, ms: number): Promise<Deadline<T>> {
  return new Promise<Deadline<T>>(resolve => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (r: Deadline<T>) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      resolve(r)
    }
    timer = setTimeout(() => finish({ kind: "timeout" }), ms)
    task.then(
      v => finish({ kind: "done", value: v }),
      e => finish({ kind: "error", error: e })
    )
  })
}

/* ────────────────────────── 主流程 ────────────────────────── */

export async function externalOpen(p: ExternalParams): Promise<ExternalReply> {
  const at = Date.now()
  const steps: string[] = []
  const note = (line: string) => {
    steps.push(line)
    if (steps.length > MAX_STEPS) steps.shift()
    if (!p.silent) appendLog(`[外部调用] · ${line}`)
  }

  const reply = (
    ok: boolean,
    code: ExternalCode,
    message: string,
    via: OpenVia = "none",
    door?: DoorKey | null,
    extra: Partial<ExternalReply> = {}
  ): ExternalReply => ({
    ok,
    code,
    via,
    message,
    doorControlId: door ? String(door.doorControlId) : "",
    doorControlName: door?.doorControlName ?? "",
    at,
    build: BUILD_TAG,
    steps: steps.slice(),
    ...extra,
  })

  const cfg = loadConfig()
  const doors = loadDoors()
  const arranged = arrangeDoors(doors, loadDoorPrefs())

  // ── 1) 选门 ──
  const picked = pickDoor(p, doors, arranged)
  if (!picked.door) {
    const message = doors.length === 0
      ? "本机还没有门禁数据：请先打开「亲邻开门工具」同步一次门禁"
      : `没找到匹配的门禁（door=${p.door || p.doorControlId || "未指定"}）`
    note(message)
    return reply(false, "no_door", message)
  }
  const door = picked.door
  note(`选门 → ${door.doorControlName}（${picked.how}）`)

  // ── 2) 会话（临近过期且有 userId 时自动续期） ──
  const session = await ensureFreshSession(cfg)
  if (!session) {
    const message = "本机未登录：请先打开「亲邻开门工具」登录一次"
    note(message)
    return reply(false, "not_logged_in", message, "none", door)
  }

  // ── 3) 开门（蓝牙优先 → 远程兜底；allowBle=false 时只走远程） ──
  const ble = loadBle()
  note(p.allowBle ? "允许蓝牙优先（失败自动转远程）" : "调用方要求仅远程")
  const started = Date.now()

  // 401 会自动用 userId 换 token 再重试一次（见 core/session_refresh.ts），
  // 整个「首发 + 续期 + 重试」套同一个总时限，不会因重试把调用方拖成两倍时间。
  const outcome = await withDeadline(
    withSessionRefresh(
      cfg,
      session,
      (s): Promise<OpenOutcome> =>
        openDoor(door, { cfg, session: s }, ble, {
          allowBle: p.allowBle,
          onStep: (stage, detail) => note(`${stage}${detail ? ` ${detail}` : ""}`),
        }),
      {
        onRenew: () => {
          note("会话已过期（401）→ 已用 userId 换新 token，重试一次")
          if (!p.silent) appendLog("[外部调用] 会话已自动续期")
        },
      }
    ),
    p.timeoutMs
  )
  note(`耗时 ${Date.now() - started}ms`)

  if (outcome.kind === "timeout") {
    return reply(
      false,
      "timeout",
      `开门超时（${p.timeoutMs}ms 内未完成，多半是蓝牙一直没扫到设备）：可改用 ble=false 只走远程`,
      "none",
      door
    )
  }

  if (outcome.kind === "error") {
    const e = outcome.error
    if (e instanceof SessionExpiredError) {
      const code = String(e.code ?? "")
      // 只有服务端明确 401 才登出；403 常常只是网关拦截，登掉有效会话反而更麻烦
      if (code === "401") clearSession()
      const message = code === "401"
        ? (canAutoRenew(session)
          ? "会话已失效，已尝试自动换 token 仍被拒：请在「亲邻开门工具」里重新登录"
          : "会话已失效，且本机没有 userId 无法自动续期：请用「用 userId 登录」重新登录一次（之后可长期自动续期）")
        : `请求被拒绝（${code || "403"}）：多为网关/WAF 拦截，登录态未清除`
      note(message)
      // 403 不应当让调用方去登出：只有 401 才真是登录态失效
      return reply(false, "session_expired", message, "none", door, { sessionExpired: code === "401" })
    }
    const message = e instanceof Error ? e.message : String(e)
    note(`异常：${message}`)
    return reply(false, "error", message, "none", door)
  }

  const result = outcome.value
  const r = result.value
  if (result.renewed) note("本次开门使用了续期后的新 token")
  return reply(r.ok, r.ok ? "ok" : "open_failed", r.message, r.via, door)
}

/**
 * 入口：`index.tsx` 在启动时调一次。
 *
 * 只有 `isExternalRequest()` 为真才会走到这里；跑完把结果 `Script.exit(reply)` 交回调用方，
 * 不呈现任何 UI（`Script.run` 的调用方等的是 exit 的返回值，弹 UI 只会让它一直挂在那里）。
 *
 * @param options.qp   本次的参数（缺省取 `Script.queryParameters`）
 * @param options.exit 是否用 `Script.exit(reply)` 交回结果。
 *   冷启动（`Script.run` / URL scheme 新实例）必须 true；
 *   已最小化的实例被 URL scheme 唤起（`Script.onResume`）时必须 false，
 *   否则会把用户正开着的界面直接关掉。
 */
export async function runExternalRequest(options: {
  qp?: Record<string, any>
  exit?: boolean
} = {}): Promise<ExternalReply> {
  const qp = (options.qp ?? Script.queryParameters ?? {}) as Record<string, any>
  const p = readExternalParams(qp)
  const who = callerName()

  const reply = await externalOpen(p)

  if (!p.silent) {
    appendLog(`[外部调用${who ? ` · ${who}` : ""}] ${reply.ok ? "✅" : "❌"} ${reply.message}`)
  }
  // 桌面上有小组件的话，顺手把结果推上去，用户不用打开 App 也能看到
  try { recordResult(reply.ok, reply.message) } catch { /* 还没有快照时忽略 */ }
  try { Widget.reloadAll() } catch { /* 预览等场景不可用，忽略 */ }

  if (options.exit !== false) Script.exit(reply)
  return reply
}

/** 调用方脚本名，仅用于日志；不是鉴权凭据 */
function callerName(): string {
  try {
    const name = Script.invocation?.caller?.name
    return name ? String(name) : ""
  } catch {
    return ""
  }
}
