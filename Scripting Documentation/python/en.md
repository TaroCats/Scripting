The `Python` global runs Python code snippets and files from JavaScript or TypeScript. It uses the same embedded interpreter as Python index scripts.

The embedded runtime includes [NumPy](scripting://doc?title=NumPy) for array computations and linear algebra.

Each `Python.run` call starts with fresh top-level variables. The interpreter stays available between calls and may reuse previously imported libraries. Set up imports and computed values inside `code`.

`Shell.run` and `Python.run` share a single serial queue: while one is running, others wait. The embedded Python interpreter shares global state (env vars, `sys.modules`) with `ios_system`, so the two cannot run concurrently.

> The current version does **not** honor `options.timeout` — long-running Python snippets will block subsequent `Shell.run` / `Python.run` calls until they finish. Wrap your code with your own timeout logic if needed.

---

## Methods

### `Python.run(code, options?): Promise<{ output, exitCode }>`

Execute a Python code snippet. Returns when the snippet exits.

```ts
function run(code: string, options?: ShellRunOptions): Promise<{
  output: string
  exitCode: number
}>
```

#### `ShellRunOptions`

| Name            | Type                       | Required | Description |
| --------------- | -------------------------- | -------- | ----------- |
| cwd             | string                     | No       | Working directory for the snippet (`os.getcwd()` inside Python). Restored after the call. |
| env             | Record<string, string>     | No       | Extra environment variables visible in `os.environ` and to native code during the call. |
| queryParameters | Record<string, string>     | No       | Convenience field — serialized as JSON and exposed as `os.environ["SCRIPTING_QUERY_PARAMETERS"]`. Mirrors `Script.queryParameters`. |
| timeout         | number                     | No       | **Not honored** in the current version (kept for API parity with `Shell.run`). |

#### Result

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| output    | string  | Combined stdout + stderr produced by the snippet. |
| exitCode  | number  | `0` on success. Non-zero values (e.g. when the snippet raises an unhandled exception) resolve normally; only argument validation errors reject the promise. |

The JavaScript result also includes `timedOut` and `cancelled`, both set to `false`.

---

### `Python.runFile(path, options?)`

Run a Python file as `__main__`. Use an absolute path or resolve a relative path against `options.cwd` when supplied. Python searches the file's directory first for imports. The result and options are the same as for `Python.run`.

Running a Python file again, including a Python index script, reloads ordinary Python source modules from the file's directory and its subdirectories. Installed packages, native extensions, and their parent packages stay loaded. `Python.run` also refreshes local source modules when you supply `cwd`.

When a project already contains Python bytecode caches, Python applies its usual cache validation rules.

### Calling native functions

`ctypes` calls native code inside the Scripting process. An incorrect C signature or invalid pointer can terminate the app before Python can raise an exception or JavaScript can receive a result. For numerical operations from TypeScript, see the [Accelerate documentation](scripting://doc?title=Accelerate).

When the app process ends while a Python project is running, open **Script Run Logs** after relaunch to see the project and its start time. The entry records an interruption. iOS can end a process for several reasons. Ordinary Python errors and exit codes still appear in the usual run output.

---

## Examples

### Basic snippet

```ts
const r = await Python.run("print(1 + 2)")
console.log(r.output)   // "3\n"
console.log(r.exitCode) // 0
```

### Reading parameters

```ts
const r = await Python.run(`
import os, json
qp = json.loads(os.environ["SCRIPTING_QUERY_PARAMETERS"])
print(f"hello {qp['name']}")
`, {
  queryParameters: { name: "Alice" },
})
console.log(r.output) // "hello Alice\n"
```

### Using a Python library

```ts
const r = await Python.run(`
import statistics
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
print(f"mean={statistics.mean(data):.2f}")
print(f"stdev={statistics.stdev(data):.2f}")
`)
console.log(r.output)
// mean=5.50
// stdev=3.03
```

### Handling errors

```ts
const r = await Python.run("raise RuntimeError('boom')")
if (r.exitCode !== 0) {
  console.log("snippet failed:")
  console.log(r.output) // contains the Python traceback
}
```

### Working directory

```ts
const r = await Python.run("import os; print(os.listdir('.'))", {
  cwd: "/tmp",
})
console.log(r.output) // contents of /tmp
```
