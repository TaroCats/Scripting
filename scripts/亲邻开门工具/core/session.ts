/**
 * 会话管理。
 *
 * 对齐分析结论：
 * - 登录成功后统一由一处落地 token/sessionId（原 App 是 UserManager::loginSuccess）
 *
 * 与早期版本的差别：sessionId 不是永久的。H5 的 `h5/login` 返回 `expires: 1800`（30 分钟），
 * 所以这里多存一个 `userId` 与 `expiresAt`：临近过期时用 userId 自动换新的 sessionId，
 * 不需要用户重新输验证码。
 */
import { K } from "./protocol"

export type Session = {
  token: string
  sessionId: string
  phone: string
  loginAt: number
  /** 用于自动续期（h5/login?userId=…）。只在用 userId 通道登录时才有 */
  userId?: string
  /** sessionId 到期时间（毫秒时间戳）。0 或未设置表示"不知道/不过期" */
  expiresAt?: number
}

export function loadSession(): Session | null {
  const token = Keychain.get(K.kcToken)
  if (!token) return null
  // Storage.get 返回可能被运行时冻结，构造全新对象避免后续写入报 readonly
  return {
    token: String(token),
    sessionId: String(Keychain.get(K.kcSessionId) ?? ""),
    phone: String((Storage.get<string>(K.phone) as string) ?? ""),
    loginAt: Number((Storage.get<number>("ql_login_at") as number) ?? 0),
    userId: (Storage.get<string>("ql_user_id") as string) ?? undefined,
    expiresAt: Number((Storage.get<number>("ql_sid_exp") as number) ?? 0),
  }
}

export function saveSession(input: {
  token: string
  sessionId?: string
  phone?: string
  userId?: string
  /** sessionId 有效期（秒）。传 0 表示不过期 */
  ttlSec?: number
}): Session {
  // first_unlock_this_device：重启后首次解锁即可读，不迁移到其他设备。
  const opts = { accessibility: "first_unlock_this_device" as const, synchronizable: false }
  Keychain.set(K.kcToken, input.token, opts)
  if (input.sessionId) Keychain.set(K.kcSessionId, input.sessionId, opts)
  if (input.phone) Storage.set(K.phone, input.phone)
  if (input.userId) Storage.set("ql_user_id", input.userId)
  Storage.set("ql_login_at", Date.now())
  Storage.set("ql_sid_exp", input.ttlSec && input.ttlSec > 0 ? Date.now() + input.ttlSec * 1000 : 0)
  return loadSession()!
}

/** 是否已过期或即将过期（默认提前 2 分钟算"该续了"） */
export function isExpiringSoon(s: Session | null, marginSec = 120): boolean {
  if (!s) return false
  if (!s.expiresAt) return false
  return Date.now() + marginSec * 1000 >= s.expiresAt
}

/** 强制登出：清空 token/sessionId，保留手机号便于下次登录 */
export function clearSession(): void {
  Keychain.remove(K.kcToken)
  Keychain.remove(K.kcSessionId)
  Storage.set("ql_login_at", 0)
  Storage.set("ql_sid_exp", 0)
}
