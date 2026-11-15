`WebViewController` 是一个用于显示和交互网页内容的控制器。它允许你在脚本中加载 HTML、展示 Web 页面、执行 JavaScript 脚本，并与页面中的 JavaScript 进行消息通信。你可以将它作为浏览器使用，也可以嵌入应用功能页面。

---

## 类：`WebViewController`

```ts
const webView = new WebViewController()
```

### 构造函数

```ts
new WebViewController(options?: WebViewControllerOptions)
```

* **选项**（均为可选）：

  * `ephemeral`：为 `true` 时，WebView 使用非持久化数据存储，cookie 与网站数据与默认容器隔离，在实例释放后一并丢弃。适合沙盒化的登陆流程或需要干净环境的抓取任务。

#### 示例

```ts
// 普通（持久化）WebView —— 与其他 WebViewController 共享 cookie。
const webView = new WebViewController()

// 独立 WebView —— cookie 被隔离，销毁时一并清除。
const isolated = new WebViewController({ ephemeral: true })
```

---

### 浏览器创建配置

```ts
new WebViewController(options?: WebViewControllerOptions)
```

创建配置在控制器生命周期内固定。请在首次加载、Cookie 操作、读取运行设置或展示前通过构造参数指定。省略的选项沿用 WebKit 默认值。只读 `configuration` 属性返回显式配置的副本及 `ephemeral`，不会展开省略的系统默认值；修改副本不会改变浏览器。

| 选项 | 类型或取值 | 行为 |
| --- | --- | --- |
| `allowsInlineMediaPlayback` | `boolean` | 允许视频在网页内播放。系统默认 iPhone 为 false、iPad 为 true；iPhone 的 HTML video 还需 `playsinline` 属性。 |
| `mediaTypesRequiringUserActionForPlayback` | `"none"`、`"audio"`、`"video"`、`"all"` | 指定需要用户手势才能开始播放的媒体类型，与行内播放独立；设为 none 不保证所有网站都能自动播放。 |
| `allowsAirPlayForMediaPlayback` | `boolean` | 环境支持时允许媒体通过 AirPlay 播放。 |
| `allowsPictureInPictureMediaPlayback` | `boolean` | 媒体和系统支持时允许画中画。 |
| `allowsContentJavaScript` | `boolean` | 允许网页自带脚本执行；宿主 `evaluateJavaScript` 调用仍可使用。 |
| `preferredContentMode` | `"recommended"`、`"mobile"`、`"desktop"` | 选择网站优先采用的布局；桌面模式不等于具备桌面 Safari 的全部能力。 |
| `javaScriptCanOpenWindowsAutomatically` | `boolean` | 允许脚本自动请求新窗口；仅设置此项不会自动创建或展示子浏览器。 |
| `applicationNameForUserAgent` | `string` 或 `null` | 向默认 User-Agent 追加应用名称；自定义 User-Agent 会覆盖该字符串。 |
| `suppressesIncrementalRendering` | `boolean` | 延迟到页面内容加载后再渲染。 |
| `ignoresViewportScaleLimits` | `boolean` | 允许超出网页指定的缩放限制。 |
| `dataDetectorTypes` | 识别类型名称数组 | 支持 `phoneNumber`、`link`、`address`、`calendarEvent`、`trackingNumber`、`flightNumber`、`lookupSuggestion`；`["none"]` 或 `["all"]` 需单独使用。 |
| `selectionGranularity` | `"dynamic"` 或 `"character"` | 设置文本选择粒度。 |
| `settings` | `Partial<WebViewSettings>` | 指定下列运行设置的初始值。 |

未知的新配置项、非法枚举值及非布尔标记会抛出 `code: "invalidArgument"` 的错误。已有 `ephemeral` 行为保持兼容。

### 运行设置

`getSettings(): Promise<WebViewSettings>` 读取实际浏览器设置，必要时创建底层浏览器。`setSettings(patch: Partial<WebViewSettings>): Promise<void>` 只更新提供的字段，不重建页面；等待完成后再依赖修改结果。整个 patch 会先完成校验，校验失败不会应用任何字段。

| 设置 | 类型及行为 |
| --- | --- |
| `inactiveSchedulingPolicy` | iOS 17 起支持 `"suspend"`、`"throttle"`、`"none"`（省略时保留当前系统默认值），控制页面离开窗口后的任务调度。移除浏览器 UI 后仍需继续无界面工作时设置 none；App 的系统后台限制仍然适用。 |
| `customUserAgent` | `string` 或 `null`；null 恢复默认 User-Agent。 |
| `allowsBackForwardNavigationGestures` | `boolean`；启用系统历史导航手势。 |
| `allowsLinkPreview` | `boolean`；启用系统链接预览。 |
| `isScrollEnabled`、`bounces` | `boolean`；控制滚动与边缘回弹。 |
| `showsHorizontalScrollIndicator`、`showsVerticalScrollIndicator` | `boolean`；控制滚动条。 |
| `pageZoom` | 有限正数；1 表示正常大小。 |
| `isOpaque` | `boolean`；透明网页和背景应设置为 false。 |
| `backgroundColor`、`underPageBackgroundColor` | SDK 颜色字符串，如 `"#112233"`、`"rgba(0,0,0,0)"`；null 恢复系统背景；读取结果为 `rgba(r,g,b,a)` 或 null。 |
| `isInspectable` | `boolean`；控制 Safari Web Inspector 访问。 |
| `isFindInteractionEnabled` | `boolean`；启用系统查找交互。 |

默认沿用实际 WebKit/滚动视图的值，开发构建保留 Scripting 原有的可检查默认行为。非法 patch 以 `code: "invalidArgument"` 拒绝；销毁后的新操作以 `code: "disposed"` 拒绝。Promise<void> 方法没有有意义的结果值。

### 状态与生命周期

只读 `url`、`title`、`isLoading`、`estimatedProgress`、`canNavigateBack`、`canNavigateForward`、`hasOnlySecureContent`、`isDisposed`、`isAttached` 提供快照，读取不会创建浏览器。URL 和标题初始为 null，进度初始为零，标记初始为 false。`getState(): Promise<WebViewState>` 获取一致的异步状态快照，还包含 `isPresented`。标题等元数据跟随 WebKit 更新，可能晚于导航完成；需要即时 DOM 标题时可用 `evaluateJavaScript("return document.title")`。`getCapabilities(): Promise<WebViewCapabilities>` 列出支持的创建配置和运行设置名称，不表示已获权限或具备 AirPlay/画中画硬件环境。

`waitForLoad()` 等待首次或当前导航，也可立即返回已知终态。失败、被新导航替代、网页进程退出、控制器销毁均使对应加载等待返回 false。文档被替换、进程退出或控制器销毁会拒绝尚未完成的 JS 执行；语法错误和网页 Promise 拒绝也会拒绝 `evaluateJavaScript()`。

同一控制器同时只能由一个 `<WebView>` 嵌入或以模态展示。嵌入时会按需创建浏览器，移除后可再次挂载。移除 UI 后还需要离屏执行 JavaScript 时，先将 inactiveSchedulingPolicy 设为 none；suspend 策略可能暂停页面执行。已有同步 UA/历史方法保持返回类型；后台调用会将命令排入主队列，并返回是否接受命令。需要等待 UA 实际修改完成时使用 `setSettings`。这些 UI API 用于活动 App 脚本；配置不会为小组件等受限执行环境额外授予前台浏览器能力。

```ts
const browser = new WebViewController({
  ephemeral: true,
  allowsInlineMediaPlayback: true,
  mediaTypesRequiringUserActionForPlayback: "none",
  settings: { allowsBackForwardNavigationGestures: true, pageZoom: 1.1 },
})
try {
  await browser.loadHTML('<video playsinline controls src="https://example.com/video.mp4"></video>')
  await browser.setSettings({ allowsLinkPreview: false })
  console.log(await browser.getState())
  await browser.present()
} finally {
  browser.dispose()
}
```

---

## 属性

### `shouldAllowRequest?: (request) => Promise<boolean>`

一个可选回调，用于决定是否允许导航，例如打开新页面或提交表单。此回调不会拦截全部子资源请求。

适用于拦截跳转行为、自定义安全策略或过滤广告等不需要的请求。

#### 参数

回调函数接收一个 `request` 对象，包含以下字段：

* `url: string`
  请求的完整 URL。

* `method: string`
  HTTP 方法，如 `GET`、`POST`。

* `body?: Data | null`
  可选，请求体数据（通常用于 `POST` 请求）。

* `headers: Record<string, string>`
  请求头信息。

* `timeoutInterval: number`
  请求的超时时间（单位为秒）。

* `navigationType: "linkActivated" | "reload" | "backForward" | "formResubmitted" | "formSubmitted" | "other"`
  触发导航的上下文。

#### 返回值

一个 `Promise<boolean>`，用于指示是否允许该请求：

* `true`：允许请求继续
* `false`：阻止该请求

#### 示例

```ts
const webView = new WebViewController()

webView.shouldAllowRequest = async (request) => {
  console.log('拦截到请求：', request.url)

  // 拦截所有访问 example.com 的请求
  if (request.url.includes('example.com')) {
    return false
  }

  return true
}

await webView.loadURL('https://www.wikipedia.org')
await webView.present({ navigationTitle: '已过滤的网页视图' })
```

---

## 方法

### `loadURL(url: string): Promise<boolean>`

加载指定 URL 的网页内容。

* **参数**：

  * `url`：要加载的网页完整地址。
* **返回**：`Promise<boolean>` — 加载成功返回 `true`。

---

### `loadFile(path: string, allowingReadAccessTo?: string): Promise<boolean>`

加载文件内容作为网页。

* **参数**:

  * `path`：要加载的文件路径。
  * `allowingReadAccessTo`（可选）：允许读取文件的路径，默认为 `path`。
* **返回**：`Promise<boolean>`

### `loadHTML(html: string, baseURL?: string): Promise<boolean>`

加载原始 HTML 字符串内容。

* **参数**：

  * `html`：要渲染的 HTML 字符串。
  * `baseURL`（可选）：用于解析相对路径的基础 URL。
* **返回**：`Promise<boolean>` — 加载成功返回 `true`。

---

### `loadData(data: Data, mimeType: string, encoding: string, baseURL: string): Promise<boolean>`

加载原始数据作为网页内容。

* **参数**：

  * `data`：要加载的二进制内容。
  * `mimeType`：内容的 MIME 类型，例如 `"text/html"`。
  * `encoding`：字符编码，例如 `"utf-8"`。
  * `baseURL`：用于解析相对路径的基础地址。
* **返回**：`Promise<boolean>`

---

### `waitForLoad(options?: WebViewWaitOptions): Promise<boolean>`

等待 WebView 加载完成。

* **返回**：`Promise<boolean>`

---

### `getHTML(): Promise<string | null>`

获取当前页面的 HTML 内容。

* **返回**：`Promise<string | null>`

---

### `evaluateJavaScript<T = any>(javascript: string): Promise<T>`

在 WebView 中执行指定的 JavaScript 代码。

* **参数**：

  * `javascript`：要执行的 JavaScript 代码字符串。若希望返回值，必须在代码中使用 `return`。
* **返回**：`Promise<T>` — JavaScript 执行结果将作为 Promise 的值返回。

#### 示例

```ts
const webView = new WebViewController()
await webView.loadURL("https://example.com")
const title = await webView.evaluateJavaScript("return document.title")
console.log(title) // "Example Domain"
webView.dispose()
```

或：

```ts
const webView = new WebViewController()
await webView.loadHTML(`
  <html>
    <body>
      <script>
        window.myValue = 42
      </script>
    </body>
  </html>
`)

await webView.waitForLoad()

const result = await webView.evaluateJavaScript('return window.myValue')
console.log(result) // 42
```

---

### `addScriptMessageHandler<P = any, R = any>(name: string, handler: (params: P, info?: WebViewMessageInfo) => R | Promise<R>, options?: WebViewMessageOptions): Promise<void>`

添加一个脚本消息处理器，可在网页中通过 JavaScript 调用，并接收原生代码返回的结果。

* **参数**：

  * `name`：消息处理器名称，必须唯一且非空。
  * `handler`：处理函数，接收来自网页的参数并返回一个值，作为 Promise 的结果回传给网页。
* **返回**：`Promise<void>` — 添加成功后完成。

#### 示例

```ts
let webView = new WebViewController()

await webView.addScriptMessageHandler("sayHi", (greeting: string) => {
  console.log("收到消息", greeting)
  return "你好！"
})

await webView.loadHTML(`
  <html>
    <body>
      <script>
        (async () => {
          const response = await window.webkit.messageHandlers.sayHi.postMessage("Hi!")
          alert(response) // 弹出 "你好！"
        })()
      </script>
    </body>
  </html>
`)
```

---

### `present(options?: { fullscreen?: boolean, navigationTitle?: string }): Promise<void>`

以模态窗口形式展示 WebView。

* **选项**：

  * `fullscreen`：是否以全屏模式展示。
  * `navigationTitle`：导航栏标题（可选）。
* **返回**：`Promise<void>`

---

### `canGoBack(): boolean`

判断 WebView 是否可以后退。

---

### `canGoForward(): boolean`

判断 WebView 是否可以前进。

---

### `goBack(): boolean`

返回上一页。

---

### `goForward(): boolean`

前进到下一页。

---

### `reload(): void`

重新加载当前网页。

---

### `takeSnapshot(options?): Promise<UIImage | null>`

对 WebView 当前可见区域进行截图，返回一个 `UIImage`。

* **选项**（均为可选）：

  * `rect`：要截取的矩形区域（基于 WebView 坐标系，单位为点）。默认为整个可见视口。
  * `snapshotWidth`：结果图像的宽度（单位为点），高度按比例缩放。默认为 WebView 的宽度。
  * `afterScreenUpdates`：是否在应用完待处理的屏幕更新后再截图。默认为 `true`。

* **返回**：`Promise<UIImage | null>` — 成功时返回 `UIImage`；若 WebView 未上屏（即未调用 `present()` 且未被 `<WebView>` 视图使用）或截图失败，返回 `null`。

#### 示例

```ts
const webView = new WebViewController()
await webView.loadURL('https://example.com')
await webView.present({ navigationTitle: '截图示例' })

const image = await webView.takeSnapshot()
if (image) {
  const data = image.pngData()
  // 保存或分享截图......
}

webView.dispose()
```

---

### `getAllCookies(): Promise<Cookie[]>`

返回 WebView cookie 容器中当前保存的全部 cookie，包含 `document.cookie` 无法访问的 `HttpOnly` cookie。

* **返回**：`Promise<Cookie[]>`

`Cookie` 的结构：

```ts
interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  isSecure: boolean
  isHTTPOnly: boolean
  isSessionOnly: boolean
  expiresDate?: Date | null
}
```

---

### `getCookies(url: string): Promise<Cookie[]>`

返回将随给定 URL 一同发送的 cookie。匹配规则遵循 WebKit 的标准：URL 的 host 必须匹配 `cookie.domain`（当 `cookie.domain` 以 `.` 开头时支持子域匹配），且 URL 的路径必须被 `cookie.path` 覆盖。

* **参数**：

  * `url`：用于按域名和路径过滤 cookie 的 URL。
* **返回**：`Promise<Cookie[]>`

---

### `setCookie(cookie: Cookie): Promise<boolean>`

向 WebView cookie 容器写入（或覆盖）一条 cookie。

可以在调用 `loadURL` **之前**先调用 `setCookie` 预置登陆态 —— 只要实例创建完成，cookie 容器即可使用，不需要先把 WebView 展示到屏幕上。

* **参数**：

  * `cookie`：要写入的 cookie。`name`、`value`、`domain` 必填；`path` 默认为 `"/"`；当 `isSessionOnly` 为 `true` 或未提供 `expiresDate` 时，视为会话 cookie。
* **返回**：`Promise<boolean>` — 写入成功返回 `true`，输入非法返回 `false`。

#### 示例

```ts
const webView = new WebViewController()

// 在打开受限页面之前先写入 session cookie。
await webView.setCookie({
  name: "session",
  value: "abc123",
  domain: "example.com",
  path: "/",
  isSecure: true,
  isHTTPOnly: true,
  isSessionOnly: false,
  expiresDate: new Date(Date.now() + 86400_000),
})

await webView.loadURL("https://example.com/dashboard")
```

---

### `deleteCookie(cookie: { name: string, domain?: string, path?: string }): Promise<boolean>`

删除匹配给定描述符的 cookie。

可以把 `getAllCookies` / `getCookies` 返回的完整 `Cookie` 对象传回来精确删除，也可以只传部分字段（比如仅 `name`），此时每一条匹配的 cookie 都会被删除。

* **参数**：

  * `cookie.name`：要匹配的 cookie 名（必填）。
  * `cookie.domain`（可选）：提供时仅删除该域名下的 cookie。
  * `cookie.path`（可选）：提供时仅删除该路径下的 cookie。
* **返回**：`Promise<boolean>` — 至少删除一条返回 `true`，否则返回 `false`。

#### 示例

```ts
const webView = new WebViewController()
await webView.loadURL("https://example.com")

// 删除所有名为 "tracker" 的 cookie。
await webView.deleteCookie({ name: "tracker" })

// 或者把 getCookies 返回的具体 cookie 传回删除。
const [c] = await webView.getCookies("https://example.com/")
if (c) {
  await webView.deleteCookie(c)
}
```

---

### `clearAllCookies(): Promise<void>`

清空 WebView cookie 容器中的全部 cookie。其他网站数据（缓存、localStorage 等）不受影响。

* **返回**：`Promise<void>`

---

### `dismiss(): void`

关闭 WebView 页面（若当前正在展示）。

---

### `dispose(): void`

释放 WebView 实例并清理资源。

* 如果 WebView 正在展示，将先自动关闭。
* **重要**：请务必调用此方法以避免内存泄漏。

---

## 完整示例

```ts
const webView = new WebViewController()

await webView.addScriptMessageHandler('greet', (name) => {
  return `你好，${name}`
})

await webView.loadHTML(`
  <html>
    <body>
      <h1>自定义网页视图</h1>
      <button onclick="sendMessage()">打招呼</button>
      <script>
        async function sendMessage() {
          const response = await window.webkit.messageHandlers.greet.postMessage("Alice")
          alert(response)
        }
      </script>
    </body>
  </html>
`)

await webView.present({ navigationTitle: '网页视图示例' })
webView.dispose()
```

## 请求、导航与事件

```ts
loadRequest(request: WebViewRequest): Promise<boolean>
stopLoading(): Promise<void>
reloadFromOrigin(): Promise<boolean>
waitForLoad(options?: WebViewWaitOptions): Promise<boolean>
getBackForwardList(): Promise<WebViewHistory>
goToHistoryItem(id: string): Promise<boolean>
addEventListener(type: WebViewEventType, listener: (event: WebViewEvent) => void): Promise<void>
removeEventListener(type: WebViewEventType, listener: (event: WebViewEvent) => void): Promise<void>
```

`loadRequest` 接受绝对 HTTP、HTTPS、file、about 或 data URL，以及可选的 HTTP `method`（默认 GET）、字符串字典 `headers`、`Data` 类型的 `body`、正数秒 `timeoutInterval`（默认 60）和命名 `cachePolicy`。缓存策略支持 `useProtocolCachePolicy`（默认）、`reloadIgnoringLocalCacheData`、`returnCacheDataElseLoad`、`returnCacheDataDontLoad`、`reloadRevalidatingCacheData` 和 `reloadIgnoringLocalAndRemoteCacheData`。请求头和请求体属于本次导航请求，不会覆盖所有重定向或子资源。非法参数以 `code: "invalidArgument"` 拒绝；主文档加载成功返回 `true`，失败、取消或被新导航替代返回 `false`。

`stopLoading` 停止当前导航，将相关等待结果结算为 `false`。`reloadFromOrigin` 向源站重新验证当前页面，不保证绕过所有缓存。`waitForLoad()` 保留等待首次或当前加载的原有行为，已知终态会立即返回。可选参数：

| 参数 | 行为 |
| --- | --- |
| `timeout?: number` | 正数秒；省略时不设等待超时。超时以 `code: "timeout"` 拒绝。 |
| `nextNavigation?: boolean` | 默认 false；true 表示等待下一次导航，即使当前导航已经结束。 |
| `cancelOnTimeout?: boolean` | 默认 false；true 表示此等待超时时同时停止当前导航。 |

历史列表包含 `backList`、可为 null 的 `currentItem` 和 `forwardList`。每项提供 `id`、`url`、`initialURL` 和可为 null 的 `title`。id 仅属于本控制器，且必须仍存在于其历史中；其他实例或已过期的 id 以 `invalidArgument` 拒绝。

### 导航决策

```ts
webView.onNavigationAction = async action => "allow"
webView.onNavigationResponse = response => response.canShowMIMEType ? "allow" : "cancel"
```

`onNavigationAction` 优先于 `shouldAllowRequest`；未设置新回调时保留旧回调行为。新回调可同步或通过 Promise 返回 `"allow"`、`"cancel"` 或 `"download"`。异常、非法返回值、Promise 拒绝或 60 秒未返回均取消导航。未设置 response 回调时，允许 WebKit 可显示的 MIME 类型，取消其他响应。

当前 API 版本尚未提供下载管理。返回 `"download"` 会取消导航，并发出 `error.code: "unsupported"` 的 `loadError`，不会保存文件。`getCapabilities()` 返回 `navigationPolicies: ["allow", "cancel"]` 和 `downloadPolicy: false`。

action 信息包含可为 null 的 `navigationId`/`url`、`method`、`headers`、可为 null 的 `Data` `body`、`timeoutInterval`、`navigationType`、`sourceFrame`、可为 null 的 `targetFrame`、可为 null 的 `isMainFrame` 及 `shouldPerformDownload`。targetFrame 为空表示新窗口请求。除非系统能关联原生导航，否则 action 的 `navigationId` 为 null；生命周期及 response 事件提供已接受导航的 id。公开 iOS API 未提供可靠的用户手势标志，因此 `isUserInitiated` 为 `null`。response 信息包含 `navigationId`、`url`、`mimeType`、`expectedContentLength`、可为 null 的 `statusCode`、`headers`、`isForMainFrame` 和 `canShowMIMEType`。这些回调用于导航及 frame 决策，不会拦截所有图片、脚本等请求。

### 事件

支持 `loadStart`、`redirect`、`commit`、`loadFinish`、`loadError`、`stateChange`、`webContentProcessTerminated`、`present`、`dismiss`。事件包含 `type`、可为 null 的 `navigationId`、`isMainFrame` 和 `state: WebViewState` 快照。`loadError` 另含 `error: {code, message}`。生命周期事件的 `isMainFrame` 为 true；子 frame 下载决策不受支持时为 false。主文档生命周期事件共享导航 id；子 frame 决策通过导航回调观察。`stateChange` 会合并同一主队列轮次内的变化，不承诺逐次发送每一个进度值。

同一函数重复注册不会重复接收；移除时传入相同函数引用。监听函数异常不影响其他监听者；销毁时清理监听。事件不会自动向 VoiceOver 宣读进度；脚本界面应提供有意义的加载状态并保持可预测的焦点。

```ts
const webView = new WebViewController()
const onFinish = (event: WebViewEvent) => console.log(event.state.url)
await webView.addEventListener("loadFinish", onFinish)
await webView.loadRequest({
  url: "https://example.com/form", method: "POST",
  headers: {"Content-Type": "application/x-www-form-urlencoded"},
  body: Data.fromString("name=Scripting")!,
})
await webView.removeEventListener("loadFinish", onFinish)
```

## 用户脚本、内容世界与异步 JavaScript

```ts
addUserScript(options: WebViewUserScriptOptions): Promise<string>
removeUserScript(id: string): Promise<void>
removeAllUserScripts(): Promise<void>
callAsyncJavaScript<T = any>(body: string, args?: Record<string, WebViewJSONValue>, options?: WebViewJavaScriptOptions): Promise<T>
```

用户脚本接受 `source`、`injectionTime: "documentStart" | "documentEnd"`（默认 `documentStart`）、`forMainFrameOnly`（默认 true）和可选的 `contentWorld`。添加或移除只影响后续文档，不能撤销已经执行的副作用；移除用户脚本会保留控制器内部桥接脚本。

`contentWorld` 可为 `"page"`（默认）或 `{name: "my-world"}` 命名隔离世界。不同世界共享 DOM，但 JavaScript 全局变量相互隔离。`getCapabilities()` 提供 `contentWorlds` 和 `frameTargeting`。

`callAsyncJavaScript` 执行异步**函数体**，支持 `await` 并等待其返回的 Promise。`args` 的键作为命名参数，获取结果需使用 `return`。参数仅支持无循环的 JSON 值：null、布尔值、有限数字、字符串、数组和普通对象。函数、undefined、循环引用和原生对象以 `invalidArgument` 拒绝。语法错误、抛出异常、Promise 拒绝或 WebKit 无法继续执行的 frame 以 `javaScriptError` 拒绝。导航、内容进程终止及销毁会结算未完成执行。原有 `evaluateJavaScript` 保持函数体和 `return` 语义。

options 支持 `contentWorld` 和 `frameId`，不传 frameId 时在主 frame 执行。frame token 可从 action 的 `sourceFrame`/`targetFrame` 或消息的 `info.frame` 获取。frame 信息包含 `id`、`isMainFrame`、可为 null 的 `url` 以及 `securityOrigin: {protocol, host, port}`。token 仅属于当前控制器，在**任何新导航**（包括子 frame 导航）、进程终止或销毁时保守失效。过期或其他实例的 token 以 `invalidArgument` 拒绝，它不是持久 frame 标识；文档 commit 也会使此前签发的 token 失效；仅保留最近 256 个 token，导航后或大量消息活动后需重新获取。

```ts
const id = await webView.addUserScript({
  source: "window.scriptReady = true", injectionTime: "documentStart",
})
await webView.loadHTML("<script>document.title = String(window.scriptReady)</script>")
const value = await webView.callAsyncJavaScript<number>(
  "await Promise.resolve(); return amount * 2", {amount: 21},
  {contentWorld: {name: "calculation"}},
)
await webView.removeUserScript(id)
```

## 异步消息与移除

```ts
addScriptMessageHandler<P = any, R = any>(
  name: string,
  handler: (body: P, info?: WebViewMessageInfo) => R | Promise<R>,
  options?: {contentWorld?: WebViewContentWorld; includeFrameInfo?: boolean},
): Promise<void>
removeScriptMessageHandler(name: string, options?: {contentWorld?: WebViewContentWorld}): Promise<void>
```

原有消息体参数不变。设置 `includeFrameInfo: true` 后，第二参数提供 `frame` 和 `contentWorld`。相同 world 中的同名注册会替换原处理器，不同 world 的同名处理器相互独立。空名称和内部名称 `callMethodsWithReply`、`callMethodsWithoutReply`、`__exec_js_callback_swift__` 会被拒绝。

网页可等待 `window.webkit.messageHandlers[name].postMessage(body)`。处理器可返回 WebKit 可序列化值或 Promise：undefined、null、布尔值、数字（包括非有限值）、字符串、Date，以及包含这些值的数组和普通对象。没有返回值时保留原有 undefined 回复；显式 null 仍为 null。异常和 Promise 拒绝会以包含 `javaScriptError` 的消息拒绝网页 Promise，不支持或循环的回复值以 `serializationError` 拒绝。60 秒未回复以 `timeout` 拒绝；替换或移除会取消该处理器未完成的回复。导航、进程终止和销毁也会取消未决回复，迟到结果不会恢复已删除的处理器。

```ts
await webView.addScriptMessageHandler("double", async (body: number) => body * 2)
const reply = await webView.callAsyncJavaScript<number>(
  "return await window.webkit.messageHandlers.double.postMessage(21)",
)
await webView.removeScriptMessageHandler("double")
```

## WebKit 内容规则

```ts
addContentRuleList(options: {id: string; rules: string | Array<Record<string, any>>}): Promise<void>
removeContentRuleList(id: string): Promise<void>
removeAllContentRuleLists(): Promise<void>
```

`rules` 接受 WebKit 内容阻止规则的 JSON 文本或规则数组。编译错误以 `invalidArgument` 拒绝，编译成功后安装到本控制器。同一 id 仅在新规则编译成功后替换旧规则。移除只操作本实例的用户规则，不影响其他实例或内部脚本。移除尚在编译的规则会以 `code: "cancelled"` 取消，并阻止迟到安装。应在加载目标内容前安装规则；移除不会自动补载当前文档已被阻止的资源。

这是 WebKit 内容阻止能力，不是任意 HTTP 请求拦截。规则格式遵循 [Apple 内容阻止规则文档](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker)。

```ts
await webView.addContentRuleList({
  id: "images",
  rules: [{trigger: {"url-filter": ".*", "resource-type": ["image"]}, action: {type: "block"}}],
})
await webView.loadURL("https://example.com")
await webView.removeAllContentRuleLists()
```
