/**
 * 协议配置与端点常量。
 *
 * 域名表来自 APK 内部资源 `assets/flutter_assets/resource/service_config.yaml`
 * （ServiceDomain.build 就是从它读取的），不是从二进制字符串里猜的。
 *
 * ─────────────────────────────────────────────────────────────
 * 两套通道，实测对比（2026-10-22，全部用无效数据探测）
 * ─────────────────────────────────────────────────────────────
 *
 * A. 网关通道（APK 用的）  https://gateway2.qinlinkeji.com/
 *    member/sms/sendSecurityCode   → 403 验签失败，缺少必须的签名字段
 *    open/doorcontrol/v2/open      → 403 同上
 *    member/sms/notexist           → 403 同上  ← 不存在的路径也一样
 *    foobar/notexist               → 401
 *    ⇒ member/* 与 open/* 是**前缀级**拦截，与路径是否存在无关；
 *      响应 content-type 是 text/plain 却返回 JSON，属于网关/WAF 层硬编码。
 *      Dart 层（123 个库）、native 库、assets 里都没有对应签名实现 → 纯 HTTP 过不去。
 *
 * B. mobileapi 通道（H5/老版本用的，来自 openh5 前端配置）
 *    window.domainUrl = "https://mobileapi.qinlinkeji.com/api/"
 *    window.openUrl   = "https://openapi.qinlinkeji.com/api/"
 *    window.gatewayUrl= "https://gateway.qinlinkeji.com/"
 *
 *    实测结果：
 *    POST /api/app/login  {mobile, smsCode}                    → 200 {"code":121,"message":"验证码已经过期…"}
 *    POST /api/app/login  {mobile:"1234"}                       → 200 {"code":121,"message":"手机号格式错误…"}
 *    POST /api/doorcontrol/v2/queryUserDoor?sessionId=test      → 200 {"code":401,"message":"您还没有登录…"}
 *    POST /api/doorcontrol/v2/open?sessionId=test               → 200 {"code":401,"message":"您还没有登录…"}
 *    POST /api/doorcontrol/v2/sort?sessionId=test               → 200 {"code":401,…}
 *
 *    ⇒ **完全不需要签名，只要合法的 sessionId**。这是可用通道。
 *
 * ─────────────────────────────────────────────────────────────
 * 唯一缺口：发送短信验证码
 * ─────────────────────────────────────────────────────────────
 * mobileapi 下 app/* 组里没有发码接口（app/sendSmsCode、app/sms/sendSecurityCode、
 * app/v1/sendSmsCode 等 20 余个候选全部 404），发码只在网关通道的
 * member/sms/sendSecurityCode（被 WAF 拦）。
 *
 * 因此流程是：**在原 App 里点一次「获取验证码」→ 手机收到 → 回本脚本填手机号+验证码**。
 * 登录后拿到的 sessionId 长期有效，日常开门不再需要验证码。
 */

/** mobileapi 通道（门禁/开门/短信登录）。注意是 mobileapi，不带 3。 */
export const H5_BASE = "https://mobileapi.qinlinkeji.com/api"
/** openapi 通道（h5/login 用 userId 换 sessionId）。注意是 openapi。 */
export const OPEN_BASE = "https://openapi.qinlinkeji.com/api"
/** 旧网关通道，仅作记录；member/ 与 open/ 前缀有 WAF 签名校验。 */
export const GATEWAY_BASE = "https://gateway2.qinlinkeji.com"

/**
 * sessionId 有效期实测 1800 秒（h5/login 返回的 expires 字段）。
 * 因此不是"永久有效"，需要在临近过期时用 userId 重新换。
 */
export const SESSION_TTL_SEC = 1800

/**
 * 以下常量来自 `Encryption.dart`（blutter 恢复），只对**网关通道**有效。
 * H5 通道不需要它们，保留是为了将来若拿到 WAF 请求头可切回。
 */
export const APP_ID = "gbDjIZQSOpCMX49P"
export const BIZ_SALT = "qiAnlPinP"
export const HEADER_SALT = "OKFoQ9MmNXQtcyXROo4PnaFkfDPTHuDg"
export const PARAM_AES_KEY = "91FC5A0CA0856C01A913CD77F21066AC"
export const SIGN_VERSION = "v2"

export type ApiConfig = {
  /** mobileapi 根地址（门禁/开门/短信登录） */
  baseURL: string
  /** openapi 根地址（userId 换 sessionId） */
  openURL: string
  /** 网关通道地址（当前不使用，留作对照） */
  baseURLGateway: string
  /**
   * 小区 id。`doorcontrol/*` 系列接口**必须**带它，且只能放在 query 里
   * （放 body 会 500 NumberFormatException）。
   *
   * 服务端在免签通道上没有"查我的社区"接口（已试 20+ 路径全部 404），
   * 所以这个值需要一次性提供。这里预置了上次使用的 7829，换小区时去「开发者」改。
   */
  communityId: string
  appId: string
  /** 业务签名盐值（&key=…），仅网关通道使用 */
  appSecret: string
  /** header 签名盐值（&appsecret=…），仅网关通道使用 */
  headerSecret: string
  aesKeyHex: string
  encryptBody: boolean
  aesHeaderName: string
  /** H5 通道应为 "none"；"header" 仅在走网关通道时需要 */
  signMode: "none" | "header"
  appVersion: string
  channel: string
  /** 额外请求头：JSON 或多行 `Key: Value`，抓包后粘贴 */
  extraHeaders: string
}

export const DEFAULT_CONFIG: ApiConfig = {
  baseURL: H5_BASE,
  openURL: OPEN_BASE,
  baseURLGateway: GATEWAY_BASE,
  // 预置当前小区：免签通道没有"查我的社区"接口，只能靠一次性提供。
  // 这个值来自广告请求 URL 里的 communityId=7829；换小区时去「开发者」页改。
  communityId: "7829",
  appId: APP_ID,
  appSecret: BIZ_SALT,
  headerSecret: HEADER_SALT,
  aesKeyHex: PARAM_AES_KEY,
  encryptBody: false,
  aesHeaderName: "AesHeader",
  signMode: "none",
  appVersion: "5.2.6",
  channel: "app",
  extraHeaders: "",
}

/**
 * 端点表。`base` 指明挂在哪条通道上（H5 的请求就是这么分散的：
 * doorcontrol 在 mobileapi，h5/login 在 openapi）。
 */
export type Endpoint = {
  path: string
  base?: "mobileapi" | "openapi"
  /** 是否需要把 sessionId 拼到 query */
  withSession?: boolean
}

export const EP = {
  /** 手机号 + 短信验证码登录。body: { mobile, smsCode } */
  login: { path: "app/login", base: "mobileapi" } as Endpoint,
  /** 用 userId 换 sessionId（不需要验证码，expires 1800s） */
  loginByUserId: { path: "h5/login", base: "openapi" } as Endpoint,
  /**
   * 门禁列表。用 queryUserDoorByCache（无 v2）—— 实测它返回的字段更全：
   * 多出 online/color/doorControlUsefor，且 hasBluetoothModule 与 v2 版不一致。
   */
  doorList: {
    path: "doorcontrol/queryUserDoorByCache",
    base: "mobileapi",
    withSession: true,
  } as Endpoint,
  /** 远程开门 */
  openDoor: { path: "doorcontrol/v2/open", base: "mobileapi", withSession: true } as Endpoint,
  /** 门禁排序 */
  doorSort: { path: "doorcontrol/v2/sort", base: "mobileapi", withSession: true } as Endpoint,
}

/** 门禁钥匙 */
export type DoorKey = {
  doorControlId: string
  doorControlName: string
  /** 门禁硬件 MAC，来自 queryUserDoor 的 macAddress */
  macAddress?: string
  /** 门是否带蓝牙模块（不同接口给的值不一致，以 queryUserDoorByCache 为准） */
  hasBluetoothModule?: boolean
  /** 在线状态，来自 queryUserDoorByCache：online / offline */
  online?: string
}

/** BLE 开门配置：UUID 与载荷都不在二进制里，必须抓包获取 */
export type BleSettings = {
  serviceUUID: string
  writeCharUUID: string
  notifyCharUUID: string
  matchName: string
  payloadTemplate: string
  payloadEncoding: "hex" | "text"
  timeoutMs: number
}

export const DEFAULT_BLE_SETTINGS: BleSettings = {
  // 从 blue_key_tools.dart 反汇编读出：Guid::toString() 后取子串与 "FFF0" / "FFF1" 比较，
  // 说明协议用的是 16-bit 标准 UUID 短格式，补全即得如下值。不是服务端下发。
  serviceUUID: "0000fff0-0000-1000-8000-00805f9b34fb",
  writeCharUUID: "0000fff1-0000-1000-8000-00805f9b34fb",
  notifyCharUUID: "",
  matchName: "",
  // 载荷帧结构来自 Encryption::onHandleResult / onEncrypt：
  //   帧头 FA34DD0001 + 业务数据 + 帧尾 55AA5A5AA5，再做 exclusiveOR 混淆
  // 中间字节的精确布局（doorControlId / 时间戳 / 命令字 FC26A 如何排列）尚未逐字节还原，
  // 因此这里只给出骨架；AES 密钥是 FBC213C4C7BEEBD2AA4EDBF0F681C41B。
  payloadTemplate: "FA34DD0001{doorControlId}55AA5A5AA5",
  payloadEncoding: "hex",
  timeoutMs: 12000,
}

/**
 * 构建标记。每次改动与小组件数据/渲染相关的代码都改一下这个串，
 * 小组件会把渲染时的标记写进 `ql_widget_diag`，App 里能直接看到
 * "桌面上那个小组件跑的是哪一版代码"——排查"改了却完全没变化"时，这一条最省事。
 */
export const BUILD_TAG = "2026-11-16-b"

/** 本地缓存键 */
export const K = {  config: "ql_config",
  ble: "ql_ble",
  doors: "ql_doors",
  /** 用户手动排序 + 收藏（与 doors 分开存，同步门禁不会覆盖它） */
  doorPrefs: "ql_door_prefs",
  /** 小组件每次渲染时写下的"我读到了什么"，用于排查 App / 小组件看到的数据不一致 */
  widgetDiag: "ql_widget_diag",
  phone: "ql_phone",
  kcToken: "ql_token",
  kcSessionId: "ql_session_id",
} as const

/** 小组件渲染快照指纹 */
export type WidgetDiag = {
  ts: number
  /** 本次渲染读到的门禁数量 */
  count: number
  ids: string[]
  names: string[]
  /** 渲染时用到的偏好规模，判断 prefs 是否也被读到了 */
  orderLen: number
  faveLen: number
  /** 脚本版本，确认小组件跑的是不是当前版本 */
  version: string
  /** 数据来源：App Group 文件 / 本地 Storage 兜底 */
  source: "file" | "storage"
}
