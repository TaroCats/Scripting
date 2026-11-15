# Authentication and API Tokens

Base URL: `https://protected-api.scripting.fun/v1/protected`.

Use HTTPS with normal certificate verification. Do not follow redirects with credentials. Send the token only in the `Authorization` header:

```http
Authorization: Bearer <LICENSE_API_TOKEN>
Content-Type: application/json
```

JSON responses normally contain `ok: true` or `ok: false`. Gateway errors may have a non-JSON body; always check HTTP status first.

## Obtain and manage a token

Sign in with GitHub in the App, enable your developer identity, then open **License API Tokens**. Choose:

| Choice | Scopes | Permitted operations |
|---|---|---|
| License Management | `licenses:read`, `licenses:write` | Read licenses/bindings; issue or disable licenses; revoke bindings |
| Read Only | `licenses:read` | Read licenses and bindings |

Tokens apply to all packages owned by that developer. They expire after 30 days. They cannot publish a script, create a package, or create/list/revoke other management tokens. A valid token can also read its developer profile and list owned packages.

The creation page shows the complete token once. Copy is local to the current device and expires after 60 seconds; explicitly use **Send to Your Device** for delivery to your Mac. Closing the page does not revoke the token. A lost token must be revoked and replaced.

The server keeps a verification digest, not a recoverable copy. App token lists contain metadata only. Sign-out clears the App's local account state; previously delivered management tokens remain valid until expiration or explicit revocation. To rotate, create a replacement, update your tool, verify it, then revoke the previous token.

## Read your developer profile

`GET /developers/me` accepts a valid management token. It has no body or query parameters.

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/developers/me'
```

```json
{"ok":true,"developer":{"developerID":"44444444-4444-4444-8444-444444444444","githubID":"123456","githubLogin":"example-author","enabled":true,"createdAt":1792886400000}}
```

`developerID` is the stable Scripting identity. `githubID` is GitHub's stable numeric subject represented as a string; `githubLogin` can change. Timestamps are Unix milliseconds. Disabled developers receive `403 developer_disabled`; invalid, expired, or revoked tokens receive `401 invalid_credential`.

## App account-management endpoints

These endpoints require the App's private session credential. Your external tool uses the management token obtained through the App; it must not extract the App session or GitHub OAuth token.

| Method | Path | Request | Successful response |
|---|---|---|---|
| GET | `/developer-tokens?limit=50&after=<cursor>` | No body; `limit` 1–100, default 50 | `200`, metadata page below |
| POST | `/developer-tokens` | `{"scopes":["licenses:read","licenses:write"]}` | `201`, one-time credential below |
| DELETE | `/developer-tokens/{credentialID}` | No body | `204`, empty body |

Creation accepts either or both supported scopes; duplicates, an empty list, or unknown scopes are rejected. Omitted scopes default to read+write. Each request creates a new token; it has no idempotency/recovery window. A timeout may mean creation succeeded: refresh the list, check new entries and revoke unwanted tokens before creating another. Do not automatically revoke an ambiguous entry that could have been created on another device.

Metadata response:

```json
{"ok":true,"credentials":[{"credentialID":"55555555-5555-4555-8555-555555555555","scopes":["licenses:read"],"createdAt":1792886400000,"expiresAt":1795478400000,"state":"active"}],"nextCursor":null}
```

`state` is `active`, `expired`, or `revoked`, evaluated by the server. Pages include history and sort newest first, with a stable ID tie-breaker. Pass `nextCursor` unchanged as `after`; it belongs to this developer's management-token list. There is no token or token hash in the list.

One-time creation response:

```json
{"ok":true,"credential":{"credentialID":"55555555-5555-4555-8555-555555555555","token":"<API_TOKEN_SHOWN_ONCE>","kind":"management","scopes":["licenses:read","licenses:write"],"expiresAt":1795478400000}}
```

DELETE may be repeated for the same owned token. Unknown/foreign IDs return `404 credential_not_found`. Passing a management token to these session-only endpoints returns `403 insufficient_scope`; expired session credentials return `401`. Invalid pagination/scopes return `400`. These responses never authorize access to another developer's records.
