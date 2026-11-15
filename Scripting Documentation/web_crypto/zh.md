# Curve25519 WebCrypto

下面每个示例都是独立的 App 普通脚本。从内置 `node:crypto` 导入 `webcrypto`，无需安装 npm 包；全局小写 `crypto` 是同一 WebCrypto 对象，无需导入，也不要从 `scripting` 导入。全局大写 `Crypto` 是另一套基于 Data 的 API。`TextEncoder`、`TextDecoder`、`console` 均为全局对象。

普通脚本可直接调用 `crypto.subtle`，或使用 `require('node:crypto').webcrypto.subtle`；两者共用现有 WebCrypto 实现，无需从 `scripting` 导入。

| 算法 | 操作 | 密钥用途 |
| --- | --- | --- |
| Ed25519 | generateKey、importKey、exportKey、sign、verify | 私钥 sign；公钥 verify |
| X25519 | generateKey、importKey、exportKey、deriveBits、deriveKey | 私钥 deriveBits 和/或 deriveKey；公钥为空 |

生成密钥返回 `{privateKey, publicKey}`，生成的公钥始终可导出，私钥至少需要一种有效用途。raw 仅支持32字节公钥；SPKI 为公钥、PKCS8 为私钥；JWK 使用 OKP 类型。DER 遵循 RFC8410，算法参数必须省略。JWK 校验曲线、类型、用途与可导出标记，私钥与公钥必须匹配。Ed25519 导出的 JWK 使用 `alg: 'Ed25519'`，导入兼容旧 `EdDSA`。

### 完整签名示例

生成签名并验证，输出 `true`。

```ts
import { webcrypto } from "node:crypto"

async function main() {
  // crypto.subtle is also global; TextEncoder and console need no import.
  const signing = await webcrypto.subtle.generateKey("Ed25519", false, ["sign", "verify"])
  const message = new TextEncoder().encode("hello")
  const signature = await webcrypto.subtle.sign("Ed25519", signing.privateKey, message)
  console.log(await webcrypto.subtle.verify("Ed25519", signing.publicKey, signature, message)) // true
}

void main()
```

### 完整的双方密钥协商示例

在本地创建双方身份并完成 `hello` 加解密，不依赖未定义的外部 `remotePublicBytes`。

```ts
import { webcrypto } from "node:crypto"

async function main() {
  const subtle = webcrypto.subtle
  const alice = await subtle.generateKey("X25519", false, ["deriveKey"])
  const bob = await subtle.generateKey("X25519", false, ["deriveKey"])
  // Self-contained demo: Bob supplies the peer public bytes. Authenticate them in a real protocol.
  const bobPublicBytes = await subtle.exportKey("raw", bob.publicKey)
  const bobPublic = await subtle.importKey("raw", bobPublicBytes, "X25519", true, [])
  const aliceKey = await subtle.deriveKey(
    { name: "X25519", public: bobPublic }, alice.privateKey,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  )
  const bobKey = await subtle.deriveKey(
    { name: "X25519", public: alice.publicKey }, bob.privateKey,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  )
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, aliceKey, new TextEncoder().encode("hello"))
  const plaintext = await subtle.decrypt({ name: "AES-GCM", iv }, bobKey, ciphertext)
  console.log(new TextDecoder().decode(plaintext)) // hello
}

void main()
```

某些系统使用随机化签名，同一密钥与消息产生的签名字节可以不同，应通过验签判断有效性。X25519 不验证对方身份，请遵循协议要求认证公钥、派生密钥并验证消息。

`deriveBits` 需要私钥的 deriveBits 用途，长度可为 null（完整256位）或0至256的整数，返回对应前缀并清除最后一个字节的未使用位；全零共享密钥拒绝。`deriveKey` 需要 deriveKey 用途，直接生成原生不透明密钥，不暴露共享字节。目标支持 AES-GCM 128/192/256位及 encrypt/decrypt 用途，或 SHA-1/256/384/512 的 HMAC、显式正数且字节对齐的长度（最多256位）、sign/verify 用途。省略 HMAC 长度会采用哈希块大小，超过 X25519 结果长度而拒绝。

曲线密钥及新派生的对称密钥具有不可变元数据，材料保存在原生句柄中，修改 JS 属性不能导出不可导出密钥。派生 AES-GCM 支持12字节 IV、128位认证标签及可选 additionalData；同一密钥的每次加密必须使用不同 IV。保留二进制子视图偏移；原生消息及 additionalData 每项最多16 MiB。

无效格式、类型、用途及操作以具名 WebCrypto 错误拒绝。不支持其他曲线、Ed25519ph、密钥包装、Apple 配对或服务协议。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。

## 处理访问错误

扩展加密操作会在原生运行时检查访问权限，包括使用此前已创建的密钥。请捕获 Promise 拒绝并检查 `error.code`；访问拒绝使用 `ERR_PRO_REQUIRED`。遇到访问拒绝时，不要无限重试加密运算。
