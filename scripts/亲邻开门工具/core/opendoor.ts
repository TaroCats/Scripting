/**
 * 开门状态机。
 *
 * 按分析出的原 App 策略复刻：
 *   checkoutBlueOpenDoor：远程失败 → 「远程开门失败，正尝试蓝牙开门」→ blueOpenDoor
 *
 * 现在两条路都能走：
 *   - 远程：open/doorcontrol/v2/open
 *   - 蓝牙：BLE 扫描/连接/写入（UUID 与载荷需在设置页配置，协议细节未从二进制拿到）
 * 蓝牙未配置时不会假装成功，直接说明缺什么。
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

export async function openDoor(
  key: DoorKey,
  opt: RequestOptions,
  ble: BleSettings,
  hooks: OpenHooks = {}
): Promise<OpenOutcome> {
  const step = (s: string, d?: string) => hooks.onStep?.(s, d)

  // 1) 远程优先
  try {
    step("remote", key.doorControlName)
    const env = await openDoorRemote(key.doorControlId, opt)
    const name = env.data?.doorControlName ?? key.doorControlName
    const state = env.data?.openDoorState
    return {
      ok: true,
      via: "remote",
      message: `已开门 · ${name}${state != null ? `（openDoorState=${state}）` : ""}`,
      raw: env.raw,
    }
  } catch (e) {
    // 会话失效必须冒泡，由上层强制登出
    if (e instanceof SessionExpiredError) throw e
    const reason = e instanceof Error ? e.message : String(e)

    // 2) 蓝牙兜底
    if (!bleReady(ble)) {
      return {
        ok: false,
        via: "none",
        message: `${reason}；蓝牙兜底未配置（需要 serviceUUID / writeCharUUID / 载荷模板）`,
      }
    }
    step("ble", "远程失败，转蓝牙")
    try {
      const payload = buildPayload(ble.payloadTemplate, ble.payloadEncoding, {
        doorControlId: key.doorControlId,
        sessionId: opt.session?.sessionId ?? "",
        timestamp: String(Date.now()),
      })
      const msg = await bleOpenDoor(toBleConfig(ble), payload, {
        onStep: (s: BleStep, d?: string) => step(`ble:${s}`, d),
      })
      return { ok: true, via: "ble", message: `${reason}；${msg}` }
    } catch (bleErr) {
      const bleReason = bleErr instanceof Error ? bleErr.message : String(bleErr)
      return { ok: false, via: "none", message: `${reason}；蓝牙也失败：${bleReason}` }
    }
  }
}
