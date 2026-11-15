# HKDF 与 ChaCha20-Poly1305

## 导入与运行方式

下面两个示例均为完整、独立的 App 普通脚本。从内置 `node:crypto` 导入 `webcrypto` 即可，无需安装 npm 包；全局小写 `crypto` 提供同一 WebCrypto 对象，也可直接使用而不导入。`TextEncoder`、`TextDecoder`、`console` 均为全局对象，不要从 `scripting` 导入。全局大写 `Crypto` 是另一套基于 Data 的 API，见 [Crypto](../crypto/zh.md)。

HKDF 示例派生受保护的 AES 密钥并输出解密后的 `hello`；ChaCha 示例输出解密后的 `message`。示例自行生成密钥材料和 nonce/IV；实际协议需使用双方约定的输入密钥、salt、info，并随密文单独保存/传输 nonce/IV。

## HKDF

```ts
import { webcrypto } from "node:crypto"

async function main() {
  // Alternatively use the global crypto.subtle with no import.
  const input = webcrypto.getRandomValues(new Uint8Array(32))
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const subtle = webcrypto.subtle
  const material = await subtle.importKey("raw", input, "HKDF", false, ["deriveKey"])
  const key = await subtle.deriveKey({
    name: "HKDF", hash: "SHA-512", salt,
    info: new TextEncoder().encode("Scripting HKDF demo"),
  }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const encrypted = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("hello"))
  const decrypted = await subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted)
  console.log(new TextDecoder().decode(decrypted)) // hello
}

void main()
```

HKDF 支持 raw 密钥导入和 SHA-256、SHA-384、SHA-512。导入密钥必须不可导出，用途只能为 `deriveBits`、`deriveKey` 或两者；不支持生成或导出 HKDF 密钥。`salt`、`info` 必须提供，可为空。输入密钥、salt、info 各限 1 MiB，正确处理 ArrayBuffer、TypedArray、DataView 的字节偏移，不支持共享缓冲区。

`deriveBits` 长度必须为正数且是 8 的倍数，输出最多为 `255 × 哈希长度` 字节：分别为 8,160、12,240、16,320 字节。长度为 0、null 或省略时抛出 `OperationError`。`deriveKey` 支持 AES-GCM（128/192/256 位）和 HMAC；HMAC 默认长度为哈希块长度，SHA-1/SHA-256 为 512 位，SHA-384/SHA-512 为 1,024 位；输出上限仍由 HKDF 的哈希决定。派生密钥独立执行用途和可导出性限制。仅允许 `deriveKey` 的基础密钥不能调用 `deriveBits`，原生派生操作返回受保护的密钥句柄。明确设为可导出的派生密钥可按自身策略导出；不可导出的派生密钥由原生层保存。

## ChaCha20-Poly1305

```ts
import { webcrypto } from "node:crypto"

async function main() {
  // Alternatively use global crypto.chacha20Poly1305 with no import.
  const key = webcrypto.getRandomValues(new Uint8Array(32))
  const nonce = webcrypto.getRandomValues(new Uint8Array(12))
  const options = { key, nonce, additionalData: new TextEncoder().encode("header") }
  const encrypted = await webcrypto.chacha20Poly1305.encrypt(options, new TextEncoder().encode("message"))
  const plaintext = await webcrypto.chacha20Poly1305.decrypt(options, encrypted)
  console.log(new TextDecoder().decode(plaintext)) // message
}

void main()
```

这是 Scripting 的显式扩展，不是 `crypto.subtle` 算法。采用 RFC 8439 的 IETF 变体：32 字节密钥、12 字节 nonce、16 字节认证标签。加密返回 **密文后接标签**，不包含 nonce；nonce 需单独保存或传输。同一密钥下每次加密必须使用不同 nonce，API 不记录 nonce 使用历史。

明文和可选附加认证数据各限 1 MiB，密文可额外包含 16 字节标签。省略 `additionalData` 表示空字节。密钥/nonce 长度错误、标签截断或认证失败均抛出 `OperationError`，认证失败不返回明文。解密须提供与加密一致的密钥、nonce 和附加数据。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。

## 处理访问错误

扩展加密操作会在原生运行时检查访问权限，包括使用此前已创建的密钥。请捕获 Promise 拒绝并检查 `error.code`；访问拒绝使用 `ERR_PRO_REQUIRED`。遇到访问拒绝时，不要无限重试加密运算。
