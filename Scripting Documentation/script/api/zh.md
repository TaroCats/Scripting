`Script` 模块为 Scripting App 中的脚本执行提供上下文和实用函数。它允许你访问运行时元数据、通过结果终止脚本、以编程方式运行其他脚本，并构造 URL Scheme 启动或打开脚本。


## 调用来源

`Script.invocation` 表示首次启动当前实例的来源。它是冻结快照，后续恢复或服务请求不会改写它。

```ts
import { Script } from "scripting"

const initial = Script.invocation
console.log(initial.source, initial.caller?.name, initial.caller?.env)

Script.onResume(event => {
  // 本次恢复的来源，不是首次启动来源。
  console.log(event.invocation.caller?.name)
})
```

快照包含 `id`、`source` 和 `caller`。`source` 为 `"scriptRun"`、`"scriptSessionCall"`、`"scriptSessionRequest"` 或 `"other"`。已知调用者包含 `name` 和 `env`；调用方环境与接收脚本的 `Script.env` 不同。直接或外部启动使用 `"other"` 和 `caller: null`；无法确认调用者的兼容路径也可能返回 `"scriptRun"` 和空 caller。本次 JavaScript 功能不承诺 Python 调用方/目标具备对应来源 API。

每次恢复都有独立快照，跨 `await` 保存事件后，其调用者不会被后续事件覆盖。名称描述本次的直接调用者，不是永久身份、完整调用链或授权凭据。来源由宿主提供，`queryParameters` 中自定义的 `caller` 只是业务数据。

识别当前 `ScriptSession` 请求时，请使用回调第二参数中的 `request.caller` 和 `request.source`，不要读取 `Script.invocation`。服务冷启动记录触发启动的调用者；加入同一次启动的其他调用者仍有各自的请求来源。`Script.run` 仍等待脚本最终退出结果。

---

## 属性（Properties）

### `name: string`

当前正在运行的脚本名称。

```ts
console.log(Script.name) // 示例: "MyScript"
```

---

### `directory: string`

当前脚本所在的目录路径。

```ts
console.log(Script.directory) // 示例: "/private/var/mobile/Containers/..."
```

---

### `env: string`

表示当前脚本运行的环境类型，用于根据上下文动态调整脚本行为，例如判断是否处于主应用、组件、通知或扩展中。

### 可选值说明：

| 值                  | 说明                                                    |
| ------------------ | ----------------------------------------------------- |
| `"index"`          | 主应用环境中运行，入口文件为 `index.tsx`。用于普通应用逻辑和界面展示。             |
| `"widget"`         | 小组件中运行，入口文件为 `widget.tsx`。用于生成主屏幕组件内容。                |
| `"control_widget"` | 控制中心小组件中运行，入口文件为 `control_widget_button.tsx`或`control_widget_toggle.tsx`。用于控制中心小组件的按钮或开关控件。                |
| `"notification"`   | 富通知扩展中运行，入口文件为 `notification.tsx`。用于自定义通知界面。          |
| `"intent"`         | 通过快捷指令或分享面板触发的脚本，入口文件为 `intent.tsx`。                  |
| `"app_intents"`    | App Intents 扩展中运行，入口文件为 `app_intents.tsx`。用于原生快捷指令集成。 |
| `"assistant_tool"` | Assistant Tool 工具模式中运行，入口文件为 `assistant_tool.tsx`。    |
| `"keyboard"`       | 自定义键盘扩展中运行，入口文件为 `keyboard.tsx`。用于实现个性化键盘逻辑。          |
| `"live_activity"`  | LiveActivity 扩展中运行，入口文件为 `live_activity.tsx`。用于实现实时活动逻辑。          |
| `"home_screen"`    | 作为 App 首页的 Home Tab 渲染，入口文件为 `home_screen_default_ui.tsx`。常驻运行，可用 `Script.onHomeTabEvent` 监听 Tab 事件。 |
| `"camera_control"` | 相机控制入口或原生拍摄资源交接，在主 App 中运行 `index.tsx`，API 范围与 index/home_screen 一致。 |

API 范围一致并不解除[系统拍摄入口要求](../../camera_control/)。`camera_control` 是环境标识，不能证明具体系统启动来源。自定义脚本自行管理相机会话，Scripting 不会自动提供采集或在恢复时重启相机。纯文件交接不要求新建相机会话。

### 示例：

```ts
if (Script.env === "widget") {
  Widget.present(<MyWidget />)
} else if (Script.env === "index") {
  Navigation.present({ element: <MainPage /> })
}
```

---

### `widgetParameter: string`

从小组件启动脚本时传入的参数。

```ts
if (Script.widgetParameter) {
  console.log("Widget input:", Script.widgetParameter)
}
```

---

### `queryParameters: Record<string, any>`

传入脚本的参数。

当脚本以 JSON 对象方式启动时——例如 `Script.run({ queryParameters })`、`scripting-ts run ... --queryparameters '<json>'` 命令，或键盘的 `switchToScript` API——会保留原始 JSON 值的类型（布尔、数字、`null`、数组、对象）。

当脚本通过 `run` URL Scheme 启动时，所有值都是字符串，因为 URL 查询字符串无法携带带类型的值。

```ts
// 以 JSON 对象启动：{ "enabled": true, "count": 3, "user": "John" }
console.log(Script.queryParameters.enabled) // true（布尔）
console.log(Script.queryParameters.count)   // 3（数字）
console.log(Script.queryParameters.user)    // "John"（字符串）

// 通过 URL 启动：scripting://run/MyScript?user=John&id=123
console.log(Script.queryParameters.user) // "John"
console.log(Script.queryParameters.id)   // "123"
```

---

### `metadata: { ... }`

当前脚本的元数据信息。

* `icon`: 脚本图标，可以是系统图标(SFSymbol)名称
* `color`: 脚本颜色，可以是十六进制颜色字符串（如 `#FF0000`）或 CSS 颜色名称（如 `"red"`）
* `localizedName`: 当前系统语言下的脚本本地化名称
* `localizedNames`: 不同语言下的本地化名称，键为语言代码，值为对应的名称
* `description`: 脚本的英文描述
* `localizedDescription`: 当前系统语言下的本地化描述
* `localizedDescriptions`: 不同语言下的本地化描述，键为语言代码，值为对应描述
* `version`: 脚本的版本字符串
* `author`: 作者信息对象：

  * `name`: 作者姓名
  * `email`: 作者电子邮箱
  * `homepage`: 作者个人主页（可选）
* `contributors`: 贡献者信息数组，每项结构同 `author`
* `remoteResource`: 远程资源信息：

  * `url`: 远程资源地址（可以是 zip 文件或 Git 仓库）
  * `autoUpdateInterval`: 自动更新间隔时间（单位：秒），若未设置则不自动更新

```ts
console.log(Script.metadata.localizedName) // 示例: "天气助手"
console.log(Script.metadata.version)       // 示例: "1.2.0"
```

---

## 方法（Methods）

### `Script.exit(result?): void`

脚本正常完成时，调用此方法释放资源，并可选地返回结果。

* `result?: any | IntentValue`: 要返回的值，可以是任意类型，也可以是 `IntentValue` 对象（例如返回给快捷指令或其他脚本）

```ts
Script.exit("Done")

// 或返回结构化数据
Script.exit(Intent.json({ status: "ok" }))
```

---

### `Script.onError(callback: (error: unknown) => void): () => void`

监听 App 中普通脚本由运行时报告的未捕获 JavaScript 异常。回调收到原始抛出值，它可以是任意 JavaScript 值。调用返回的函数可以取消监听。

Scripting 会先同步调用监听器，再结束当前脚本实例并释放其资源，包括该实例创建的 TCP 监听和连接。即使回调返回 Promise，退出流程也会在回调返回后立即继续。可恢复的错误用 `try/catch` 处理，Promise 拒绝用 `.catch()` 或在 `await` 外层使用 `try/catch` 处理。

```ts
import { Script } from "scripting"

const unsubscribe = Script.onError(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
})

// 无需继续监听时调用 unsubscribe()。
```

Node 兼容代码可以通过 `process.on("uncaughtExceptionMonitor", callback)` 监听同一异常。回调收到原始抛出值和来源 `"uncaughtException"`。如果同时注册两个 API，两个回调都会在脚本退出前收到同一次异常。

```ts
import process from "node:process"

process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.error(origin, error)
})
```

---

### `Script.run<T>(options): Promise<T | null>`

以编程方式运行另一个脚本，并等待其结果。

* `options.name`: 要运行的脚本名称
* `options.queryParameters`: 可选参数，作为 `Script.queryParameters` 传给目标脚本，保留 JSON 值的类型
* `options.singleMode`: 若为 `true`，确保同一脚本只能同时运行一个实例

JavaScript 目标每次在新实例中运行。Scripting 会显示哪个脚本正在调用哪个目标，并询问如何处理该调用。选择**始终允许此调用**后，这两个脚本之间的同向调用会跳过启动确认。**仅允许本次启动**只对新实例生效。两个允许选项都让目标使用已获准的脚本权限，并按需申请尚未决定的权限。同步 API 需要权限时，目标可以先调用 `await Script.requestAccess(...)`。权限请求遵循目标已保存的决定，包括明确拒绝项。

对于 JavaScript 目标，选择**不使用脚本权限，继续**后，本次运行无法使用受脚本权限保护的 API。当前环境无法显示确认框且没有适用的已保存决定时，也按这种方式运行。选择**始终阻止此调用**后，Promise 会以 `SCRIPT_INVOCATION_BLOCKED` 拒绝，目标不会启动，已有实例也不会被关闭。无法记住调用决定时，**阻止本次调用**仅对当前调用生效。可以在**设置 → 脚本权限 → 脚本调用**查看和更改已保存的决定。Python 目标沿用其运行时的权限规则。

返回目标脚本中 `Script.exit(result)` 返回的值。

```ts
const result = await Script.run({
  name: "ProcessData",
  queryParameters: { input: "abc" }
})

console.log(result)
```

如果目标脚本依赖已有权限，例如读取通讯录，可以这样调用：

```ts
const result = await Script.run({
  name: "FindContact",
  queryParameters: { name: "Alice" }
})
```

目标脚本应处理访问被拒绝的情况，以便仍能返回有用的结果。每一层嵌套启动都按各自的调用方和目标决定。账号、共享数据存储和系统访问各自遵循对应的授权规则。

通过此方法启动的 JavaScript 不能使用 Shell 或 Python 运行代码，也不能通过 `Safari.openURL()` 打开 `scripting://` URL。`ScriptSession.call()` 使用相同的调用决定。已运行的服务继续使用现有实例的权限。

---

### `Script.createRunURLScheme(scriptName, queryParameters?): string`

生成一个 `scripting://run` URL，可用于启动并执行脚本。

```ts
const url = Script.createRunURLScheme("MyScript", { user: "Alice" })
// "scripting://run/MyScript?user=Alice"
```

---

### `Script.createRunSingleURLScheme(scriptName, queryParameters?): string`

生成一个 `scripting://run_single` URL，确保脚本不会并行运行多个实例。

```ts
const url = Script.createRunSingleURLScheme("MyScript", { id: "1" })
// "scripting://run_single/MyScript?id=1"
```

---

### `Script.createOpenURLScheme(scriptName): string`

生成一个 `scripting://open` URL，用于在编辑器中打开脚本。

```ts
const url = Script.createOpenURLScheme("MyScript")
// "scripting://open/MyScript"
```

---

### `Script.createDocumentationURLScheme(title?): string`

生成用于打开 Scripting App 内文档页面的 URL。

* `title`: （可选）若传入标题，将直接打开该文档主题页面。

```ts
const url = Script.createDocumentationURLScheme("Widgets")
// "scripting://doc?title=Widgets"
```

---

### `createImportScriptsURLScheme(urls): string`

根据提供的 URL 数组生成导入脚本的 URL Scheme。

* `urls: string[]`: 要导入的脚本资源 URL 列表（支持 zip 或单文件）

```ts
const urlScheme = Script.createImportScriptsURLScheme([
  "https://github.com/schl3ck/scripting-app-lib",
  "https://example.com/my-script.zip",
])
// "scripting://import_scripts?urls=..."
```

---

### `hasFullAccess(): boolean`

判断用户是否具有完整功能访问权限。

返回:`true` 如果用户具有完整功能访问权限，否则返回 `false`。

```ts
if (Script.hasFullAccess()) {
  // 有完整功能访问权限
  Assistant.requestStructedData(...)
}
```

---

## 注意事项（Notes）

* 脚本正常完成时调用 `Script.exit()`。普通 App 脚本因未捕获异常而退出时，Scripting 也会释放该实例的资源。
* 使用 `Script.run()` 可以实现脚本的模块化和调用链，获取结构化返回值
* URL Scheme 可用于从外部应用（如快捷指令）触发脚本执行
* 对于需要避免并发执行的脚本，建议使用 `singleMode` 或 `run_single` URL Scheme

## 远程脚本来源与更新

在 App 的脚本设置中配置远程来源。`Script.metadata.remoteResource` 是该配置的只读视图；`Script` 为全局对象，无需 import。`hash` 由 App 维护，不要把不完整的 `remoteResource` 复制到 `script.json`，也不要自行编造 hash。

支持的来源示例：

| 来源 | URL 示例 |
| --- | --- |
| 可直接下载的 ZIP | `https://example.com/MyScript.zip` |
| GitHub 仓库默认分支 | `https://github.com/owner/repository` |
| GitHub 分支、标签或 revision | `https://github.com/owner/repository/tree/main` |
| 该 revision 内的脚本子目录 | `https://github.com/owner/repository/tree/main/scripts/MyScript` |

ZIP 应填写实际下载地址，不是展示发布内容或文件的网页。GitHub 链接由 App 解析，不是通用 Git/SSH 客户端。此 URL 格式将 `tree` 后第一个路径段当作 revision，建议使用不含 `/` 的简单分支名。

选中的脚本目录必须包含 `script.json` 及配置的入口文件。推荐 ZIP 内容：

```text
script.json
index.tsx
core/
  session.ts
```

也支持一层外包目录，但它必须是解压后的唯一条目（忽略 `__MACOSX`、`.DS_Store`）。App 只展开**这一层**；GitHub 子目录来源随后再从仓库根目录中选择对应子目录。避免多层套目录或多个无关顶层文件夹。

`autoUpdateInterval` 单位为**秒**，实际最小间隔为 **1800 秒（30 分钟）**。例如 `3600` 表示每小时检查，`60` 会被提高为 1800，不会每分钟检查。未设置或为 `null` 时，关闭该脚本的定时检查。这是调度间隔，不保证 App 挂起期间仍准时执行。

App 的全局“自动更新”开关控制发现更新后是否自动替换文件；关闭时，符合条件的定时检查仍可发现并标记待更新，但不替换脚本。手动检查不依赖脚本的定时间隔。建议保持远程 URL 稳定，并递增脚本版本，便于用户识别更新。


## 相机拍摄参数

`Script.cameraControlParameter` 提供首次运行携带的原生拍摄批次，无资源时为 null；后续批次通过 `Script.onResume` 的同名字段交付。完整类型、文件保留规则和可运行 index.tsx 见[相机控制](../../camera_control/)。
