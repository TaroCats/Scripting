/**
 * 小组件可见的数据快照（App Group 共享文件）。
 *
 * 为什么不用 Storage 传数据：
 * 实测桌面小组件里 `loadDoorPrefs()` 拿到的是空对象 —— 排序永远是服务端原始顺序，
 * 而 App 那边偏好明明已经写进去了。说明扩展进程读不到主 App 的私有存储域。
 *
 * App Group 的 Documents 目录是文档明确保证的：`FileManager.appGroupDocumentsDirectory`
 * 「存储于该目录的文件不会显示在系统「文件」App 中，但 Widget 中运行的脚本可访问这些文件」。
 * 所以门禁列表 + 排序偏好 + 最近一次操作结果都从这里走，Storage 只作兜底。
 *
 * 注意：这是"两人三脚"的共享文件，读写不加锁。数据量极小（几个门禁），后写覆盖先写即可。
 */
import { BUILD_TAG, K, type DoorKey, type WidgetDiag } from "./protocol"
import type { DoorPrefs } from "./door_prefs"
import { loadSession, type Session } from "./session"

const FILE_NAME = "ql_widget_snapshot.json"

export type SnapshotResult = { ts: number; ok: boolean; text: string }

export type WidgetSnapshot = {
  updatedAt: number
  build: string
  doors: DoorKey[]
  prefs: DoorPrefs
  /** 小组件里最后一次开门的结果，用来在桌面上直接给反馈 */
  lastResult: SnapshotResult | null
  /** 小组件上一次渲染的指纹（由 widget.tsx 写），App 里读来做诊断 */
  diag: WidgetDiag | null
  /**
   * 会话快照。扩展进程可能读不到 Keychain，读不到时小组件拿这份开门。
   * 这里的 token 只落在 App Group 容器里，不进系统「文件」App。
   */
  session: Session | null
}

function snapshotPath(): string | null {
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    return dir ? `${dir}/${FILE_NAME}` : null
  } catch {
    return null
  }
}

export function readSnapshot(): WidgetSnapshot | null {
  const path = snapshotPath()
  if (!path) return null
  try {
    if (!FileManager.existsSync(path)) return null
    const text = FileManager.readAsStringSync(path)
    if (!text) return null
    const obj = JSON.parse(text) as WidgetSnapshot
    if (!obj || !Array.isArray(obj.doors) || !obj.prefs) return null
    return obj
  } catch {
    return null
  }
}

function ensureDir(): void {
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    if (dir && !FileManager.existsSync(dir)) FileManager.createDirectorySync(dir, true)
  } catch {
    // 目录建不了就在 writeRaw 里被 try/catch 兜住
  }
}

function writeRaw(next: WidgetSnapshot): void {
  const path = snapshotPath()
  if (!path) return
  ensureDir()
  try {
    FileManager.writeAsStringSync(path, JSON.stringify(next))
  } catch {
    // 写不进去就退化成 Storage，widget 侧有兜底
  }
}

/** App 侧写快照：门禁列表或排序偏好一变就调 */
export function writeSnapshot(patch: {
  doors: DoorKey[]
  prefs: DoorPrefs
  lastResult?: SnapshotResult | null
}): void {
  const prev = readSnapshot()
  writeRaw({
    updatedAt: Date.now(),
    build: BUILD_TAG,
    doors: patch.doors.map(d => ({ ...d })),
    prefs: { order: [...patch.prefs.order], favorites: [...patch.prefs.favorites] },
    lastResult: patch.lastResult !== undefined ? patch.lastResult : (prev?.lastResult ?? null),
    diag: prev?.diag ?? null,
    // Keychain 能读就用最新的；读不到（扩展进程）保留上一次写进去的
    session: loadSession() ?? prev?.session ?? null,
  })
}

/** 小组件渲染前调用：写指纹（顺带把读到的门禁/偏好回写，保证文件里是最新的） */
export function writeWidgetSnapshot(diag: WidgetDiag, doors: DoorKey[], prefs: DoorPrefs): void {
  const prev = readSnapshot()
  writeRaw({
    // 保留 App 上次写入的时间：这条时间戳在 App 里代表"App 最后一次推送"，widget 渲染时间看 diag.ts
    updatedAt: prev?.updatedAt ?? diag.ts,
    build: BUILD_TAG,
    doors,
    prefs,
    lastResult: prev?.lastResult ?? null,
    diag,
    // 小组件侧不要动会话快照：它读不到 Keychain，写 null 会把 App 写进去的抹掉
    session: prev?.session ?? null,
  })
  // 双通道：Storage 能读到时 App 也能看到（读不到时以文件为准）
  try { Storage.set(K.widgetDiag, diag) } catch { /* ignore */ }
}

/** 小组件/Intent 侧记录开门结果，桌面下次渲染就能显示 */
export function recordResult(ok: boolean, text: string): void {
  const prev = readSnapshot()
  if (!prev) return
  writeRaw({
    ...prev,
    lastResult: { ts: Date.now(), ok, text },
  })
}
