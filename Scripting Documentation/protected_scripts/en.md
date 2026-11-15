# Protected Scripts and License API

Publish an encrypted copy of a script, issue activation codes through the Scripting HTTPS API, and let recipients activate it without signing in.

## Complete workflow

1. In **More → Settings → Developer → GitHub**, sign in with GitHub and enable your Scripting developer identity.
2. Open a script's menu and choose **Publish Encrypted Script**. Keep the editable project. Share the resulting `.scriptingenc` file with recipients.
3. Open **License API Tokens** on the GitHub page. Create a **License Management** token. Save it immediately: its contents are shown once. Use **Send to Your Device** to deliver it to your own Mac or another trusted destination.
4. Configure that token in your own tool or server. Use `GET /packages` to find the published script's `packageID`.
5. Use `POST /packages/{packageID}/licenses/batch` to issue codes. Store the returned codes securely and deliver a code to each intended recipient.
6. Recipients import the encrypted file, enter their code, and run the activated version. They do not need a GitHub or Scripting developer account.

The App manages API tokens; activation codes are generated through the API. Your own activation server is not required.

## First request

The examples use a token supplied through your environment or secret manager. Do not commit it to source control, paste it into logs, or put it in a URL.

```sh
SCRIPTING_API_BASE='https://protected-api.scripting.fun/v1/protected'
# Supply SCRIPTING_LICENSE_TOKEN from your private configuration.
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  "${SCRIPTING_API_BASE}/packages"
```

See **Authentication and API Tokens**, **Published Script Packages**, **Licenses and Activation Codes**, **Device Activations**, and **Errors and Safe Retries** for complete request and response contracts.

## Supported script behavior

- Publish JavaScript/TypeScript/TSX projects with neighboring JavaScript and JSON modules and the Scripting API. All existing project entry points are included: main App, Shortcuts, App Intents, Bluetooth, widgets, Control Widgets, notifications, Spotlight, assistant tools, keyboard, Live Activity, alarm Live Activity, Translation UI, Safari and Home tab UI.
- Publishing a Python project, external npm packages, native add-ons and arbitrary resource files is not supported.
- Activate the imported version in the main App first. Available entries then appear in their existing selectors. System permissions, extension setup and the corresponding API's normal execution requirements still apply. Activation does not automatically register a Bluetooth task or prepare remote updates.
- Entry points share one module table. A widget may import `index.tsx`; shared dependencies are packaged once and initialized once per JavaScript context. Separate widget/App contexts have separate state.
- `browser.tsx` is deliberately visible: the imported copy offers **View Browser Code**, and Safari can inspect the injected JavaScript. Its existing DOM, userscript metadata and dependency rules apply. Other native entry points remain encrypted on disk and load in memory.
- Import recognizes protected-file contents, including when a protected file was renamed `.zip` or `.scripting`. Ordinary script import remains available.
- Activated versions run offline. A license covers active releases of the same package, including later releases; version-range pricing is not provided.
- Importing a newer version preserves the old usable encrypted copy. Use **Use Existing Activation** to obtain authorization for the imported version.
- Share sends the encrypted copy. Recipients do not receive the editable project through this workflow.
- An encrypted export is limited to 32 MiB, at most 512 modules and 4 MiB per module. A project can be rejected when its compiled output exceeds these bounds.

Keep the original project and a password-encrypted publishing-key backup. **Publishing Key** provides backup, recovery and rotation; see **Publishing Key Backup and Rotation**. Before renaming a project, export its backup and restore it under the new name before publishing again.

Frozen Bluetooth and remote Live Activity packages retain the encrypted version that was prepared. Updating the installed copy does not substitute a different renderer. Deleting that version removes its local execution key; prepare/register the intended remaining version again as needed. Remote rendering retains its existing 16 MiB package limit, including its pinned runtime.

## Important boundaries

API tokens manage your own licenses; they do not unlock scripts or publish releases. Recipients use their own installation-bound activation instead of your API token. Device binding is based on an installation's cryptographic identity, not a hardware UUID; replacing that identity requires available device capacity.

Disabling a license or revoking a device binding blocks later online authorization requests. Already delivered offline authorizations remain usable. Revoking an API token blocks that token's future API requests and does not revoke recipients' licenses.

An unavailable endpoint may return `404`. Check the service address and endpoint availability instead of treating that response as an empty account list.
