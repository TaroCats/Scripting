/**
 * 门禁列表的「用户排序 + 收藏」偏好。
 *
 * 为什么要独立存一份，而不是直接改 `K.doors`：
 * 门禁列表每次同步都会被服务端返回覆盖（`queryUserDoorByCache` 的顺序是按它自己的规则排的），
 * 用户手动拖出来的顺序和收藏必须落在另一个 key 里，同步后再套回去，否则一刷新就全丢。
 *
 * 展示规则（App 列表、小组件、AppIntent 共用同一套）：
 *   1. 收藏的门禁排在最前，收藏组内部按用户顺序
 *   2. 未收藏的排在后面，同样按用户顺序
 *   3. 没被记录过的新门禁排在未收藏组末尾（保持服务端给的相对顺序）
 *
 * 收藏 = 置顶到小组件。小组件按这个顺序依次展示，第一项用于小尺寸/锁屏。
 */
import { K } from "./protocol"

export type DoorPrefs = {
  /** 全量 id 顺序（收藏组在前） */
  order: string[]
  /** 被收藏（置顶）的 id */
  favorites: string[]
}

export const EMPTY_PREFS: DoorPrefs = { order: [], favorites: [] }

function clone<T>(v: T): T {
  if (v == null || typeof v !== "object") return v
  return JSON.parse(JSON.stringify(v)) as T
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    const s = String(x ?? "")
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

export function loadDoorPrefs(): DoorPrefs {
  const saved = Storage.get<DoorPrefs>(K.doorPrefs) as DoorPrefs | null
  if (!saved || typeof saved !== "object") return { order: [], favorites: [] }
  const src = clone(saved)
  return { order: strArray(src.order), favorites: strArray(src.favorites) }
}

export function saveDoorPrefs(prefs: DoorPrefs): void {
  Storage.set(K.doorPrefs, { order: [...prefs.order], favorites: [...prefs.favorites] })
}

/**
 * 用最新的门禁 id 列表校正偏好：删掉已经不在列表里的 id，把新出现的 id 接到未收藏组末尾。
 * 每次同步门禁后都要调一次，否则换小区/新增门禁会漏项。
 */
export function normalizePrefs(ids: string[], prefs: DoorPrefs): DoorPrefs {
  const alive = new Set(ids.map(String))
  const favSet = new Set(prefs.favorites.map(String).filter(id => alive.has(id)))
  const order: string[] = []
  for (const id of prefs.order.map(String)) {
    if (alive.has(id) && !order.includes(id)) order.push(id)
  }
  for (const id of ids.map(String)) {
    if (!order.includes(id)) order.push(id)
  }
  return { order, favorites: order.filter(id => favSet.has(id)) }
}

/** 按偏好重排门禁数组（不改原数组） */
export function arrangeDoors<T extends { doorControlId: string }>(doors: T[], prefs: DoorPrefs): T[] {
  const rank = new Map<string, number>()
  prefs.order.forEach((id, i) => rank.set(String(id), i))
  const favSet = new Set(prefs.favorites.map(String))
  // id 一律按字符串比较：Storage 里存的是 string，但接口/旧数据可能是 number，
  // 一旦类型对不上，rank 全部 miss，排序就会整体错位（表现是"顺序不对、前几项跑没了"）
  const weight = (d: T) => (favSet.has(String(d.doorControlId)) ? 0 : 1)
  const at = (d: T) => rank.get(String(d.doorControlId)) ?? Number.MAX_SAFE_INTEGER
  return doors.slice().sort((a, b) => {
    const wa = weight(a)
    const wb = weight(b)
    if (wa !== wb) return wa - wb
    const ra = at(a)
    const rb = at(b)
    if (ra !== rb) return ra - rb
    return 0
  })
}

/**
 * 开关收藏。
 *
 * `fullIds` 必须是**当前全量门禁**按展示顺序排好的 id，不能只传 order 里那几个 ——
 * 否则没被记录过的门禁会掉到收藏项后面（这就是第一版写错的地方）。
 */
export function toggleFavorite(prefs: DoorPrefs, fullIds: string[], doorControlId: string): DoorPrefs {
  const has = prefs.favorites.includes(doorControlId)
  const favSet = new Set(prefs.favorites)
  const favOrder = fullIds.filter(id => favSet.has(id) && id !== doorControlId)
  const restOrder = fullIds.filter(id => !favSet.has(id) && id !== doorControlId)
  if (has) {
    // 取消收藏：退到未收藏组末尾
    return { order: [...favOrder, ...restOrder, doorControlId], favorites: favOrder }
  }
  // 收藏：插到收藏组末尾（置顶到列表前段）
  return { order: [...favOrder, doorControlId, ...restOrder], favorites: [...favOrder, doorControlId] }
}

/**
 * 修复早期版本留下的半截 order。
 *
 * 第一版 `toggleFavorite` 只把「操作过的门禁」写进 `order`，于是 `order` 里只有一两个 id，
 * 其余门禁排名垫底（`arrangeDoors` 里 unknown → MAX_SAFE_INTEGER），
 * 表现就是列表/小组件前几项忽然消失、顺序错乱。
 *
 * 判断依据：`order` 没有覆盖全部门禁 ⇒ 视为坏数据，用服务端顺序整体重建（收藏保留）。
 * 正常数据永远是全覆盖的，所以不会误伤。
 */
export function healPrefs(ids: string[], prefs: DoorPrefs): DoorPrefs {
  const all = ids.map(String)
  const known = new Set(prefs.order.map(String))
  if (all.every(id => known.has(id))) return normalizePrefs(all, prefs)
  const favSet = new Set(prefs.favorites.map(String).filter(id => all.includes(id)))
  return { order: all, favorites: all.filter(id => favSet.has(id)) }
}

/** ForEach.onMove 的标准重排实现 */
export function moveWithin<T>(arr: T[], indices: number[], newOffset: number): T[] {
  const moving = indices.map(i => arr[i]).filter(v => v !== undefined)
  const rest = arr.filter((_, i) => !indices.includes(i))
  rest.splice(Math.max(0, Math.min(newOffset, rest.length)), 0, ...moving)
  return rest
}
