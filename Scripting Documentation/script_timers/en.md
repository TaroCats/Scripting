# Timers and scheduling

## Choose the import

| Form | How to use it | Return value |
| --- | --- | --- |
| Global timers | Call `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` directly; no import | Numeric ID |
| Node callbacks | Import from built-in `node:timers` (or `timers`) | Timeout / Immediate handle |
| Node promises | Import from built-in `node:timers/promises` | Promise / async iterator |
| Microtasks | Global `process.nextTick` and `queueMicrotask`; no import | No cancellable timer handle |

No npm installation or import from `scripting` is required. Global `setImmediate` / `clearImmediate` are also provided by Node compatibility and use Immediate handles; the examples import them explicitly to make their source clear. Each block below is an independent complete App script; do not add `Script.exit()` while its work is pending. `process`, `AbortController` and `console` are globals.

### Global interval

Prints approximately three `tick` messages and clears the numeric interval ID in `finally`.

```ts
// Global functions: no import and no npm installation.
const interval = setInterval((message: string) => console.log(message), 1000, "tick")
try {
  await new Promise<void>(resolve => setTimeout(resolve, 3200))
} finally {
  clearInterval(interval)
}
```

### Node handles and microtasks

The cancelled callbacks do not run. The two microtask messages are printed; no V8-specific priority ordering is promised.

```ts
import { setTimeout as schedule, clearTimeout as cancel, setImmediate, clearImmediate } from "node:timers"
import { setTimeout as sleep } from "node:timers/promises"

const timeout = schedule(() => console.log("cancelled callback"), 1000)
cancel(timeout)
const immediate = setImmediate(() => console.log("cancelled immediate"))
clearImmediate(immediate)
process.nextTick((message: string) => console.log(message), "nextTick")
queueMicrotask(() => console.log("microtask"))
await sleep(20) // only nextTick and microtask messages are expected
```

### Promise delay and async interval

Prints three `tick` messages followed by `done`. Breaking the loop closes its interval; `finally` also aborts the owned controller.

```ts
import { setTimeout as sleep, setInterval as ticks, scheduler } from "node:timers/promises"

async function main() {
  // AbortController and console are globals.
  await sleep(100)
  const controller = new AbortController()
  let count = 0
  try {
    for await (const value of ticks(100, "tick", { signal: controller.signal })) {
      console.log(value)
      if (++count === 3) break
    }
  } finally {
    controller.abort()
  }
  await scheduler.yield()
  console.log("done")
}

void main()
```

## Behavior and migration

Global callbacks must be functions; string execution is unsupported. Missing, non-finite, negative, zero or greater-than-2147483647 delays use 1 ms; other delays are truncated to integer milliseconds. `clearTimeout` and `clearInterval` can cancel either global kind. Timers run on the script queue and are cancelled at script exit.

`timers` / `node:timers` returns Timeout handles with `close()`, `refresh()`, `ref()`, `unref()`, `hasRef()` and numeric conversion. Clear functions accept a handle or numeric ID. `refresh()` restarts a live or expired timer; a handle explicitly cleared through the module stays cancelled. `setImmediate(callback,...args)` returns a cancellable Immediate handle; `clearImmediate()` accepts that handle. `ref/unref` record intent but do not control the App's process lifetime or prevent iOS suspension.

`timers/promises` / `node:timers/promises` provides `setTimeout`, `setImmediate`, async-iterator `setInterval`, `scheduler.wait` and `scheduler.yield`. Options accept `signal` and `ref`. Aborting rejects with `name: "AbortError"`, `code: "ABORT_ERR"` and `cause: signal.reason`. Iterator `return()` finishes pending reads; `throw()` and abort reject them and clear resources. Unconsumed ticks are counted without allocating a queue of values. Up to 1024 concurrent `next()` calls are supported; excessive pending ticks also report a bounded overflow error.

`process.nextTick(callback,...args)` and `queueMicrotask(callback)` use JavaScriptCore's Promise microtask queue. They validate function arguments. This runtime does not implement V8's separate nextTick priority queue. Immediate callbacks use a later timer turn.

Timers are scheduling requests, not real-time clocks. A busy queue or iOS background suspension can delay callbacks and coalesce interval ticks; intervals do not run callbacks concurrently. Background work needs the App's existing background capability where applicable. Each context supports 4096 active timers and 1024 additional callback arguments.

Migration: the previous global timer fallback was 16 ms; pass `16` explicitly if your script relies on it. `setImmediate` previously returned a number at runtime and now returns the declared Node-style handle. Pass it directly to `clearImmediate`; use `Number(handle)` only when a numeric token is needed. Global `setTimeout` and `setInterval` continue to return numbers.

[Node modules and import guide](../node_compat/en.md).
