# Remote updates HTTP API

Base URL: `https://push.scripting.fun/v1/remote-updates`. Send `Authorization: Bearer <credential>` and `Content-Type: application/json`. Dates use UTC ISO 8601; JSON fields use snake_case.

## Credentials

The master key manages targets and sender keys. It cannot start, update or reload targets directly; no-new-state end cleanup is allowed. Legacy notification child keys cannot use these endpoints.

Create a sender with `POST /sender-keys`: `targets` (explicit IDs), `actions` (from the table below), optional `created_from` (start target IDs), and `idempotency_key`. The response contains `id`, `credential`, `expires_at`. Save the credential securely. `created_from` grants access only to activities created by that same sender. `GET /sender-keys` lists metadata; `DELETE /sender-keys/:id` revokes a key. These management operations use the master key.

You can also create and copy a scoped sender key from a target's **Create Sender Key** action in Remote Updates. Never put the master key in widget code or business state.

## Sending

| Method and path | Required action | Body |
|---|---|---|
| GET `/widget-targets/:id/state` | `widgets:read-state` | — |
| PUT `/widget-targets/:id/state` | `widgets:write-state` | `state`, `expected_revision`, `idempotency_key`; optional `source_version`, `expires_at` |
| POST `/widget-targets/:id/reload` | `widgets:reload` | `idempotency_key`; optional `expires_at` |
| POST `/start-targets/:id/start` | `activities:start` | `template_version`, `state`, `alert: {title,body}`, `idempotency_key`; optional `business_key`, `business_generation`, `priority`, `stale_at`, `relevance_score`, `expires_at` |
| GET `/activities/:id/state` | `activities:read-state` | — |
| POST `/activities/:id/update` | `activities:update` | `state`, `expected_revision`, `idempotency_key`; optional `source_version`, `stale_at`, `relevance_score`, `priority`, `alert`, `expires_at` |
| POST `/activities/:id/end` | `activities:end` | `idempotency_key`; optional `state`, `expected_revision`, `dismiss_at`, `expires_at` |

New final state requires `expected_revision`. Omit state to end with the last committed state. `priority` is `normal` or `high`; `relevance_score` is 0–1. Transport expiry defaults to five minutes and may be at most 24 hours in the future.

## Responses and queries

Successful JSON responses are `{ok:true,data,timestamp}`. Sending returns HTTP 202 with `{target_id,state_revision,state_committed,launch_request_id?,operation}`. A snapshot contains `target_id`, `has_state`, `state`, `revision`. GET state supports `ETag` / `If-None-Match` and may return HTTP 304 without a body.

- GET `/operations/:id`: operation status, pending reason, error and transport ID when available.
- GET `/widget-targets`, `/activities`, `/start-targets`: paginated metadata (`items`, `next_cursor`); use `cursor` for the next page. Optional filters: `installation_id`, `script_binding_id`; activities also accept `business_key`, `business_generation`, `lifecycle`.
- GET `/<collection>/:id`: target metadata. Master keys may query management metadata; sender results are restricted to their scope.
- PUT `/<collection>/:id/settings`: master-managed `expected_revision`, optional `paused`, `alias` (up to 128 UTF-16 units, null clears). DELETE `/<collection>/:id` revokes the target.
- POST `/widget-targets/batch` or `/activities/batch`: `{items:[{target_id,action,...}]}`, 1–50 items. Widget actions: `update` / `reload`; activity actions: `update` / `end`. Inspect each item's `ok`, `http_status` and receipt/error; partial success is possible.
- GET `/capabilities`: protocol features and limits; this does not prove device readiness.

Settings use `registration_revision` from target metadata as `expected_revision`; state writes use the snapshot’s `revision`. Sender creation accepts at most 100 target IDs and 100 `created_from` IDs.

Activity metadata may include `render_report`: `status` is `notReported`, `snapshotBuilt` or `snapshotFailed`; a reported result also includes `stage`, `template_version`, `state_revision`, `received_at` (Unix milliseconds), and `current`. Reports expire after seven days. They describe native snapshot construction, not system display or delivery. Only a native device credential can upload a report; scoped senders need `activities:read-state` to read it. Reports never change business state, lifecycle or quota.

## Minimal test: start, update and end

Prepare the two-file receiver in the [Live Activity guide](scripting://doc?title=Live%20Activity%20Remote%20Updates). In Remote Updates, select its start target and create a sender with start, read-state, update and end actions, including activities created by this sender. Save the following as `live-activity-test.mjs` on your computer/server (Node.js 18+).

<!-- example: live-activity-test.mjs -->
```js
// Node.js 18+. Use a scoped sender key, never a master key.
import {readFile, writeFile, rename, open, unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base = process.env.SCRIPTING_PUSH_BASE_URL || 'https://push.scripting.fun';
const key = process.env.SCRIPTING_REMOTE_SENDER_KEY;
const startTargetId = process.env.SCRIPTING_START_TARGET_ID;
const templateVersion = process.env.SCRIPTING_TEMPLATE_VERSION;
const file = process.env.SCRIPTING_REMOTE_TEST_FILE || './remote-activity-test.json';
const action = process.argv[2] || 'status';
const message = process.argv[3] || 'Updated from server';
if (!key || !startTargetId || !templateVersion) throw Error('Configure sender key, start target ID and template version');
if (!['start', 'status', 'update', 'end'].includes(action)) throw Error('Use start, status, update or end');
const lock = await open(file + '.lock', 'wx', 0o600);
try {
let saved;
try { saved = JSON.parse(await readFile(file, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
saved ||= {base, startTargetId, templateVersion, requests: {}, receipts: {}};
if (saved.base !== base || saved.startTargetId !== startTargetId || saved.templateVersion !== templateVersion) throw Error('This test file belongs to another target/template; use a different test file');
async function persist() {
  const temporary = file + '.tmp';
  await writeFile(temporary, JSON.stringify(saved, null, 2), {mode: 0o600});
  await rename(temporary, file);
}
async function remote(path, body) {
  const response = await fetch(new URL('/v1/remote-updates' + path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error(result.code || 'REMOTE_UPDATE_FAILED');
  return result.data;
}
let result;
if (action === 'start') {
  saved.requests.start ||= {template_version: templateVersion, state: {message: 'Preparing'}, alert: {title: 'Live Activity test', body: 'Remote start'}, idempotency_key: randomUUID()};
  await persist();
  result = await remote('/start-targets/' + encodeURIComponent(startTargetId) + '/start', saved.requests.start);
} else {
  const id = saved.receipts.start?.target_id;
  if (!id) throw Error('Run start first; after a timeout rerun start with this same test file');
  const path = '/activities/' + encodeURIComponent(id);
  if (action === 'status') result = await remote(path);
  else {
    const event = action === 'update' ? 'update:' + message : action;
    if (!saved.requests[event]) {
      saved.requests[event] = action === 'update'
        ? {state: {message}, expected_revision: (await remote(path + '/state')).revision, idempotency_key: randomUUID()}
        : {dismiss_at: new Date().toISOString(), idempotency_key: randomUUID()};
    }
    await persist();
    result = await remote(path + '/' + action, saved.requests[event]);
  }
}
saved.receipts[action] = result;
await persist();
console.log(JSON.stringify(result, null, 2));

} finally { await lock.close(); await unlink(file + '.lock'); }
```

Set these environment variables in your terminal; use a scoped sender key, not your master key:

```sh
export SCRIPTING_REMOTE_SENDER_KEY='YOUR_SENDER_KEY'
export SCRIPTING_START_TARGET_ID='YOUR_START_TARGET_ID'
export SCRIPTING_TEMPLATE_VERSION='YOUR_TEMPLATE_VERSION'
node live-activity-test.mjs start
node live-activity-test.mjs status
node live-activity-test.mjs update
node live-activity-test.mjs status
node live-activity-test.mjs end
```

Run commands one at a time. After start, use status to wait for `token_registration: "ready"` before update or end; a committed start alone does not mean its update token has arrived. `start` should show “Preparing” on the receiver; `update` should change it to “Updated from server”; `end` requests immediate removal without new final state. Check the Lock Screen as well as the Dynamic Island. Keep `remote-activity-test.json`: requests are saved before sending, so repeating a command retries the same request. Do not delete it after a timeout. After a crash, confirm the old process exited before removing only its `.lock` file.

For a new update after checking/repairing the renderer, use `node live-activity-test.mjs update "Retest after check"`. A different message is a deliberate new event; repeating the same message retains its request. Use a different `SCRIPTING_REMOTE_TEST_FILE` for a separate test session, and end old activities first. `SCRIPTING_PUSH_BASE_URL` optionally selects your configured server; the default is `https://push.scripting.fun`.

## Limits and failures

JSON body: 64 KiB; widget state: 16 KiB; complete escaped Activity APNs payload: 4 KiB. State replaces the full JSON value. Notifications and updates share the [daily push quota](scripting://doc?title=Remote%20Updates%20Overview).

Errors are `{ok:false,code,error?,details?,request_id?,timestamp?}`. HTTP 400 indicates invalid arguments/schema/payload; 401 invalid or expired credentials; 403 denied scope or unavailable account access; 404 invisible resources; 409 stale revisions, conflicting idempotency or pending tokens; 410 revoked resources; 429 exhausted quota/rate limit. Inspect `code`: `VERSION_CONFLICT` needs a fresh read and business decision, `IDEMPOTENCY_CONFLICT` needs corrected request persistence, `TOKEN_PENDING` needs registration, and `PUSH_LIMIT_EXCEEDED` needs available daily quota. These are not reasons to loop with a new key.

Poll the operation after acceptance. An `unknown` start must be reconciled using the same launch; do not start another instance. Retries retain the same idempotency key and payload. A new business lifecycle deliberately uses a new generation.
