/**
 * 3DES（Triple DES / TDEA）纯 TypeScript 实现 —— 零依赖。
 *
 * 精确复刻亲邻开门 APK 所用 flutter_3des_plugin 的 iOS 实现
 * （JKEncrypt.m → encrypt3DesStr:key:），包括它**非标准**的密钥构造与 hex 语义：
 *
 *   key24 = hexDecode24(keyHex + keyHex[0..16])   // keyHex 为 32 hex 时即 K1||K2||K1
 *   data  = hexDecode8(dataHex)                   // 固定 8 字节，不足补零
 *   ct    = 3DES-ECB-PKCS7-Encrypt(key24, data)   // 16 字节
 *   return lowercaseHex(ct)
 *
 * 引用：/tmp/3des-src/ios/Classes/JKEncrypt/JKEncrypt.m:144-196
 *       CCCrypt(kCCEncrypt, kCCAlgorithm3DES, kCCOptionECBMode|kCCOptionPKCS7Padding, ...)
 *
 * 反向（解密）同样提供，便于对拍与调试。
 */

/* ──────────────────────────── 位级工具 ──────────────────────────── */

/** 把字节数组按位展开成 0/1 数组（MSB first） */
function bytesToBits(src: Uint8Array): number[] {
  const out: number[] = []
  for (let i = 0; i < src.length; i++) {
    const b = src[i]
    for (let j = 7; j >= 0; j--) out.push((b >> j) & 1)
  }
  return out
}

/** 把 0/1 数组打包回字节数组（MSB first） */
function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(bits.length >> 3)
  for (let i = 0; i < out.length; i++) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]
    out[i] = v
  }
  return out
}

/** 按置换表置换比特序列。table 为 1-based 位序（FIPS 46-3 原样）。 */
function permute(bits: number[], table: number[]): number[] {
  const out = new Array<number>(table.length)
  for (let i = 0; i < table.length; i++) out[i] = bits[table[i] - 1]
  return out
}

function xorBits(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

/* ──────────────────────────── DES 常量表 ──────────────────────────── */

// 初始置换 IP（64 → 64）
const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
]

// 末置换 FP = IP⁻¹
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
]

// 扩展置换 E（32 → 48）
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
]

// P 盒（32 → 32）
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
]

// 密钥置换 PC-1（64 → 56）
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
]

// 密钥置换 PC-2（56 → 48）
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
]

// 每轮左移位数
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]

// 8 个 S 盒，每个 4 行 × 16 列（FIPS 46-3 原表）
const SBOX: number[][][] = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
]

/* ──────────────────────────── 密钥调度 ──────────────────────────── */

/** 由 8 字节 DES 密钥生成 16 轮子密钥（每轮 48 bit） */
function desKeySchedule(key8: Uint8Array): number[][] {
  const keyBits = permute(bytesToBits(key8), PC1) // 56 bit
  let c = keyBits.slice(0, 28)
  let d = keyBits.slice(28, 56)
  const rounds: number[][] = []
  for (let i = 0; i < 16; i++) {
    const s = SHIFTS[i]
    c = c.slice(s).concat(c.slice(0, s))
    d = d.slice(s).concat(d.slice(0, s))
    rounds.push(permute(c.concat(d), PC2)) // 48 bit
  }
  return rounds
}

/** 单轮 f 函数：E 扩展 → 与子密钥异或 → S 盒压缩 → P 置换 */
function desF(r32: number[], subkey: number[]): number[] {
  const expanded = permute(r32, E) // 48
  const xored = xorBits(expanded, subkey) // 48
  const sOut: number[] = []
  for (let i = 0; i < 8; i++) {
    const chunk = xored.slice(i * 6, i * 6 + 6)
    const row = (chunk[0] << 1) | chunk[5]
    const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4]
    const v = SBOX[i][row][col]
    sOut.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1)
  }
  return permute(sOut, P) // 32
}

/** DES 单块加密（8 字节 → 8 字节） */
export function desEncryptBlock(key8: Uint8Array, block8: Uint8Array): Uint8Array {
  return desCryptBlock(key8, block8, false)
}

/** DES 单块解密（8 字节 → 8 字节） */
export function desDecryptBlock(key8: Uint8Array, block8: Uint8Array): Uint8Array {
  return desCryptBlock(key8, block8, true)
}

function desCryptBlock(key8: Uint8Array, block8: Uint8Array, decrypt: boolean): Uint8Array {
  const rounds = desKeySchedule(key8)
  const bits = permute(bytesToBits(block8), IP) // 64
  let l = bits.slice(0, 32)
  let r = bits.slice(32, 64)
  for (let i = 0; i < 16; i++) {
    const subkey = rounds[decrypt ? 15 - i : i]
    const newL = r
    const newR = xorBits(l, desF(r, subkey))
    l = newL
    r = newR
  }
  return bitsToBytes(permute(r.concat(l), FP)) // 注意最后左右交换
}

/* ──────────────────────────── 3DES (EDE3) ──────────────────────────── */

/**
 * 3DES 单块加密：E(K1) → D(K2) → E(K3)。
 * key24 为 24 字节；若只需 2-key 变体，令 K3 = K1。
 */
export function tripleDesEncryptBlock(key24: Uint8Array, block8: Uint8Array): Uint8Array {
  const k1 = key24.subarray(0, 8)
  const k2 = key24.subarray(8, 16)
  const k3 = key24.subarray(16, 24)
  const t1 = desEncryptBlock(k1, block8)
  const t2 = desDecryptBlock(k2, t1)
  return desEncryptBlock(k3, t2)
}

/** 3DES 单块解密：D(K3) → E(K2) → D(K1) */
export function tripleDesDecryptBlock(key24: Uint8Array, block8: Uint8Array): Uint8Array {
  const k1 = key24.subarray(0, 8)
  const k2 = key24.subarray(8, 16)
  const k3 = key24.subarray(16, 24)
  const t1 = desDecryptBlock(k3, block8)
  const t2 = desEncryptBlock(k2, t1)
  return desDecryptBlock(k1, t2)
}

/* ──────────────────────────── PKCS7 填充 ──────────────────────────── */

export function pkcs7Pad(data: Uint8Array, blockSize = 8): Uint8Array {
  const pad = blockSize - (data.length % blockSize)
  const out = new Uint8Array(data.length + pad)
  out.set(data)
  out.fill(pad, data.length)
  return out
}

export function pkcs7Unpad(data: Uint8Array, blockSize = 8): Uint8Array {
  if (data.length === 0 || data.length % blockSize !== 0) {
    throw new Error("PKCS7: 密文长度不是块大小的整数倍")
  }
  const pad = data[data.length - 1]
  if (pad < 1 || pad > blockSize) throw new Error("PKCS7: 填充字节非法")
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) throw new Error("PKCS7: 填充内容非法")
  }
  return data.subarray(0, data.length - pad)
}

/* ────────────────────── 复刻 flutter_3des_plugin 的 hex 语义 ────────────────────── */

/** 小写 hex 编码（对应 convertDataToHexStr） */
export function toHex(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0")
  return s
}

/**
 * 对应 byteForHexString：固定产出 8 字节。
 * 按每 2 个 hex 字符解析 1 字节；不足 8 字节补零，超出则忽略（原 C 代码是栈溢出，这里安全截断）。
 */
export function hexToBytes8(hex: string): Uint8Array {
  const out = new Uint8Array(8)
  const n = Math.min(8, hex.length >> 1)
  for (let i = 0; i < n; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16) & 0xff
  return out
}

/**
 * 对应 byte24ForHexString：固定产出 24 字节，不足补零、超出截断。
 */
export function hexToBytes24(hex: string): Uint8Array {
  const out = new Uint8Array(24)
  const n = Math.min(24, hex.length >> 1)
  for (let i = 0; i < n; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16) & 0xff
  return out
}

/**
 * 对应 JKEncrypt.m 的密钥构造：
 *   byte24ForHexString(keyHex + keyHex[0..16])
 * 当 keyHex 为 32 hex（16 字节）时，等价于 K1 || K2 || K1。
 */
export function deriveKey24(keyHex: string): Uint8Array {
  const prefix = keyHex.length >= 16 ? keyHex.substring(0, 16) : keyHex
  return hexToBytes24(keyHex + prefix)
}

/* ────────────────────── 顶层 API（与 Flutter3desPlugin.encrypt 对齐） ────────────────────── */

/**
 * 加密 —— 与原 App 的 `Flutter3desPlugin.encrypt(key, data)` 完全一致。
 *
 * @param keyHex  十六进制密钥字符串（原 App 用 32 位，如 FBC213C4…C41B）
 * @param dataHex 十六进制明文（原 C 代码只取前 16 位 = 8 字节）
 * @returns 小写十六进制密文（PKCS7 填充后 16 字节 = 32 hex）
 */
export function encrypt3DesHex(keyHex: string, dataHex: string): string {
  const key24 = deriveKey24(keyHex)
  const plain = hexToBytes8(dataHex)
  const padded = pkcs7Pad(plain, 8)
  const out = new Uint8Array(padded.length)
  for (let i = 0; i < padded.length; i += 8) {
    out.set(tripleDesEncryptBlock(key24, padded.subarray(i, i + 8)), i)
  }
  return toHex(out)
}

/**
 * 解密 —— 逆操作，便于对拍与调试。原 App 只用加密。
 */
export function decrypt3DesHex(keyHex: string, ctHex: string): string {
  const key24 = deriveKey24(keyHex)
  const ct = hexToBytes24(ctHex) // 复用 24 字节容量，足够 16 字节密文
  const realLen = Math.min(ctHex.length >> 1, ct.length)
  const blocks = new Uint8Array(realLen - (realLen % 8))
  blocks.set(ct.subarray(0, blocks.length))
  const out = new Uint8Array(blocks.length)
  for (let i = 0; i < blocks.length; i += 8) {
    out.set(tripleDesDecryptBlock(key24, blocks.subarray(i, i + 8)), i)
  }
  return toHex(pkcs7Unpad(out, 8))
}

/* ────────────────────── 通用 3DES-ECB（供需要原始字节的场景） ────────────────────── */

/** 3DES-ECB-PKCS7 加密任意长度字节（不限于 8 字节） */
export function tripleDesEcbEncrypt(key24: Uint8Array, data: Uint8Array): Uint8Array {
  const padded = pkcs7Pad(data, 8)
  const out = new Uint8Array(padded.length)
  for (let i = 0; i < padded.length; i += 8) {
    out.set(tripleDesEncryptBlock(key24, padded.subarray(i, i + 8)), i)
  }
  return out
}

/** 3DES-ECB-PKCS7 解密任意长度字节 */
export function tripleDesEcbDecrypt(key24: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i += 8) {
    out.set(tripleDesDecryptBlock(key24, data.subarray(i, i + 8)), i)
  }
  return pkcs7Unpad(out, 8)
}
