# HKDF and ChaCha20-Poly1305

## Imports and running the examples

Both examples are complete, independent App scripts. They import `webcrypto` from the built-in `node:crypto` module; no npm installation is needed. The global lowercase `crypto` exposes the same WebCrypto object without an import. `TextEncoder`, `TextDecoder` and `console` are globals. Do not import these from `scripting`. The uppercase global `Crypto` is a separate Data-based API; see [Crypto](../crypto/en.md).

The HKDF example derives a protected AES key and round-trips `hello`; the ChaCha example round-trips `message`. Each generates its own demo key material and nonce/IV. In a real protocol, obtain the agreed input key/salt/info and transmit the nonce/IV alongside the ciphertext.

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

HKDF accepts raw imported key material and SHA-256, SHA-384 or SHA-512. Imported keys must be nonextractable with `deriveBits`, `deriveKey`, or both usages; generation and export are unsupported. `salt` and `info` are required BufferSources and may be empty. Input material, salt and info each have a 1 MiB limit. ArrayBuffer, typed-array and DataView offsets are respected; shared buffers are unsupported.

`deriveBits` requires a positive multiple of 8 bits, at most `255 × hash length` bytes (8,160 / 12,240 / 16,320 bytes respectively). Zero, null or omitted length rejects with `OperationError`. `deriveKey` supports AES-GCM (128/192/256 bits) and HMAC. HMAC defaults to the hash block length (512 bits for SHA-1/SHA-256, 1,024 bits for SHA-384/SHA-512); HKDF's selected hash still controls its output limit. Derived keys enforce their own usages and extractability. A key admitted only for `deriveKey` cannot call `deriveBits`; its native derivation returns a protected key handle. An explicitly extractable derived key can be exported according to its own policy. Nonextractable derived keys keep their material in native storage.

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

This is an explicit Scripting extension, not a `crypto.subtle` algorithm. It uses the RFC 8439 IETF variant: a 32-byte key, 12-byte nonce and 16-byte authentication tag. Encryption returns **ciphertext followed by tag**; it does not prepend the nonce. Store or transmit the nonce separately. Never reuse a nonce for encryption with the same key; the API does not track nonce history.

Plaintext and optional additional authenticated data each have a 1 MiB limit; ciphertext may have 16 additional tag bytes. An omitted `additionalData` means empty bytes. Wrong key/nonce lengths, truncated tags and authentication failures reject with `OperationError`. Authentication failure never returns plaintext. Decryption must use the same key, nonce and additional data used for encryption.

[Node modules and import guide](../node_compat/en.md).

## Handling access errors

Extended cryptography operations check access in the native runtime, including operations on previously created keys. Catch rejected promises and inspect `error.code`; an access denial uses `ERR_PRO_REQUIRED`. Do not retry cryptographic work indefinitely after an access denial.
