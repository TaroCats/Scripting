/**
 * 加密与签名。
 *
 * 算法来自 libapp.so 的 `qinlin/utils/Encryption.dart`（blutter 恢复的汇编）：
 *   onAsciiSort     → 业务参数 ASCII 排序，`k=v` 用 `&` 连接，尾部加 `&key=qiAnlPinP`
 *   fixedParameter  → 补 version / timestamp / nonce / token / sessionId
 *   md5Encrypt      → 对上面拼出的串取 MD5，得到业务 sign
 *   getHeaderSign   → header map { appid, nonce, timestamp, version:"v2" }
 *                     排序后加 `&appsecret=OKFoQ9...` 再取 MD5
 *   aesEncryptParams→ 参数 AES-128-ECB，密钥 91FC5A0C...
 *
 * 仍在猜的部分：业务 sign 与 header sign 是否互相包含、AES 密文放 body 还是 header。
 * 这两点都收敛在本文件 + api.ts，实测后单点改。
 */
import { aes128EcbEncryptBytes, hexToBytes, utf8Bytes } from "./aes"
import { SIGN_VERSION, type ApiConfig } from "./protocol"

export function md5Hex(input: string): string {
  const data = Data.fromRawString(input, "utf8")
  if (!data) throw new Error("无法构造请求明文 Data")
  return Crypto.md5(data).toHexString()
}

/** 4 位随机数字串，对应 Encryption::randomNumber4 */
export function randomNumber4(): string {
  return String(Math.floor(Math.random() * 9000) + 1000)
}

/** 微秒时间戳 —— 原 App 用 DateTime.microsecondsSinceEpoch，不是毫秒 */
export function timestampMicros(): string {
  return String(Date.now() * 1000)
}

function asciiJoin(params: Record<string, string>, skip: string[]): string {
  return Object.keys(params)
    .filter(k => !skip.includes(k) && params[k] !== "" && params[k] != null)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&")
}

/** 业务参数签名：ASCII 排序 + `&key=<BIZ_SALT>` → MD5（salt 存在 cfg.appSecret） */
export function signParams(params: Record<string, string>, cfg: ApiConfig): string {
  const body = asciiJoin(params, ["sign"])
  return md5Hex(`${body}&key=${cfg.appSecret}`)
}

/**
 * header 签名：`{appid, nonce, timestamp, version}` 排序拼接，尾部 `&appsecret=<HEADER_SALT>`。
 * HEADER_SALT 与业务 salt 不同，由调用方传入。
 */
export function signHeader(
  header: Record<string, string>,
  appSecretForHeader: string
): string {
  return md5Hex(`${asciiJoin(header, ["sign"])}&appsecret=${appSecretForHeader}`)
}

export function encryptBodyToBase64(plain: string, cfg: ApiConfig): string {
  const key = hexToBytes(cfg.aesKeyHex)
  const bytes = aes128EcbEncryptBytes(key, utf8Bytes(plain))
  const data = Data.fromUint8Array(bytes)
  if (!data) throw new Error("无法构造密文 Data")
  return data.toBase64String()
}

export { SIGN_VERSION }
