`Python` 全局对象可以从 JavaScript 或 TypeScript 运行 Python 代码片段和文件，与 Python 入口脚本共用内嵌解释器。

内嵌运行时包含 [NumPy](scripting://doc?title=NumPy)，可用于数组计算和线性代数。

每次 `Python.run` 调用都使用新的顶层变量。解释器会在调用间保留，并可能复用已导入的库。请在 `code` 中写明本次使用的导入和计算。

`Shell.run` 与 `Python.run` 共享同一条串行队列:其中一个执行时,其他调用排队等待。内嵌 Python 解释器与 `ios_system` 共享全局状态(env 变量、`sys.modules`),不可并发执行。

> 当前版本**不支持** `options.timeout` —— 长时运行的 Python 片段会阻塞后续的 `Shell.run` / `Python.run` 调用直到结束。如有需要请在代码内自行实现超时逻辑。

---

## 方法

### `Python.run(code, options?): Promise<{ output, exitCode }>`

执行一段 Python 代码。代码退出时返回。

```ts
function run(code: string, options?: ShellRunOptions): Promise<{
  output: string
  exitCode: number
}>
```

#### `ShellRunOptions`

| 名称            | 类型                       | 必填 | 说明 |
| --------------- | -------------------------- | ---- | ---- |
| cwd             | string                     | 否   | 代码片段的工作目录(Python 内 `os.getcwd()`)。调用结束后恢复。 |
| env             | Record<string, string>     | 否   | 本次调用的额外环境变量，Python 的 `os.environ` 和原生代码均可读取。 |
| queryParameters | Record<string, string>     | 否   | 便利字段 —— 序列化为 JSON 后以 `os.environ["SCRIPTING_QUERY_PARAMETERS"]` 暴露。等同于 `Script.queryParameters`。 |
| timeout         | number                     | 否   | 当前版本**不生效**(保留供与 `Shell.run` 接口对齐)。 |

#### 返回值

| 名称      | 类型    | 说明 |
| --------- | ------- | ---- |
| output    | string  | 代码片段的 stdout + stderr 合并输出。 |
| exitCode  | number  | 成功为 `0`。非零值(例如脚本抛出未捕获异常)以 resolve 返回,不会 reject;只有参数缺失才 reject。 |

JavaScript 的返回值还包含 `timedOut` 和 `cancelled`，两项均为 `false`。

---

### `Python.runFile(path, options?)`

以 `__main__` 运行 Python 文件。可以传绝对路径，或传相对于 `options.cwd` 的路径。Python 优先从文件所在目录查找导入。选项和返回值与 `Python.run` 相同。

重新运行 Python 文件（包括 Python 入口脚本）时，会重新加载文件所在目录及其子目录中的普通 Python 源码模块。已安装的包、原生扩展及其父包会保留。传入 `cwd` 时，`Python.run` 也会刷新该目录下的本地源码模块。

如果项目中已有 Python 字节码缓存，Python 仍按自身规则校验缓存。

### 调用原生函数

`ctypes` 会在 Scripting 进程内调用原生代码。C 函数签名错误或指针无效可能直接终止 App，此时 Python 无法抛出异常，JavaScript 也收不到执行结果。在 TypeScript 中做数值运算可以参考 [Accelerate 文档](scripting://doc?title=Accelerate)。

如果 App 进程在 Python 项目运行期间结束，重新打开 App 后，可在**脚本运行日志**查看项目及开始时间。该条记录说明运行发生中断，iOS 结束进程可能有多种原因。普通 Python 错误与退出码仍显示在原有运行输出中。

---

## 示例

### 基本片段

```ts
const r = await Python.run("print(1 + 2)")
console.log(r.output)   // "3\n"
console.log(r.exitCode) // 0
```

### 读取参数

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

### 使用 Python 库

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

### 处理错误

```ts
const r = await Python.run("raise RuntimeError('boom')")
if (r.exitCode !== 0) {
  console.log("代码片段失败:")
  console.log(r.output) // 含 Python traceback
}
```

### 工作目录

```ts
const r = await Python.run("import os; print(os.listdir('.'))", {
  cwd: "/tmp",
})
console.log(r.output) // /tmp 下的内容
```
