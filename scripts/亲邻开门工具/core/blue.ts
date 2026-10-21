/**
 * 蓝牙开门（BLE Central）。
 *
 * 平台能力来自本地文档：bluetooth/{central_manager,peripheral,service,characteristic}。
 * 这些类型是宿主注入的全局对象（文档示例未写 import），因此这里直接引用全局名。
 *
 * 与远程开门的差别：协议细节仍然未知，必须由用户/抓包提供——
 *   - serviceUUID / writeCharUUID：原 App 里没有硬编码字面量，由服务端下发
 *   - 写入载荷：是明文指令还是加密块，静态分析未确认
 * 所以本模块只负责「扫描 → 连接 → 发现 → 写入 → 等回执」这套确定的流程，
 * 具体 UUID 与字节由配置决定。
 */
export type BleConfig = {
  /** 目标服务 UUID，如 "180D" 或 "0000fee0-0000-1000-8000-00805f9b34fb" */
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
  serviceUUID: "",
  writeCharUUID: "",
  notifyCharUUID: "",
  matchName: "",
  timeoutMs: 12000,
  writeType: "withResponse",
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
    (s: any) => String(s.uuid).toLowerCase() === cfg.serviceUUID.toLowerCase()
  )
  if (!service) throw new Error(`未找到服务 ${cfg.serviceUUID}`)

  await withTimeout(matched.discoverCharacteristics(service), cfg.timeoutMs, "发现特征值")

  const writeChar = (service.characteristics ?? []).find(
    (c: any) => String(c.uuid).toLowerCase() === cfg.writeCharUUID.toLowerCase()
  )
  if (!writeChar) throw new Error(`未找到写入特征 ${cfg.writeCharUUID}`)

  // 有回执特征就先订阅，避免写入后拿不到开门结果
  let ack = ""
  if (cfg.notifyCharUUID) {
    const notifyChar = (service.characteristics ?? []).find(
      (c: any) => String(c.uuid).toLowerCase() === cfg.notifyCharUUID!.toLowerCase()
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
