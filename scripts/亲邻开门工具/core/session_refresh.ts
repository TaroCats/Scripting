/**
 * 会话自动续期 + 开门时遇到过期自动换 token 再重试。
 *
 * 为什么单独抽一层：
 * - App 主界面、小组件 AppIntent、外部调用（`Script.run`）都要这套逻辑，
 *   各写一份必然走偏（有的清会话、有的不清，有的重试有的不重试）。
 * - 这一层只依赖 `api` / `session` / `snapshot`，**不碰蓝牙**，
 *   所以小组件扩展进程也能用（扩展里没有 BLE 全局对象）。
 *
 * 两个时机：
 *   1. 提前续期：`expiresAt` 快到了（`isExpiringSoon`，提前 2 分钟）且本机有 userId
 *      → 主动换一个新的 sessionId，避免每次开门都先吃一个 401。
 *   2. 事后兜底：开门真的返回 401 → 换 token → **重试一次**（只一次，避免死循环）。
 *
 * 只对 **401** 换 token。403 在这套接口里多半是网关/WAF 拦截，换多少 token 都没用，
 * 反而把本来有效的会话清掉更麻烦。
 */
import { loginByUserId, SessionExpiredError } from "./api"
import { isExpiringSoon, loadSession, saveSession, type Session } from "./session"
import { writeSnapshotSession } from "./snapshot"
import type { ApiConfig } from "./protocol"

/** 是否是"登录态失效"类错误（业务码 401 / HTTP 401） */
export function isUnauthorized(e: unknown): boolean {
  return e instanceof SessionExpiredError && String((e as SessionExpiredError).code ?? "") === "401"
}

/** 是不是一个 SessionExpiredError（无论 401 还是 403） */
export function isSessionError(e: unknown): boolean {
  return e instanceof SessionExpiredError
}

/** 本机的会话是否具备自动续期条件（用 userId 换新 sessionId） */
export function canAutoRenew(s: Session | null): boolean {
  return Boolean(s?.userId && s.userId.trim())
}

/**
 * 用 userId 换一个新 sessionId 并落地（Keychain + Storage + 共享快照）。
 * 失败或没有 userId 时返回 null —— 调用方据此决定是重试还是报"请重新登录"。
 */
export async function renewSessionByUserId(
  cfg: ApiConfig,
  cur: Session | null
): Promise<Session | null> {
  const userId = cur?.userId?.trim()
  if (!userId) return null
  try {
    const r = await loginByUserId(userId, { cfg })
    const next = saveSession({
      token: r.sessionId,
      sessionId: r.sessionId,
      phone: cur?.phone ?? "",
      userId,
      ttlSec: r.expires,
    })
    // 扩展进程读不到 Keychain，只能靠共享快照拿到新会话
    try { writeSnapshotSession(next) } catch { /* 没有快照时忽略 */ }
    return next
  } catch {
    return null
  }
}

/**
 * 取一个"现在能用"的会话：临近过期就先换新的。
 * 换不到就把旧会话原样交回去（真正失效时下层会抛 401，由 `withSessionRefresh` 兜）。
 */
export async function ensureFreshSession(cfg: ApiConfig): Promise<Session | null> {
  const cur = loadSession()
  if (!cur) return null
  if (!isExpiringSoon(cur)) return cur
  return (await renewSessionByUserId(cfg, cur)) ?? cur
}

export type SessionTaskResult<T> = {
  value: T
  /** 实际用到的会话（换过 token 就是新的那个） */
  session: Session
  /** 是否真的换过一次 token */
  renewed: boolean
}

/**
 * 跑一个需要会话的操作；撞到 401 就用 userId 换 token 再重试一次。
 *
 * 重试失败会把**第二次**的错误抛出去（调用方据此判断是彻底失效还是别的）。
 * 换不到 token（没有 userId / 换失败）时把**第一次**的错误抛出去，
 * 保持"为什么失败"的信息不被覆盖。
 */
export async function withSessionRefresh<T>(
  cfg: ApiConfig,
  session: Session,
  task: (s: Session) => Promise<T>,
  hooks: { onRenew?: (next: Session) => void } = {}
): Promise<SessionTaskResult<T>> {
  try {
    return { value: await task(session), session, renewed: false }
  } catch (e) {
    if (!isUnauthorized(e)) throw e
    const next = await renewSessionByUserId(cfg, session)
    if (!next) throw e
    hooks.onRenew?.(next)
    return { value: await task(next), session: next, renewed: true }
  }
}
