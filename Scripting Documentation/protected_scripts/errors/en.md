# Errors and Safe Retries

## Response handling

Successful JSON responses contain `ok: true`. API errors normally use:

```json
{"ok":false,"error":"invalid_credential"}
```

Gateway responses, malformed JSON, and transport failures may not have that shape. Check HTTP status before reading a body. A `204` token-revocation response has no JSON body. Do not record authorization headers, activation codes, full issuance responses or credential-export files in logs.

| HTTP | Action |
|---|---|
| 400 | Correct the request; do not retry unchanged invalid fields |
| 401 | Replace an expired/revoked token or correct authentication |
| 403 | Check scopes/account state; repeated requests will not grant permission |
| 404 | Check the ID, ownership, base URL and service version; do not treat as an empty list |
| 409 | Reconcile issuance or authorization state; inspect the error code |
| 429 | Wait and use a bounded, increasing delay; do not loop immediately |
| 500/502/503/504 or timeout | Outcome may be uncertain; follow operation-specific retry rules |

`storage_unavailable`, `protected_api_disabled`, and `activation_api_disabled` can indicate a service issue. Do not replace tokens or reissue customer licenses merely because storage is temporarily unavailable.

## Rules by operation

- **GET lists/profile:** retry transient failures with a bounded delay. Pass each returned pagination cursor unchanged. Never turn a failed page into an empty successful list.
- **POST license batch:** keep the exact same package, body and `Idempotency-Key` across retries. The replay window is 10 minutes. `idempotency_payload_mismatch` needs request reconciliation; `idempotency_result_expired` needs checking your original issuance records. Neither means a new key is safe to generate automatically.
- **PATCH license state:** repeating the same intended state is safe; check the returned current license afterward.
- **POST binding revoke:** repeating the same license/binding revoke is safe. Do not substitute another binding ID after an uncertain result.
- **POST management token:** do not automatically retry. Its plaintext is delivered once and is not recoverable from the list. Refresh the App list and inspect new records before replacing an uncertain token.
- **DELETE management token:** repeating deletion for the same owned token is safe. `404 credential_not_found` is not permission to act on a different token.

Use finite retries and delays. A timeout is not proof that a write failed. Stop and surface the unresolved outcome instead of silently issuing more licenses.

## A single-request TypeScript helper

This example uses standard `fetch` in your own tool/server. It makes one request and never logs secrets or retries writes implicitly. `SCRIPTING_LICENSE_TOKEN` must come from private configuration.

```ts
const base = "https://protected-api.scripting.fun/v1/protected"

async function licenseRequest(
  token: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: object; requestKey?: string } = {}
) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error("Invalid API path")
  }
  const response = await fetch(base + path, {
    method: options.method ?? "GET",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.requestKey ? { "Idempotency-Key": options.requestKey } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  })
  const text = await response.text()
  let result: any
  try { result = JSON.parse(text) } catch { throw new Error(`API HTTP ${response.status}`) }
  if (!response.ok || result?.ok !== true) {
    const knownErrors = new Set([
      "invalid_credential", "insufficient_scope", "developer_disabled",
      "invalid_body", "invalid_field", "invalid_id", "invalid_query", "invalid_state",
      "package_not_found", "license_not_found", "activation_not_found",
      "idempotency_key_required", "idempotency_payload_mismatch", "idempotency_result_expired",
      "rate_limited", "storage_unavailable", "protected_api_disabled", "activation_api_disabled"
    ])
    const code = knownErrors.has(result?.error) ? result.error : "unavailable"
    throw new Error(`API HTTP ${response.status}: ${code}`)
  }
  return result
}
```

For a batch, choose the order/request key once and retain it with the intended body and saved result. Do not choose a new key inside a retry loop. Keep activation codes and exported API credentials outside source repositories and shared logs.

## Verify an integration

Use your own test package and license. Confirm read-only tokens cannot issue/revoke; repeated batches return identical codes; listing never reveals original codes; an unrelated package/license cannot be accessed; a revoked API token is rejected; and device revocation releases a seat while already delivered offline grants remain usable. Revoke your test token and disable/reconcile your own test licenses afterward.
