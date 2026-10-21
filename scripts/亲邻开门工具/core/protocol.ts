/**
 * 协议配置与端点常量。
 *
 * 端点全部来自二进制分析（blutter 恢复的字符串常量经度），路径是确定的。
 * 但「主机名 / 密钥用途 / 签名拼接顺序 / 响应包结构」在静态分析里拿不到，
 * 因此下面用 UNKNOWN 明确标注，并把它们做成用户可配置项。
 */

/** 域名来自 libapp.so 的字符串字面量（带尾部斜杠），路径字面量无前导斜杠，直接拼接 */
export const HOST_PROD = "https://qapp.qinlinkeji.com"
export const HOST_TEST = "https://test-qapp.qinlinkeji.com"

/** 从 `open/doorcontrol/v2/open` 等字符串看到的版本前缀形态 */
export type ApiConfig = {
  /** API 域名。原 App 里是 ServiceDomain.qapp，生产 https://qapp.qinlinkeji.com/ */
  baseURL: string
  /** 请求公共参数 */
  appId: string
  /** 签名盐值。原 App 在 libapp.so 里硬编码了一个 appsecret（见分析报告），
   *  这里不落盘：请在设置页自行填入，避免把第三方凭据写进源码。 */
  appSecret: string
  /** UNKNOWN：libapp.so 里两枚 32 位十六进制常量，用途（AES 密钥 / MD5 种子）未验证 */
  aesKeyHex: string
  /** 是否对请求体做 AES-128-ECB/PKCS5 加密（对应 FlutterAesEcbPkcs5） */
  encryptBody: boolean
  /** 加密结果的携带位置：UNKNOWN，header 名来自字符串 "AesHeader" */
  aesHeaderName: string
  /** 签名模式：none 或 md5（分析只看到 MD5 + sign/timestamp/nonce 参数名） */
  signMode: "none" | "md5"
  appVersion: string
  channel: string
}

export const DEFAULT_CONFIG: ApiConfig = {
  baseURL: HOST_PROD,
  appId: "",
  appSecret: "",
  aesKeyHex: "",
  encryptBody: false,
  aesHeaderName: "AesHeader",
  signMode: "none",
  appVersion: "5.2.6",
  channel: "app",
}

/**
 * 端点表 —— 每一条都能在 libapp.so 的字符串常量里找到原样路径。
 * 注释里给出分析来源。
 */
export const EP = {
  /** 手机号+验证码登录 */
  login: "app/api/app/v1/login",
  /** 登录态检查（保活用） */
  checkLogin: "app/v1/checkLogin",
  logout: "app/v1/logout",
  /** 发送短信验证码（Interface::interfaceSendValidCode） */
  sendValidCode: "app/api/app/v1/sendValidCode",
  /** 一键登录：取号 → 登录 */
  oneClickGetMobile: "app/api/app/v1/oneClick/getMobile",
  oneClickLogin: "app/api/app/v1/oneClick/login",
  /** 远程开门（核心） */
  openDoor: "open/doorcontrol/v2/open",
  /** 门禁排序，可用来拿门禁列表 */
  doorSort: "doorcontrol/v2/sort",
  /** 动态授权码 */
  dynamicAuthCode: "community/v2/getByDynamicAuthCode",
} as const

/** 门禁钥匙（对应分析里的 doorControlId / doorControlName） */
export type DoorKey = {
  doorControlId: string
  doorControlName: string
  /** 蓝牙 MAC / iOS 外设 UUID，分析里 BlueKeyTools 用它匹配设备 */
  deviceMac?: string
}

/** BLE 开门配置：UUID 与载荷都不在二进制里，必须由服务端下发或抓包获取 */
export type BleSettings = {
  serviceUUID: string
  writeCharUUID: string
  notifyCharUUID: string
  matchName: string
  /** 载荷模板，占位符 {doorControlId} {sessionId} {timestamp} */
  payloadTemplate: string
  payloadEncoding: "hex" | "text"
  timeoutMs: number
}

export const DEFAULT_BLE_SETTINGS: BleSettings = {
  serviceUUID: "",
  writeCharUUID: "",
  notifyCharUUID: "",
  matchName: "",
  payloadTemplate: "",
  payloadEncoding: "hex",
  timeoutMs: 12000,
}

/** 本地缓存键 */
export const K = {
  config: "ql_config",
  ble: "ql_ble",
  doors: "ql_doors",
  phone: "ql_phone",
  kcToken: "ql_token",
  kcSessionId: "ql_session_id",
} as const
