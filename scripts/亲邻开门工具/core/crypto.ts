/**
 * 加密与签名。
 *
 * - MD5：宿主 Crypto.md5(data: Data): Data（官方 API）
 * - AES-128-ECB/PKCS5：./aes.ts（宿主只提供 AES-GCM，不提供 ECB）
 * - Base64：Data.fromUint8Array(...).toBase64String()（官方 API）
 */
import { aes128EcbEncryptBytes, hexToBytes, utf8Bytes } from "./aes"
import type { ApiConfig } from "./protocol"

export function md5Hex(input: string): string {
  const data = Data.fromRawString(input, "utf8")
  if (!data) throw new Error("无法构造请求明文 Data")
  return Crypto.md5(data).toHexString()
}

/**
 * 签名：key 字典序拼 a=1&b=2，尾缀 appsecret，取 MD5。
 * 拼接顺序在静态分析里属 UNKNOWN（只见到 sign/timestamp/nonce/appId 参数名），
 * 全部收敛在此函数，实测后可单点修正。
 */
export function signParams(params: Record<string, string>, cfg: ApiConfig): string {
  const body = Object.keys(params)
    .filter(k => k !== "sign" && params[k] !== "")
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&")
  return md5Hex(`${body}&appsecret=${cfg.appSecret}`)
}

export function encryptBodyToBase64(plain: string, cfg: ApiConfig): string {
  const key = hexToBytes(cfg.aesKeyHex)
  const bytes = aes128EcbEncryptBytes(key, utf8Bytes(plain))
  const data = Data.fromUint8Array(bytes)
  if (!data) throw new Error("无法构造密文 Data")
  return data.toBase64String()
}
