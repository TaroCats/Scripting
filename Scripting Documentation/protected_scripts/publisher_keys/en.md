# Publishing Key Backup, Recovery and Rotation

Each published script package has its own publishing key. It signs new versions of that package. It is separate from your GitHub login, license API token, activation codes and recipients' device keys. Scripting stores it privately on the publishing device and does not upload it to the API.

Open your editable project's **Publish Encrypted Script → Publishing Key** page. Your Scripting developer identity must be enabled for this account.

## Save an encrypted backup

1. Publish the project once to create its package and publishing key.
2. Open **Publishing Key → Export Encrypted Key Backup**.
3. Enter a strong backup password and confirm it. The password must contain 12–1024 UTF-8 bytes; spaces and letter case are significant.
4. Choose **Save Encrypted Backup** and save the `.scriptingkey` file to a location you control.
5. Keep the password separately, preferably in your password manager. Keep another copy of the encrypted backup on disconnected storage.

The exported file is encrypted. It does not contain your GitHub login, API token, activation codes or script source. The password stays on the device. Closing the page or moving the App into the background clears the password fields.

The backup belongs to one package and developer account. A backup from one script cannot replace another package's key. The package and public key identifiers are visible in the backup; the private key is encrypted.

## Recover on another device or project

1. Sign in to the same GitHub account and enable its Scripting developer identity.
2. Open the editable project that should continue publishing the existing package.
3. Before publishing it, open **Publishing Key → Restore Key Backup**.
4. Select the backup file, enter its password, and choose **Restore Publishing Key**.
5. Scripting checks the account, package and current publishing key with the service. After recovery, the next publication continues that package.

Recovery does not replace your editable source. If the selected project is already associated with a different published package, recovery is refused. Use an unassociated editable project instead. The first implementation associates publishing state with the local project name: before renaming a publishing project, export its backup, then restore it under the new name before publishing again.

An old backup whose key has already been rotated is refused. Use a backup exported after the latest rotation. GitHub sign-in alone cannot recreate a lost private key. If both the working key and a current backup are lost, you cannot continue signing new versions of that package; publishing a new package is a separate operation and does not automatically transfer existing licenses.

## Rotate a publishing key

Choose **Rotate Publishing Key** and confirm. You need the existing private key and an online session for the package's owner. Scripting creates a new key and asks the service to switch to it, with authorization from the old key and proof that the new key is present.

After success, immediately export a new encrypted backup. The previous backup cannot publish further versions. Existing script versions remain valid, existing activations are retained, and users can continue running versions they already activated offline. Rotation does not revoke those offline grants.

If the response is lost, the page shows **Resume Key Rotation**. Resume the saved operation rather than attempting recovery over it or starting another rotation. Scripting retains the pending keys privately until it can confirm the result. If another device completed a different rotation first, recover that device's current backup before publishing again.

The current format supports up to 32 rotations per package and retains the full authorization history. It refuses further rotations instead of dropping old proof. Keep the latest backup even when the old device is still available.

## Recipient updates

Packages published after rotation carry proof that the prior key authorized the new key. Scripting checks that continuity before installing an update over an existing protected package. A different key without the proof is rejected.

Recipients need a Scripting version supporting protected scripts and publishing-key rotation. Ordinary editable scripts remain available through their existing import and execution flows.

## API credentials

External license API tokens cannot export, recover or rotate publishing keys. They continue to manage licenses for the same package after a rotation. App account sessions perform the public-key registration and rotation requests; private keys and backup passwords never belong in a management-token request.
