# Published Script Packages

`GET /packages` lists package identities owned by the authenticated developer. Either a read-only or license-management token can call it. Packages are created when publishing from the App; creating a license does not publish a script.

## Request

No body or query parameters are needed.

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/packages'
```

## Response — 200

```json
{"ok":true,"packages":[{"packageID":"11111111-1111-4111-8111-111111111111","name":"My Protected Script","createdAt":1792886400000}]}
```

| Field | Meaning |
|---|---|
| `packageID` | Stable UUID identifying the published script and its licenses |
| `name` | Name recorded when that package was created |
| `createdAt` | Creation time, Unix milliseconds |

An empty `packages` array is a successful empty list. The current endpoint returns at most 100 packages, ordered by ID, and has no pagination cursor. Retain package IDs in your own records; this response is not a complete export for accounts exceeding that limit. It does not return script files, release decryption keys, activation codes, or publishing private keys.

## Package, release and license

- A package identifies one published script. Repeated publishing from the same existing project mapping creates releases under that package.
- A release is a particular encrypted version. Recipients import that file; the license API does not deliver files.
- A license belongs to one package. A code for a different package does not activate this package.
- A package's active releases share the package's license entitlement. There is no separate version-range argument in the batch API.

Use the package ID returned here in `/packages/{packageID}/licenses` and `/packages/{packageID}/licenses/batch`. Do not substitute a release ID, developer ID or display name.

## Errors

`401 invalid_credential`: missing, invalid, expired or revoked token. `403 developer_disabled`: developer account disabled. Storage/service failure may return `503`; see **Errors and Safe Retries**. A token never lists another developer's packages.

Publishing-key registration and encrypted-release registration are performed by the App with its internal session and publisher proof. External management tokens cannot call those publishing operations.
