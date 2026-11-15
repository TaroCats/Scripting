# DownloadManager

`DownloadManager` is a global API for persistent HTTP/HTTPS download queues in main-app scripts (`Script.env === "index"`, `"home_screen"`, or `"camera_control"`). No import is required. Each script has its own queues and task records.

```ts
const queue = await DownloadManager.open({ identifier: 'videos' })
const task = await queue.download({
  url: 'https://example.com/video.mp4',
  destination: FileManager.documentsDirectory + '/video.mp4',
  notifyOnFinished: { success: 'Download finished', failure: 'Download failed' }
})
task.onProgress = progress => console.log(progress.fractionCompleted)
task.onStateChange = snapshot => console.log(snapshot.state)
const filePath = await task.waitUntilFinished()
console.log(filePath)
```

Omit `destination` to use a persistent app-managed file. An explicit destination must be an absolute local file path. Parent directories are created when publishing. Existing files are never overwritten. Remote WebDAV paths and other virtual locations are not local download destinations.

## Modes and configuration

| Capability | `background` (default) | `foreground` |
| --- | --- | --- |
| Native iOS background transfer | Yes | Pauses when the app enters the background |
| Concurrent files | 1–6 | 1–6 |
| Multiple Range requests per file | No | 1–8, server permitting |
| Average payload rate limit | No | Yes, with Range support and a stable resource validator |
| Resume across script runs | Yes | Yes; reconnect and resume explicitly |
| Resource timeout | Checked when the app executes | Remaining budget checked before each request; URLSession also enforces request resource timeouts |

Background transfers are scheduled by iOS and can continue after a script exits. Force-quitting the app stops background transfers until the app is opened again. A callback only runs while that script's JS environment is alive. Foreground queues pause when the app enters the background; backgrounding does not secretly change a task's mode or turn off its rate limit.

```ts
const queue = await DownloadManager.open({
  identifier: 'large-files',
  mode: 'foreground',
  maxConcurrentTasks: 2,
  maxConnectionsPerTask: 4,
  chunkSize: 1024 * 1024,
  bytesPerSecond: 2 * 1024 * 1024,
  timeoutIntervalForRequest: 30,
  timeoutIntervalForResource: 3600,
  retry: { maxAttempts: 4, baseDelay: 1, maxDelay: 30 }
})
```

Defaults: `mode: 'background'`, `maxConcurrentTasks: 3`, `maxConnectionsPerTask: 1`, `chunkSize: 1048576`, `bytesPerSecond: 0`, request timeout 60 seconds, active resource deadline 86400 seconds, `allowsCellularAccess: false`, expensive/constrained network access enabled, `progressInterval: 0.3` seconds. `chunkSize` accepts 64 KiB–16 MiB; progress intervals accept 0.1–10 seconds. Nonzero rates must be at least 1 byte/second.

`open` restores an existing queue before returning. Omitted options inherit its configuration; explicitly different options reject with `configurationConflict`. Use `updateConfiguration` to change settings. Suspend running tasks before changing mode, connections, chunk layout, network policies, timeouts or rate. Concurrency, progress interval and retry policy can be updated while running. Changes apply to subsequent attempts; a current foreground transfer retains its transport settings.

At most 64 distinct queues can be opened across scripts in one app process. Reuse identifiers for recurring work. Disposing a JS handle releases its subscriptions; the native queue remains registered so accepted downloads can continue. Remove unused tasks and clear their cache to reclaim transfer files; records and published outputs remain persistent.

Rate limiting spaces bounded Range requests across the queue. It is an average payload target with bursts of up to a chunk per active connection; it is not a strict network-interface byte ceiling. Without Range support or a usable validator, a rate-limited transfer fails explicitly. Other foreground downloads safely use a complete response when Range is ignored or reliable segmentation is unavailable. iOS may multiplex requests, so a connection count controls concurrent Range requests rather than guaranteeing separate TCP connections.

## Queue methods

- `download(options): Promise<DownloadManager.Task>` validates/persists a task and automatically queues it. Options: `url`, optional `destination`, `headers`, `priority` (0–1, default 0.5), `checksum: { algorithm, checksum }`, and `notifyOnFinished: { success, failure }`.
- `downloadMany(options[]): Promise<BatchDownloadResult[]>` accepts up to 1000 inputs. Invalid options reject before creating tasks. Operational conflicts produce ordered `{ task, error }` results; successful tasks are retained.
- `getTasks()` lists nonremoved task handles, including completed, failed and canceled records. `getTask(id)` and `getTaskByURL(url)` return a handle or `null`.
- `getSnapshot()` returns configuration, capabilities, task/running/completed/failed counts, total/completed bytes, speed and ETA. Unknown totals/ETA are `null`.
- `resumeAll()`, `suspendAll()`, `cancelAll()` and `removeAll({ deleteFile?: boolean })` return per-task errors as `{ id, error }[]`. They are sequential operations, not an atomic transaction.
- `reorder(ids)` requires each current nonremoved task id exactly once. Higher priority is scheduled first, then list order. Running transfers are not interrupted by reordering.
- `getCacheInfo()` reports owned on-disk bytes and task count. `clearCache()` clears terminal tasks' internal transfer files, preserving records and published outputs; unfinished tasks must first be canceled/removed.
- `dispose()` detaches this queue handle and callbacks, without canceling accepted downloads. Reopen the queue to reconnect.

Within one queue a URL identifies one nonremoved task. Calling `download` with identical options returns that task; different options reject with `duplicateTaskConflict`. Use a different queue for simultaneous copies of the same URL with different credentials or targets. Destination reservations also apply across queues. Canceled tasks retain their reservation until removed, allowing a safe restart.

`queue.onProgress` receives the aggregate snapshot. `queue.onStateChange` receives the changed task snapshot. `queue.onComplete` fires when the current work has no unfinished tasks; inspect `failedCount` and task states to distinguish successful downloads from failure/cancellation. Suspended tasks are unfinished. Callbacks are not replayed on attachment.

## Task methods and snapshots

Task handles expose a stable `id`, `onProgress`, `onStateChange`, `onComplete` and these methods:

- `getSnapshot()` returns the URL/final response URL, status/headers, output path/name, state, priority, progress, attempt count, timestamps (Unix seconds), resumability, parts, validation and structured error. Request credentials are not returned; sensitive response headers are omitted.
- `resume()` resumes waiting/suspended/failed tasks. Invalid native resume data may require a complete transfer. `suspend()` keeps resumable data where available. `cancel()` discards unfinished transfer data but preserves an already published file.
- `restart()` discards partial data and starts over. Completed files require explicit removal and a new destination/download before restarting.
- `remove({ deleteFile?: boolean })` removes the task's internal data/record from normal listings. Published files are preserved by default. With `deleteFile: true`, deletion is allowed only while the file still matches this task's stored SHA-256 ownership fingerprint.
- `setPriority(value)` updates scheduling priority. `updateHeaders(headers)` is allowed while suspended/failed/canceled and invalidates partial data before accepting new representation credentials.
- `validateFile({ algorithm, checksum })` verifies a completed file, returning `true`/`false`; file access failures reject. Supported algorithms: `md5`, `sha1`, `sha256`, `sha512`; use SHA-256 or stronger for integrity checks.
- `waitUntilFinished()` returns the published file path immediately for a completed task, waits through retries/pause/resume, or rejects on final failure/cancellation/removal. It detects a missing output file. Multiple waiters are independent.

`onProgress` receives `{ completedBytes, totalBytes, fractionCompleted, bytesPerSecond, estimatedTimeRemaining }`; unknown values are `null`. Progress may reset when an interrupted representation must restart. `onStateChange` receives a snapshot. `onComplete(error, snapshot)` fires once per terminal attempt while the script is alive. Use `getSnapshot`/`waitUntilFinished` after reconnecting instead of relying on callback replay.

States: `waiting`, `running`, `retrying`, `suspended`, `verifying`, `publishing`, `completed`, `failed`, `canceled`, `removed`. Validation/publication is protected against control operations; `taskBusy` requests that callers wait for it to finish.

```ts
const queue = await DownloadManager.open({ identifier: 'videos' })
for (const task of await queue.getTasks()) {
  const snapshot = await task.getSnapshot()
  console.log(task.id, snapshot.state, snapshot.destination)
  if (snapshot.state === 'suspended') await task.resume()
}
```

## Protocol correctness, retries and recovery

Only HTTP(S) URLs without embedded credentials/fragments are accepted. Headers are validated; `Range`, `If-Range`, `Accept-Encoding`, `Host` and `Content-Length` are reserved. Foreground cross-origin redirects strip custom credentials; HTTPS downgrade redirects are refused. Background redirect/security handling follows native URLSession behavior. TLS certificate verification is always enabled.

Foreground segmentation validates 206, Content-Range, total/part byte counts and stable strong ETag (or sufficiently old Last-Modified relative to Date). Encoded/mismatched ranges or a resource version change are never appended. Confirmed parts have stored SHA-256 digests and are checked on restoration. At most 100000 parts are allowed; increase chunk size for larger files.

Retries default to 3 total attempts, exponential delay from 1 to 60 seconds with jitter, and HTTP 408/429/500/502/503/504. Numeric/date `Retry-After` is honored up to one day. Selected temporary transport errors are retryable; authentication, invalid ranges, invalid parameters, checksum and local file errors are not retried automatically. Foreground resource budgets are checked before each request; in-flight requests also use URLSession resource timeouts. This is not a wall-clock guarantee covering file hashing/publication. Background retry times/deadlines may be delayed while iOS suspends the app. Errors expose `code`, `message`, optional `statusCode`, `retryable`, optional `retryAfter`.

Downloads persist metadata and confirmed parts in local Application Support storage. Completion is reported only after optional expected-checksum verification, a durable staging copy and publication at the final path. A crash between rename and metadata commit is reconciled using the stored fingerprint. Local files may still be lost if the user deletes app data. Queue identity follows the script's native storage/permission scope; changing the script's identity/name does not promise automatic queue migration.
