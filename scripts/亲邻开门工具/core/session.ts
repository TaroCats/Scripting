/**
 * 会话管理。
 *
 * 对齐分析结论：
 * - 登录成功后统一由一处落地 token/sessionId（原 App 是 UserManager::loginSuccess）
 * - 蓝牙开关门依赖本地缓存的 sessionId，过期即强制登出
 *   （原 App：blue_key_tools.dart 「蓝牙开门，本地缓存的sessionId过期强制退出登录」）
 */
import { K } from "./protocol"

export type Session = {
  token: string
  sessionId: string
  phone: string
  loginAt: number
}

export function loadSession(): Session | null {
  const token = Keychain.get(K.kcToken)
  if (!token) return null
  return {
    token,
    sessionId: Keychain.get(K.kcSessionId) ?? "",
    phone: (Storage.get<string>(K.phone) as string) ?? "",
    loginAt: (Storage.get<number>("ql_login_at") as number) ?? 0,
  }
}

export function saveSession(input: {
  token: string
  sessionId?: string
  phone?: string
}): Session {
  // first_unlock_this_device：重启后首次解锁即可读，不迁移到其他设备。
  // 会话要"长久不过期"，靠的就是这个 + 服务端 token 本身的有效期。
  const opts = { accessibility: "first_unlock_this_device" as const, synchronizable: false }
  Keychain.set(K.kcToken, input.token, opts)
  if (input.sessionId) Keychain.set(K.kcSessionId, input.sessionId, opts)
  if (input.phone) Storage.set(K.phone, input.phone)
  Storage.set("ql_login_at", Date.now())
  return loadSession()!
}

/** 强制登出：清空 token/sessionId，保留手机号便于下次登录 */
export function clearSession(): void {
  Keychain.remove(K.kcToken)
  Keychain.remove(K.kcSessionId)
  Storage.set("ql_login_at", 0)
}
