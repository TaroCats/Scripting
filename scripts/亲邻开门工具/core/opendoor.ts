/**
 * 开门状态机 —— 蓝牙优先，远程兜底。
 *
 * 1) 蓝牙直连（该门有蓝牙模块且已配置 UUID/载荷时）
 * 2) 远程开门（open/doorcontrol/v2/open）
 *
 * 蓝牙未配置或该门无蓝牙模块时直接跳到远程，不假装成功。
 */
import { openDoorRemote, SessionExpiredError, type RequestOptions } from "./api"
import { bleOpenDoor, buildPayload, type BleConfig, type BleStep } from "./blue"
import type { BleSettings, DoorKey } from "./protocol"

export type OpenVia = "remote" | "ble" | "none"

export type OpenOutcome = {
  ok: boolean
  via: OpenVia
  message: string
  raw?: any
}

export type OpenHooks = {
  onStep?: (stage: string, detail?: string) => void
}

function toBleConfig(s: BleSettings): BleConfig {
  return {
    serviceUUID: s.serviceUUID.trim(),
    writeCharUUID: s.writeCharUUID.trim(),
    notifyCharUUID: s.notifyCharUUID.trim(),
    matchName: s.matchName.trim(),
    timeoutMs: s.timeoutMs,
    writeType: "withResponse",
  }
}

function bleReady(s: BleSettings): boolean {
  return Boolean(s.serviceUUID.trim() && s.writeCharUUID.trim() && s.payloadTemplate.trim())
}

/**
 * openDoorState 取值含义 —— 从 `qinlin/widgets/dialog/tip_dialog.dart` 反汇编读出：
 *
 *   cmp w1, #2   ; Dart Smi 编码，实际值 1
 *   b.eq  成功
 *   cmp w1, #6   ; 实际值 3
 *   b.ne  其他
 *   成功: r2 = "开门成功"
 *   tbnz w1, #4  ; bit4 相当于数值 8 的分界
 *   r1 = "远程开门失败"   (state < 8)
 *   r1 = "开门失败"       (state >= 8)
 *
 * 另一处文案分支用同一个 bit4 区分「门禁设备离线」与「没有开门成功？」。
 */
export function interpretState(state: unknown): { ok: boolean; text: string } {
  const n = Number(state)
  if (n === 1) return { ok: true, text: "开门成功" }
  if (n === 3) return { ok: true, text: "开门成功（门已处于开启状态）" }
  if (n === 7) return { ok: false, text: "门禁设备离线" }
  if (Number.isFinite(n) && n >= 8) return { ok: false, text: `开门失败（openDoorState=${n}）` }
  if (state == null || state === "") return { ok: true, text: "请求已下发（无状态码）" }
  return { ok: false, text: `未知状态 openDoorState=${String(state)}` }
}

export async function openDoor(
  key: DoorKey,
  opt: RequestOptions,
  ble: BleSettings,
  hooks: OpenHooks = {}
): Promise<OpenOutcome> {
  const step = (s: string, d?: string) => hooks.onStep?.(s, d)

  const useBle = key.hasBluetoothModule !== false && bleReady(ble)

  // ── 1) 蓝牙优先 ──
  if (useBle) {
    step("ble", key.doorControlName)
    try {
      const payload = buildPayload(ble.payloadTemplate, ble.payloadEncoding, {
        doorControlId: key.doorControlId,
        sessionId: opt.session?.sessionId ?? "",
        timestamp: String(Date.now()),
      })
      const msg = await bleOpenDoor(toBleConfig(ble), payload, {
        onStep: (s: BleStep, d?: string) => step(`ble:${s}`, d),
      })
      return { ok: true, via: "ble", message: `${msg} · ${key.doorControlName}` }
    } catch (e) {
      if (e instanceof SessionExpiredError) throw e
      const bleReason = e instanceof Error ? e.message : String(e)
      step("ble-fail", bleReason)
      // 蓝牙失败 → 转远程
      try {
        const env = await openDoorRemote(
          { doorControlId: key.doorControlId, macAddress: key.macAddress },
          opt
        )
        const name = env.data?.doorControlName ?? key.doorControlName
        const verdict = interpretState(env.data?.openDoorState)
        if (verdict.ok) {
          return {
            ok: true,
            via: "remote",
            message: `${verdict.text} · ${name}（蓝牙失败后远程成功）`,
            raw: env.raw,
          }
        }
        return {
          ok: false,
          via: "none",
          message: `蓝牙失败（${bleReason}）；远程也失败：${verdict.text}`,
        }
      } catch (remoteErr) {
        if (remoteErr instanceof SessionExpiredError) throw remoteErr
        const remoteReason = remoteErr instanceof Error ? remoteErr.message : String(remoteErr)
        return {
          ok: false,
          via: "none",
          message: `蓝牙失败（${bleReason}）；远程失败：${remoteReason}`,
        }
      }
    }
  }

  // ── 2) 无蓝牙或未配置 → 直接远程 ──
  const skipReason = key.hasBluetoothModule === false
    ? "该门无蓝牙模块"
    : "蓝牙未配置（需 serviceUUID / writeCharUUID / 载荷模板）"
  step("remote", `${key.doorControlName}（${skipReason}，跳过蓝牙）`)
  try {
    const env = await openDoorRemote(
      { doorControlId: key.doorControlId, macAddress: key.macAddress },
      opt
    )
    const name = env.data?.doorControlName ?? key.doorControlName
    const verdict = interpretState(env.data?.openDoorState)
    if (verdict.ok) {
      return { ok: true, via: "remote", message: `${verdict.text} · ${name}`, raw: env.raw }
    }
    return { ok: false, via: "none", message: `${name}：${verdict.text}` }
  } catch (e) {
    if (e instanceof SessionExpiredError) throw e
    const reason = e instanceof Error ? e.message : String(e)
    return { ok: false, via: "none", message: reason }
  }
}
