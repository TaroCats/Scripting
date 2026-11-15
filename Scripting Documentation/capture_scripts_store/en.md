`$persistentStore` gives a capture rule script a small key-value store that persists across runs. Use it to remember a token, a counter, or any small string between requests. Values saved under a key you choose are visible to every capture script; the one saved without a key belongs to your script alone. It is available only inside [capture rule scripts](capture_scripts/en.md).

---

## Methods

```ts
$persistentStore.read(key?: string): string | null
$persistentStore.write(value: string | null, key?: string): boolean
$persistentStore.compareAndWrite(expected: string | null, value: string | null, key?: string): boolean
$persistentStore.remove(key?: string): boolean
```

* `read` returns the stored string, or `null` if the key is absent.
* `write` stores a string and returns `true`. It returns `false` and stores nothing if the value is not a string it can accept, or is over the size limit — see Notes. Passing `null` as the value deletes the key, exactly like `remove`.
* `compareAndWrite` writes only if the key holds exactly `expected` right now, and returns whether it did. Pass `null` as `expected` to mean *this key must not exist yet*. Once the comparison passes it behaves exactly like `write`, so passing `null` as the value is a conditional delete.
* `remove` deletes the key and returns `true`.

If `key` is omitted, a default key is used. That default key belongs to **the script**, not to the module that installed it: two rules that run the same script share it — including rules in two different modules that point at the same `script-path` — and a different script gets its own. Pass an explicit `key` when you want to share a value between different scripts.

A duplicated module is the one exception: its copy starts with an empty default key of its own, even though it points at the same script. That is what makes it possible to run two copies of the same module side by side — one per account, say — without them writing over each other. Rules inside the copy still share with each other as usual.

---

## Concurrent reads and writes

Each `read`, `write`, and `remove` completes synchronously. Script executions share the current stored values, but a sequence of separate calls is **not a transaction**: another script may write between your read and write, even without an asynchronous step.

**Migration:** older versions shared one execution environment and documented uninterrupted synchronous read–compare–write blocks. Independent script sessions no longer provide that extra guarantee. Use `compareAndWrite` for conditional updates and counters; moving a read inside a callback alone is insufficient.

```js
// The comparison and update are one atomic operation.
if ($persistentStore.compareAndWrite("5", "6", "revision")) {
  // This call changed revision 5 to 6.
}
```

`compareAndWrite` is a Scripting extension. Handle `false` explicitly, and bound any retry loop as shown below.

---

## Committing a value you read before an asynchronous step

Re-reading inside the callback does not help when the value you read is what the request was *about* — asking a server for a new token based on revision 5, say. By the time the answer comes back you cannot simply write it: someone else may have moved on to revision 6, and the token you were given is for a revision that is no longer current.

`compareAndWrite` carries the condition through to the moment of the write:

```js
const seen = $persistentStore.read("revision")
$httpClient.get("https://example.com/token?rev=" + seen, (err, resp, data) => {
  if ($persistentStore.compareAndWrite(seen, data, "revision")) {
    // Nobody changed it while the request was in flight. This is the only run that got here.
  } else {
    // Someone else committed first. Whatever came back is stale — start over, or give up.
  }
  $done({})
})
```

Passing `null` as `expected` means *this key must not exist yet*, which is how you let exactly one script create something:

```js
// Of all the scripts that race to do this, exactly one gets true.
if ($persistentStore.compareAndWrite(null, deviceID, "device-id")) { /* we created it */ }
```

**Retry loops must be bounded.** A failed `compareAndWrite` has two possible causes, and only one of them is worth retrying:

* Someone else got there first. Nothing is written to the script log — this is an ordinary outcome.
* The value or the key was refused (an object, `undefined`, over the size limit, a reserved key). A note **is** written to the script log, and retrying will fail the same way forever.

An unbounded retry loop consumes execution time and resources and may time out. Count the attempts:

```js
let committed = false
for (let attempt = 0; attempt < 5 && !committed; attempt++) {
  const seen = $persistentStore.read("counter")
  committed = $persistentStore.compareAndWrite(seen, String(Number(seen || "0") + 1), "counter")
}
```

**Scope of the guarantee.** A conditional write compares the current value at the moment of the update. It does not reserve the key or prevent later edits. Stored values survive between executions; ordinary script globals do not.

---

## Notes

* Values are strings. Numbers and booleans are converted; objects and arrays are **rejected** (`write` returns `false`) — serialize them with `JSON.stringify` first and parse with `JSON.parse` on the way out.
* `write(undefined, key)` is also rejected, and leaves whatever was there untouched. This is on purpose: `undefined` is what you get from a header or field that was not there, and deleting a good value because of a missing field is rarely what you meant. Use `null` when you really mean delete.
* A single value can be at most 4 MB. `write` returns `false` and stores nothing if the value is larger, and a note appears in the script log.
* Values persist until they are removed. Reinstalling the app clears them.
* Keys cannot start with `scope:`. That prefix is reserved for the slot each script gets when no key is given, so a key that used it could write straight into another script's slot. `read`, `write` and `remove` refuse such a key and a note appears in the script log.
* Values are stored as plain text. Treat them the same way you treat anything else on the device: fine for a session token, not a place to keep something you would not want another script to read — any script can read any key whose name it knows.

---

## Example

```js
// Remember the last seen request URL.
const previous = $persistentStore.read("last")
$persistentStore.write($request.url, "last")
console.log("previous:", previous)
$done({})
```

```js
// Store and read a JSON object.
$persistentStore.write(JSON.stringify({ count: 3 }), "state")
const state = JSON.parse($persistentStore.read("state") || "{}")
```

```js
// Delete a value. These two lines do the same thing.
$persistentStore.write(null, "state")
$persistentStore.remove("state")
```
