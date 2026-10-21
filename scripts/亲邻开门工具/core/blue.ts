/**
 * 蓝牙开门（BLE Central）。
 *
 * 平台能力来自本地文档：bluetooth/{central_manager,peripheral,service,characteristic}。
 * 这些类型是宿主注入的全局对象（文档示例未写 import），因此这里直接引用全局名。
 *
 * 协议细节（`Encryption.dart` 的 `onEncrypt` / `onHandleResult` 反汇编还原，**不是**服务端下发）：
 *   - Service UUID 判定值 "FFF0"、Characteristic "FFF1"（16-bit 短格式）
 *   - 明文 = 4 组「字段 + padLeft(2,'0') 的 DateTime 日期分量」+ 帧尾 "55AA5A5AA5"
 *   - 用 **3DES** 加密（flutter_3des_plugin::encrypt，不是 AES）
 *   - 再拼帧头 "FA34DD0001" + 密文 + "30" + exclusiveOR(补零至 32)，
 *     按 "0x??" 两位转成 List<int> 写入
 *   - 密钥串以 "FC26A" 开头（randomNumberWithCount 生成）
 * 中间 4 个业务字段的语义（doorControlId 如何编码）仍需逐条对照拼接处。
 */
import { encrypt3DesHex } from "./tripledes"

export type BleConfig = {
  /** 目标服务 UUID，如 "0000fff0-0000-1000-8000-00805f9b34fb" 或短格式 "FFF0" */
  serviceUUID: string
  /** 写入特征 UUID */
  writeCharUUID: string
  /** 可选：回执通知特征 UUID；留空则不等待回执 */
  notifyCharUUID?: string
  /** 可选：按广播名过滤，留空则取第一个可连接设备 */
  matchName?: string
  /** 单步超时（毫秒） */
  timeoutMs: number
  /** 写入类型 */
  writeType: "withResponse" | "withoutResponse"
}

export const DEFAULT_BLE: BleConfig = {
  serviceUUID: "0000fff0-0000-1000-8000-00805f9b34fb",
  writeCharUUID: "0000fff1-0000-1000-8000-00805f9b34fb",
  notifyCharUUID: "",
  matchName: "",
  timeoutMs: 12000,
  writeType: "withResponse",
}

/**
 * UUID 比较，容忍短/长格式与大小写差异：
 * CoreBluetooth 返回完整 UUID（0000fff0-0000-1000-8000-00805f9b34fb），
 * 协议里写的是 16-bit 短格式（FFF0）。
 */
export function sameUuid(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^0-9a-f]/g, "")
      .replace(/^0000/, "")
      .replace(/00805f9b34fb$/, "")
  const na = norm(a)
  const nb = norm(b)
  return !!na && na === nb
}

export type BleStep =
  | "scanning"
  | "connecting"
  | "discovering"
  | "writing"
  | "waiting-ack"
  | "done"

export type BleHooks = {
  onStep?: (step: BleStep, detail?: string) => void
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms)
    p.then(
      v => {
        clearTimeout(timer)
        resolve(v)
      },
      e => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/**
 * 载荷构造：支持 hex 与文本模板。
 * 模板占位符：{doorControlId} {sessionId} {timestamp}
 */
export function buildPayload(
  template: string,
  encoding: "hex" | "text",
  vars: Record<string, string>
): Data {
  let s = template
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(v)
  }
  const data = encoding === "hex" ? Data.fromHexString(s) : Data.fromRawString(s, "utf8")
  if (!data) throw new Error(`载荷构造失败（encoding=${encoding}）: ${s.slice(0, 40)}`)
  return data
}

/* ────────────── 3DES 加密帧（复刻 onEncrypt / flutter_3des_plugin） ────────────── */

/** 帧常量 —— 全部来自 Encryption.dart 的 onEncrypt 字面量 */
export const FRAME = {
  /** 密文前缀 */
  header: "FA34DD0001",
  /** 明文尾 */
  tail: "55AA5A5AA5",
  /** 密文后缀前的固定串 */
  mid: "30",
  /** exclusiveOR 补零的目标长度（hex 字符数） */
  xorPadLen: 32,
} as const

/**
 * 用 3DES 加密一段 hex 明文，返回 `FA34DD0001 + 密文 + 30 + xor(补零到 32)` 的 hex 串。
 *
 * 对应原 App 的 `Flutter3desPlugin.encrypt(key, data)` + onEncrypt 的最终拼接。
 *
 * @param keyHex  32 位 hex 密钥（内部会按 K1||K2||K1 扩展成 24 字节）
 * @param dataHex 明文 hex（只取前 16 位 = 8 字节，与原 C 代码一致）
 * @param xorHex  exclusiveOR 混淆值；留空则用全零补到 32 位
 */
export function buildEncryptedFrame(
  keyHex: string,
  dataHex: string,
  xorHex = ""
): Data {
  const ct = encrypt3DesHex(keyHex, dataHex)
  const xor = (xorHex || "0".repeat(FRAME.xorPadLen)).toLowerCase()
  const padded = xor.length >= FRAME.xorPadLen
    ? xor.slice(0, FRAME.xorPadLen)
    : xor + "0".repeat(FRAME.xorPadLen - xor.length)
  const frame = FRAME.header + ct + FRAME.mid + padded
  const data = Data.fromHexString(frame)
  if (!data) throw new Error("帧构造失败：" + frame.slice(0, 40))
  return data
}

export async function bleOpenDoor(
  cfg: BleConfig,
  payload: Data,
  hooks: BleHooks = {}
): Promise<string> {
  const step = hooks.onStep ?? (() => {})
  if (!cfg.serviceUUID || !cfg.writeCharUUID) {
    throw new Error("缺少 BLE serviceUUID / writeCharUUID（设置页填写，或抓包获取）")
  }

  step("scanning", `服务 ${cfg.serviceUUID}`)

  const matched = await withTimeout(
    new Promise<any>((resolve, reject) => {
      let done = false
      BluetoothCentralManager.startScan(
        (peripheral: any, adv: any) => {
          if (done) return
          const name: string | null = peripheral?.name ?? adv?.localName ?? null
          if (cfg.matchName && name !== cfg.matchName) return
          if (adv?.isConnectable === false) return
          done = true
          BluetoothCentralManager.stopScan()
          resolve(peripheral)
        },
        { services: [cfg.serviceUUID], allowDuplicates: false }
      ).catch(reject)
    }),
    cfg.timeoutMs,
    "扫描设备"
  )

  if (!matched) throw new Error("未发现目标门禁设备")

  step("connecting", matched.name ?? matched.id)
  await withTimeout(BluetoothCentralManager.connect(matched, { enableAutoReconnect: true }), cfg.timeoutMs, "连接设备")

  step("discovering")
  await withTimeout(matched.discoverServices(), cfg.timeoutMs, "发现服务")

  const service = (matched.services ?? []).find(
    (s: any) => sameUuid(String(s.uuid), cfg.serviceUUID)
  )
  if (!service) throw new Error(`未找到服务 ${cfg.serviceUUID}`)

  await withTimeout(matched.discoverCharacteristics(service), cfg.timeoutMs, "发现特征值")

  const writeChar = (service.characteristics ?? []).find(
    (c: any) => sameUuid(String(c.uuid), cfg.writeCharUUID)
  )
  if (!writeChar) throw new Error(`未找到写入特征 ${cfg.writeCharUUID}`)

  // 有回执特征就先订阅，避免写入后拿不到开门结果
  let ack = ""
  if (cfg.notifyCharUUID) {
    const notifyChar = (service.characteristics ?? []).find(
      (c: any) => sameUuid(String(c.uuid), cfg.notifyCharUUID!)
    )
    if (notifyChar) {
      await matched.subscribe(notifyChar, (data: Data) => {
        ack = data.toHexString()
      })
    }
  }

  step("writing", `${writeChar.properties?.join("/") ?? ""}`)
  const writeType =
    cfg.writeType === "withoutResponse" && writeChar.properties?.includes("writeWithoutResponse")
      ? "withoutResponse"
      : "withResponse"
  await withTimeout(matched.writeValue(writeChar, payload, writeType), cfg.timeoutMs, "写入开门指令")

  if (cfg.notifyCharUUID) {
    step("waiting-ack")
    const deadline = Date.now() + Math.min(cfg.timeoutMs, 5000)
    while (!ack && Date.now() < deadline) {
      await new Promise<void>(r => setTimeout(r, 150))
    }
  }

  step("done")
  await BluetoothCentralManager.disconnect(matched).catch(() => {})
  return ack ? `蓝牙开门完成，回执 ${ack}` : "蓝牙开门指令已写入（未取回执）"
}
