# Licenses and Activation Codes

Use the base URL `https://protected-api.scripting.fun/v1/protected` and a license API bearer token. IDs below are UUIDs. Unknown request fields are rejected; timestamps are Unix milliseconds.

## Issue a batch

`POST /packages/{packageID}/licenses/batch` requires `licenses:write`.

| Body field | Required | Contract |
|---|---|---|
| `count` | Yes | Integer 1–100; number of licenses/codes |
| `deviceLimit` | Yes | Integer 1–100; allowed active installation bindings per license |
| `externalReference` | No | Nonempty string, at most 128 UTF-8 bytes; your order/customer reference. Omit when unused |

The required `Idempotency-Key` header has 8–128 characters from letters, digits, `.`, `_`, `:`, `-`. It must identify one issuance request and is unique across all batches of this developer, including different packages.

```sh
umask 077
SCRIPTING_LICENSE_RESULT="$(mktemp "${TMPDIR:-/tmp}/scripting-licenses.XXXXXX")"
SCRIPTING_PACKAGE_ID='11111111-1111-4111-8111-111111111111'
curl --fail-with-body --silent --show-error \
  -X POST \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: order-20261025-001' \
  --data '{"count":2,"deviceLimit":1,"externalReference":"order-001"}' \
  --output "${SCRIPTING_LICENSE_RESULT}" \
  "https://protected-api.scripting.fun/v1/protected/packages/${SCRIPTING_PACKAGE_ID}/licenses/batch"
printf 'Response file: %s\n' "${SCRIPTING_LICENSE_RESULT}"
```

The command creates a new private temporary response file for this attempt, so it does not overwrite a previous receipt. Check HTTP/error status, then securely transfer a successful result to your order system or durable private storage before temporary-file cleanup. It contains activation codes: do not commit or log it. Create a different request key only for a genuinely new issuance/order, not to recover an uncertain result.

### Response — 201 for a new batch; 200 for a valid replay

```json
{"ok":true,"packageID":"11111111-1111-4111-8111-111111111111","licenses":[{"licenseID":"22222222-2222-4222-8222-222222222222","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…ABCD","externalReference":"order-001","createdAt":1792886400000,"activationCode":"<FIRST_ACTIVATION_CODE>"},{"licenseID":"66666666-6666-4666-8666-666666666666","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…EFGH","externalReference":"order-001","createdAt":1792886400000,"activationCode":"<SECOND_ACTIVATION_CODE>"}],"replayed":false,"resultExpiresAt":1792887000000}
```

The batch is atomic: a successful request issues all requested licenses. `activationCode` is the recipient's secret; it is different from your API token and must not be sent to the wrong recipient. `codeHint` is only a last-four-character hint and cannot activate a script. An unused `externalReference` is returned as `null`.

### Idempotency and code recovery

For 10 minutes, the same developer, package, body and request key return the original codes with `replayed: true`, including after service restart. A different body or package with that key returns `409 idempotency_payload_mismatch`. After the window, the key returns `409 idempotency_result_expired`; it never issues another batch for that key. Listings do not recover original codes. Save the original result before distributing codes.

A replay is the original issuance receipt, not current license state. It does not re-enable a subsequently disabled license. Use the list endpoint for current state. If delivery outcome is uncertain, check your saved receipt/list and reconcile it; do not automatically switch keys and issue duplicate licenses.

## List licenses

`GET /packages/{packageID}/licenses?limit=50&after={cursor}` requires `licenses:read`.

- `limit`: optional integer 1–100; default 50.
- `after`: optional cursor returned by the previous page. Pass it unchanged.
- No other query parameters are supported. Ordering is by license ID, not creation time.

```json
{"ok":true,"licenses":[{"licenseID":"22222222-2222-4222-8222-222222222222","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…ABCD","externalReference":"order-001","createdAt":1792886400000}],"nextCursor":null}
```

Continue until `nextCursor` is `null`. Lists contain both active and disabled licenses and never contain `activationCode` or verification hashes. There is no external-reference filter in this endpoint.

## Disable or re-enable a license

`PATCH /licenses/{licenseID}` requires `licenses:write` and exactly `{"state":"disabled"}` or `{"state":"active"}`.

```sh
curl --fail-with-body --silent --show-error \
  -X PATCH -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' --data '{"state":"disabled"}' \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222'
```

Response: `200` with `{"ok":true,"license":{...}}`; `license` has the same fields as a list entry and no raw code. Repeating the same state is safe. Re-enabling a license does not revive individually revoked device bindings.

Disabling blocks subsequent online activations/key delivery. It does not remove a DEK or revoke an already delivered offline grant. Device limits and codes are not changed by this endpoint. There is no hard-delete, raw-code lookup, or device-limit-edit endpoint in this version.

## Errors

| HTTP / error | Meaning |
|---|---|
| 400 `invalid_body`, `invalid_field`, `invalid_id`, `invalid_query`, `invalid_state` | Invalid fields, ID, query or state |
| 400 `idempotency_key_required` | Missing/invalid batch request key |
| 401 `invalid_credential` | Token missing, expired, revoked or invalid |
| 403 `insufficient_scope`, `developer_disabled` | Wrong permission or disabled developer |
| 404 `package_not_found`, `license_not_found` | Object unavailable to this developer |
| 409 `idempotency_payload_mismatch`, `idempotency_result_expired` | Reconcile the original batch; do not silently issue a new one |
| 429 / 503 | Rate limit or unavailable service; use bounded retries with the same batch key/body |
