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

/**
 * 以下三个常量来自 `Encryption.dart` 的真实实现（blutter 恢复）：
 * - APP_ID      : getHeaderSign 里 header map 的 "appid" 值
 * - BIZ_SALT    : onAsciiSort 拼接尾部 "&key=qiAnlPinP"
 * - HEADER_SALT : getHeaderSign 拼接尾部 "&appsecret=OKFoQ9..."
 */
export const APP_ID = "gbDjIZQSOpCMX49P"
export const BIZ_SALT = "qiAnlPinP"
export const HEADER_SALT = "OKFoQ9MmNXQtcyXROo4PnaFkfDPTHuDg"
/** aesEncryptParams 使用的密钥（32 hex = AES-128） */
export const PARAM_AES_KEY = "91FC5A0CA0856C01A913CD77F21066AC"
/** header 里 version 固定为 v2 */
export const SIGN_VERSION = "v2"

/** 从 `open/doorcontrol/v2/open` 等字符串看到的版本前缀形态 */
export type ApiConfig = {
  /** API 域名。原 App 里是 ServiceDomain.qapp，生产 https://qapp.qinlinkeji.com/ */
  baseURL: string
  /** appid，默认已填分析得到的值 */
  appId: string
  /** 业务签名盐值（&key=...），默认已填；可在设置页覆盖 */
  appSecret: string
  /** header 签名盐值（&appsecret=...），与业务盐不同，默认已填 */
  headerSecret: string
  /** 参数加密密钥（32 hex），默认已填；仅在 encryptBody 打开时使用 */
  aesKeyHex: string
  /** 是否对请求体做 AES-128-ECB/PKCS5 加密（对应 aesEncryptParams） */
  encryptBody: boolean
  /** 加密结果的携带位置：UNKNOWN，header 名来自字符串 "AesHeader" */
  aesHeaderName: string
  /** 签名模式：none 或 header（appid/nonce/timestamp/version + MD5） */
  signMode: "none" | "header"
  appVersion: string
  channel: string
}

export const DEFAULT_CONFIG: ApiConfig = {
  baseURL: HOST_PROD,
  appId: APP_ID,
  appSecret: BIZ_SALT,
  headerSecret: HEADER_SALT,
  aesKeyHex: PARAM_AES_KEY,
  encryptBody: false,
  aesHeaderName: "AesHeader",
  signMode: "header",
  appVersion: "5.2.6",
  channel: "app",
}

/**
 * 端点表 —— 每一条都能在 libapp.so 的字符串常量里找到原样路径。
 * `sendValidCode` 曾误写为 app/api/app/v1/sendValidCode（按函数名猜的），
 * 实际来自 Interface::interfaceSendValidCode 函数体：`member/sms/sendSecurityCode`。
 */
export const EP = {
  /** 手机号+验证码登录 */
  login: "app/api/app/v1/login",
  /** 登录态检查（保活用） */
  checkLogin: "app/v1/checkLogin",
  logout: "app/v1/logout",
  /** 发送短信验证码 —— 真实路径，之前猜错导致 404 */
  sendValidCode: "member/sms/sendSecurityCode",
  /** 换绑手机号的验证码（同族接口） */
  sendValidCodeForChangePhone: "member/sms/sendSecurityCodeForChangePhone",
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
