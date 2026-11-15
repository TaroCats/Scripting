# Device Activations

These endpoints let a developer inspect and revoke installation bindings for an owned license. They do not expose installation private keys or return script decryption keys.

Recipients activate in the App without an account. An installation has its own identity; it is not a hardware UUID. Know the `licenseID` from your issuance receipt or license list before using these endpoints.

## List bindings

`GET /licenses/{licenseID}/activations?limit=50&after={cursor}` requires `licenses:read`.

| Query | Contract |
|---|---|
| `limit` | Optional integer 1–100; default 50 |
| `after` | Optional previous `nextCursor`, passed unchanged |

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222/activations?limit=50'
```

Response — `200`:

```json
{"ok":true,"activations":[{"activationID":"33333333-3333-4333-8333-333333333333","installationID":"77777777-7777-4777-8777-777777777777","state":"active","generation":1,"createdAt":1792886400000}],"nextCursor":null}
```

| Field | Meaning |
|---|---|
| `activationID` | Binding ID used for revocation |
| `installationID` | Installation identity, not a hardware identifier |
| `state` | `active` or `revoked` |
| `generation` | Binding-state revision; not a device count |
| `createdAt` | Initial binding time, Unix milliseconds |

The list includes revoked records and is ordered by activation ID. Continue until `nextCursor` is `null`. An empty array means no bindings are listed for that license. The response does not contain original codes, recipient private keys, grants, device names or hardware serial numbers.

## Revoke one binding

`POST /licenses/{licenseID}/activations/{activationID}/revoke` requires `licenses:write` and exactly an empty JSON object `{}`.

```sh
curl --fail-with-body --silent --show-error \
  -X POST -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' --data '{}' \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222/activations/33333333-3333-4333-8333-333333333333/revoke'
```

Response — `200`:

```json
{"ok":true,"activationID":"33333333-3333-4333-8333-333333333333","state":"revoked"}
```

Repeated revocation is safe. Revoking releases that binding's active device seat and blocks future online key requests for that binding. The binding's revoked history remains. Re-enabling its license does not revive it; the same revoked installation cannot simply reactivate that binding with the old code. A fresh installation identity needs available capacity.

Already delivered offline authorizations remain usable. Revocation cannot remove a key previously delivered to a recipient. To stop future use of a stolen activation code, disable the license; revoking only one binding does not invalidate the code for other fresh identities if seats are available.

## Errors and scope

`400`: malformed IDs, unknown fields, invalid pagination or a nonempty revoke body. `401 invalid_credential`: invalid/expired/revoked API token. `403 insufficient_scope` or `developer_disabled`: unavailable permission/account. `404 license_not_found` or `activation_not_found`: the object is unavailable to this developer or does not belong to that license. `429`: rate limited. `503 activation_api_disabled` or service failure: temporarily unavailable.

The App handles recipient activation challenges, proof confirmation, and encrypted-key updates. External license-management tools do not need to implement that protocol, submit hardware identifiers, or receive decryption keys.
