The `WebViewController` class allows you to display and interact with embedded web content inside your script. It is designed for use cases like custom in-app browsers, rendering dynamic HTML, or communicating with JavaScript running in a web context.

---

## Class: `WebViewController`

```ts
const webView = new WebViewController()
```

### Constructor

```ts
new WebViewController(options?: WebViewControllerOptions)
```

* **Options** (all optional):

  * `ephemeral`: When `true`, the WebView uses a non-persistent data store so cookies and website data are isolated from the default container and discarded when the controller is released. Useful for sandboxed login flows or clean-slate scraping.

#### Example

```ts
// Regular (persistent) WebView — shares cookies with other WebViewControllers.
const webView = new WebViewController()

// Ephemeral WebView — cookies are isolated and wiped when disposed.
const isolated = new WebViewController({ ephemeral: true })
```

---

### Browser configuration

```ts
new WebViewController(options?: WebViewControllerOptions)
```

Creation options are fixed for the controller's lifetime. Set them before the first load, cookie operation, settings read, or presentation. Omitted options retain WebKit defaults. The read-only `configuration` property returns a copy of the explicitly supplied options, plus `ephemeral`; omitted defaults are not expanded. Changing that copy does not reconfigure the browser.

| Option | Type / values | Behavior |
| --- | --- | --- |
| `allowsInlineMediaPlayback` | `boolean` | Allows video inside the page. The system default is false on iPhone and true on iPad. On iPhone the HTML video also needs `playsinline`. |
| `mediaTypesRequiringUserActionForPlayback` | `"none"`, `"audio"`, `"video"`, `"all"` | Selects media that needs a user gesture. This is separate from inline playback; `none` does not guarantee every site can autoplay. |
| `allowsAirPlayForMediaPlayback` | `boolean` | Allows media routing through AirPlay when available. |
| `allowsPictureInPictureMediaPlayback` | `boolean` | Allows Picture in Picture when supported by the media and system. |
| `allowsContentJavaScript` | `boolean` | Allows scripts supplied by the webpage. Host `evaluateJavaScript` calls remain available. |
| `preferredContentMode` | `"recommended"`, `"mobile"`, `"desktop"` | Selects the preferred website layout; desktop mode does not reproduce all desktop Safari features. |
| `javaScriptCanOpenWindowsAutomatically` | `boolean` | Allows automatic window requests. This option alone does not create or present a child browser. |
| `applicationNameForUserAgent` | `string` or `null` | Appends an application name to the default user agent; a custom user agent overrides that string. |
| `suppressesIncrementalRendering` | `boolean` | Delays rendering until the page content is loaded. |
| `ignoresViewportScaleLimits` | `boolean` | Allows scaling beyond limits requested by the webpage. |
| `dataDetectorTypes` | array of detector names | `phoneNumber`, `link`, `address`, `calendarEvent`, `trackingNumber`, `flightNumber`, `lookupSuggestion`; use `["none"]` or `["all"]` alone. |
| `selectionGranularity` | `"dynamic"` or `"character"` | Controls text selection granularity. |
| `settings` | `Partial<WebViewSettings>` | Initial values for the runtime settings below. |

Unknown new options, invalid enum values and non-boolean flags throw an error with `code: "invalidArgument"`. Existing `ephemeral` behavior is preserved.

### Runtime settings

`getSettings(): Promise<WebViewSettings>` reads the actual browser settings, creating the underlying browser when needed. `setSettings(patch: Partial<WebViewSettings>): Promise<void>` changes only supplied fields, without recreating the page. Await completion before relying on the change. The entire patch is validated before any field is changed.

| Setting | Type / behavior |
| --- | --- |
| `inactiveSchedulingPolicy` | iOS 17+: `"suspend"`, `"throttle"`, or `"none"` (omitted values retain the current platform default). Controls tasks while the page is outside a window. Use none for continued headless work after removing browser UI; App background restrictions still apply. |
| `customUserAgent` | `string` or `null`; null restores the default user agent. |
| `allowsBackForwardNavigationGestures` | `boolean`; enables native history gestures. |
| `allowsLinkPreview` | `boolean`; enables native link previews. |
| `isScrollEnabled`, `bounces` | `boolean`; control scrolling and edge bounce. |
| `showsHorizontalScrollIndicator`, `showsVerticalScrollIndicator` | `boolean`; control scroll indicators. |
| `pageZoom` | Finite positive number; `1` means normal size. |
| `isOpaque` | `boolean`; set false when using transparent content and backgrounds. |
| `backgroundColor`, `underPageBackgroundColor` | SDK color strings such as `"#112233"` or `"rgba(0,0,0,0)"`; null restores the system background. Readback uses `rgba(r,g,b,a)` or null. |
| `isInspectable` | `boolean`; controls Safari Web Inspector access. |
| `isFindInteractionEnabled` | `boolean`; enables the system find interaction. |

Defaults are the actual WebKit/scroll-view values, except that development builds retain Scripting's existing inspectable default. Invalid patches reject with `code: "invalidArgument"`; new operations after disposal reject with `code: "disposed"`. Promise<void> methods have no meaningful result value.

### State and lifecycle

Read-only `url`, `title`, `isLoading`, `estimatedProgress`, `canNavigateBack`, `canNavigateForward`, `hasOnlySecureContent`, `isDisposed`, and `isAttached` provide snapshots without creating a browser. URL and title start as null, progress starts at zero, and flags start false. Use `getState(): Promise<WebViewState>` for a consistent asynchronous snapshot, including `isPresented`. Metadata such as title follows WebKit updates and can arrive after navigation finishes; use `evaluateJavaScript("return document.title")` when you need the current DOM title. `getCapabilities(): Promise<WebViewCapabilities>` lists supported configuration and runtime-setting names; it does not report permission grants or available AirPlay/PiP hardware.

`waitForLoad()` waits for the first or current navigation, or returns its known terminal result. Failure, replacement by another navigation, web-content process termination, and disposal resolve affected load waiters with false. An unresolved JavaScript execution is rejected when its document is replaced, the process terminates, or the controller is disposed. Syntax errors and rejected webpage Promises also reject `evaluateJavaScript()`.

A controller can be embedded in one `<WebView>` or presented modally at a time. Embedding creates the browser when needed; detaching allows later reattachment. For offscreen JavaScript after UI removal, set inactiveSchedulingPolicy to none before continuing; the suspend policy may pause page execution. The existing synchronous UA/history methods keep their return types: background commands are scheduled on the main queue and return whether they were accepted. Use `setSettings` to await a UA change. These UI APIs belong in an active app script; options do not grant foreground browser UI to widgets or other restricted execution environments.

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

## Properties

### `shouldAllowRequest?: (request) => Promise<boolean>`

An optional callback that allows or blocks navigation, such as a new page or form submission. It does not intercept all subresource requests.

This is useful for intercepting navigation actions, implementing custom security logic, or filtering navigation destinations.

#### Parameters

The function receives a single `request` object with the following properties:

* `url: string`
  The full URL of the request.

* `method: string`
  The HTTP method (e.g., `GET`, `POST`).

* `body?: Data | null`
  Optional body data sent with the request (e.g., for `POST` requests).

* `headers: Record<string, string>`
  HTTP request headers.

* `timeoutInterval: number`
  The timeout interval in seconds for the request.

* `navigationType: "linkActivated" | "reload" | "backForward" | "formResubmitted" | "formSubmitted" | "other"`
  The context that triggered the navigation.

#### Returns

A `Promise<boolean>` resolving to:

* `true`: allow the request to proceed
* `false`: block the request

#### Example

```ts
const webView = new WebViewController()

webView.shouldAllowRequest = async (request) => {
  console.log('Intercepted request to:', request.url)

  // Block all requests to example.com
  if (request.url.includes('example.com')) {
    return false
  }

  return true
}

await webView.loadURL('https://www.wikipedia.org')
await webView.present({ navigationTitle: 'Filtered WebView' })
```

---

## Methods

### `loadFile(path: string, allowingReadAccessTo?: string): Promise<boolean>`

Loads a web page from a local file.

* **Parameters**:

  * `path`: The path to the local file.
  * `allowingReadAccessTo` (optional): A directory to allow read access to.
* **Returns**: `Promise<boolean>` — Resolves to `true` if the load succeeds.

### `loadURL(url: string): Promise<boolean>`

Loads a webpage by its URL.

* **Parameters**:

  * `url`: The full URL of the webpage to load.
* **Returns**: `Promise<boolean>` — Resolves to `true` if the load succeeds.

---

### `loadHTML(html: string, baseURL?: string): Promise<boolean>`

Loads a web page using raw HTML content.

* **Parameters**:

  * `html`: The HTML string to render.
  * `baseURL` (optional): A base URL to resolve relative paths.
* **Returns**: `Promise<boolean>` — Resolves to `true` on successful load.

---

### `loadData(data: Data, mimeType: string, encoding: string, baseURL: string): Promise<boolean>`

Loads web content from raw data.

* **Parameters**:

  * `data`: The binary content to load.
  * `mimeType`: MIME type of the content (e.g., `"text/html"`).
  * `encoding`: Character encoding (e.g., `"utf-8"`).
  * `baseURL`: Base URL for resolving relative URLs.
* **Returns**: `Promise<boolean>`

---

### `waitForLoad(options?: WebViewWaitOptions): Promise<boolean>`

Waits until the WebView has finished loading content.

* **Returns**: `Promise<boolean>`

---

### `getHTML(): Promise<string | null>`

Returns the current HTML content of the page.

* **Returns**: `Promise<string | null>`

---

### `evaluateJavaScript<T = any>(javascript: string): Promise<T>`

Evaluates the specified JavaScript string in the context of the WebView.

* **Parameters**:

  * `javascript`: A JavaScript code string to be evaluated.
    To retrieve a result from JavaScript, the code must explicitly use the `return` keyword.
* **Returns**: `Promise<T>` — Resolves with the result of the JavaScript evaluation. If the JavaScript code returns a value, it will be returned as the resolved value of the Promise.

#### Example

```ts
const webView = new WebViewController()
await webView.loadURL("https://example.com")
const title = await webView.evaluateJavaScript("return document.title") // Must use `return`
console.log(title) // "Example Domain"
webView.dispose()
```

Another example:

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

Installs a message handler callable from JavaScript in the web page, and enables sending a reply back from native code.

* **Parameters**:

  * `name`: The message handler name. Must be unique and non-empty.
  * `handler`: A callback function that receives parameters from JavaScript and returns a value. The return value will be sent back as the JavaScript promise resolution.

* **Returns**: `Promise<void>` — Resolves when the message handler is added successfully.

#### Example

```ts
let webView = new WebViewController()

await webView.addScriptMessageHandler("sayHi", (greeting: string) => {
  console.log("Receive a message", greeting)
  return "Hello!"
})

await webView.loadHTML(`
  <html>
    <body>
      <script>
        (async () => {
          const response = await window.webkit.messageHandlers.sayHi.postMessage("Hi!")
          alert(response) // Shows: "Hello!"
        })()
      </script>
    </body>
  </html>
`)
```

---

### `present(options?: { fullscreen?: boolean, navigationTitle?: string }): Promise<void>`

Presents the WebView in a modal sheet.

* **Options**:

  * `fullscreen`: If `true`, displays the WebView in fullscreen mode.
  * `navigationTitle`: Optional title for the navigation bar.
* **Returns**: `Promise<void>`

---

### `canGoBack(): boolean`

Checks whether the WebView can go back in history.

---

### `canGoForward(): boolean`

Checks whether the WebView can go forward in history.

---

### `goBack(): boolean`

Navigates to the previous page in the history stack.

---

### `goForward(): boolean`

Navigates to the next page in the history stack.

---

### `reload(): void`

Reloads the current webpage.

---

### `takeSnapshot(options?): Promise<UIImage | null>`

Captures a snapshot of the WebView's currently visible viewport and returns it as a `UIImage`.

* **Options** (all optional):

  * `rect`: The rectangle (in the WebView's coordinate space, in points) to capture. Defaults to the full visible viewport.
  * `snapshotWidth`: The width (in points) of the resulting image. The height is scaled proportionally. Defaults to the WebView's width.
  * `afterScreenUpdates`: Whether to take the snapshot after pending screen updates have been applied. Defaults to `true`.

* **Returns**: `Promise<UIImage | null>` — Resolves to a `UIImage`, or `null` if the WebView is not on screen (i.e. `present()` has not been called and it is not used by a `<WebView>` view), or if the snapshot fails.

#### Example

```ts
const webView = new WebViewController()
await webView.loadURL('https://example.com')
await webView.present({ navigationTitle: 'Snapshot Demo' })

const image = await webView.takeSnapshot()
if (image) {
  const data = image.pngData()
  // Save or share the image...
}

webView.dispose()
```

---

### `getAllCookies(): Promise<Cookie[]>`

Returns every cookie currently stored in the WebView's cookie jar, including `HttpOnly` cookies that are not exposed to `document.cookie`.

* **Returns**: `Promise<Cookie[]>`

Each `Cookie` has the shape:

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

Returns the cookies that would be sent with a request to the given URL. Matching follows the standard WebKit rules: the URL's host must match `cookie.domain` (with subdomain match when `cookie.domain` starts with `.`), and the URL's path must be covered by `cookie.path`.

* **Parameters**:

  * `url`: The URL used to filter cookies by domain and path.
* **Returns**: `Promise<Cookie[]>`

---

### `setCookie(cookie: Cookie): Promise<boolean>`

Sets (or overwrites) a cookie in the WebView's cookie store.

You can call `setCookie` **before** `loadURL` to pre-seed authentication state — the WebView's cookie store is ready as soon as the controller is created, even if the view has not been presented yet.

* **Parameters**:

  * `cookie`: The cookie to store. `name`, `value` and `domain` are required. `path` defaults to `"/"`. If `isSessionOnly` is `true` or `expiresDate` is omitted, the cookie is treated as a session cookie.
* **Returns**: `Promise<boolean>` — Resolves to `true` when the cookie is accepted, or `false` if the input is invalid.

#### Example

```ts
const webView = new WebViewController()

// Seed a session cookie before loading a gated page.
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

Deletes cookies that match the given descriptor.

You can either pass a full `Cookie` object returned by `getAllCookies` / `getCookies` to delete that exact cookie, or pass a partial descriptor to delete every cookie whose `name` (and optionally `domain` / `path`) matches.

* **Parameters**:

  * `cookie.name`: Cookie name to match (required).
  * `cookie.domain` (optional): When provided, only cookies with this exact domain are deleted.
  * `cookie.path` (optional): When provided, only cookies with this exact path are deleted.
* **Returns**: `Promise<boolean>` — Resolves to `true` when at least one cookie is removed, or `false` when nothing matched.

#### Example

```ts
const webView = new WebViewController()
await webView.loadURL("https://example.com")

// Delete every "tracker" cookie regardless of domain.
await webView.deleteCookie({ name: "tracker" })

// Or delete a specific cookie returned by getCookies.
const [c] = await webView.getCookies("https://example.com/")
if (c) {
  await webView.deleteCookie(c)
}
```

---

### `clearAllCookies(): Promise<void>`

Removes every cookie from the WebView's cookie store. Other website data (cache, local storage, etc.) is left untouched.

* **Returns**: `Promise<void>`

---

### `dismiss(): void`

Dismisses the WebView if currently presented.

---

### `dispose(): void`

Disposes the WebView instance and releases resources.

* If the WebView is still presented, it will first be dismissed.
* **Important**: You must call this to prevent memory leaks when done.

---

## Full Example

```ts
const webView = new WebViewController()

await webView.addScriptMessageHandler('greet', (name) => {
  return `Hello, ${name}`
})

await webView.loadHTML(`
  <html>
    <body>
      <h1>Custom WebView</h1>
      <button onclick="sendMessage()">Greet</button>
      <script>
        async function sendMessage() {
          const response = await window.webkit.messageHandlers.greet.postMessage("Alice")
          alert(response)
        }
      </script>
    </body>
  </html>
`)

await webView.present({ navigationTitle: 'WebView Demo' })
webView.dispose()
```


## Requests, navigation and events

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

`loadRequest` accepts an absolute HTTP, HTTPS, file, about or data URL, an optional HTTP `method` (default GET), string `headers`, a `Data` `body`, positive `timeoutInterval` in seconds (default 60), and a named `cachePolicy`. Supported policies are `useProtocolCachePolicy` (default), `reloadIgnoringLocalCacheData`, `returnCacheDataElseLoad`, `returnCacheDataDontLoad`, `reloadRevalidatingCacheData`, and `reloadIgnoringLocalAndRemoteCacheData`. Headers and body belong to this navigation request; they do not override every redirect or subresource. Invalid arguments reject with `code: "invalidArgument"`. A successful main-document load resolves `true`; failure, cancellation or replacement resolves `false`.

`stopLoading` stops the current navigation and settles its waiters as `false`. `reloadFromOrigin` revalidates the current page with its origin; it does not guarantee bypassing every cache. `waitForLoad()` retains its original first/current-load behavior and immediately returns a known terminal result. Options:

| Option | Behavior |
| --- | --- |
| `timeout?: number` | Positive seconds. Omitted means no waiter timeout. Expiration rejects with `code: "timeout"`. |
| `nextNavigation?: boolean` | Default false. True waits for the next navigation, even when the current one has finished. |
| `cancelOnTimeout?: boolean` | Default false. True also stops the current navigation when this waiter expires. |

History returns `backList`, nullable `currentItem`, and `forwardList`. Each item contains `id`, `url`, `initialURL`, and nullable `title`. The opaque id belongs to this controller and must still exist in its history; foreign or expired ids reject with `invalidArgument`.

### Navigation decisions

```ts
webView.onNavigationAction = async action => "allow"
webView.onNavigationResponse = response => response.canShowMIMEType ? "allow" : "cancel"
```

`onNavigationAction` takes precedence over `shouldAllowRequest`. With no new action callback, the legacy callback retains its behavior. The new callbacks accept synchronous or Promise results: `"allow"`, `"cancel"`, or `"download"`. An exception, invalid result, rejection, or 60-second timeout cancels. With no response callback, displayable MIME types are allowed and other responses are cancelled.

Download management is not available in this API version. Returning `"download"` cancels the navigation and emits `loadError` with `error.code: "unsupported"`; it does not save a file. `getCapabilities()` reports `navigationPolicies: ["allow", "cancel"]` and `downloadPolicy: false`.

Action information includes nullable `navigationId`/`url`, `method`, `headers`, nullable `Data` `body`, `timeoutInterval`, `navigationType`, `sourceFrame`, nullable `targetFrame`, nullable `isMainFrame`, and `shouldPerformDownload`. A missing target frame means a new-window request. Action `navigationId` is null unless the system can correlate the native navigation; lifecycle and response events provide the accepted navigation id. `isUserInitiated` is `null`, because the public iOS API does not provide a reliable user-gesture flag. Response information includes `navigationId`, `url`, `mimeType`, `expectedContentLength`, nullable `statusCode`, `headers`, `isForMainFrame`, and `canShowMIMEType`. These callbacks describe navigations, including frames; they do not intercept every image, script or other request.

### Events

Event names are `loadStart`, `redirect`, `commit`, `loadFinish`, `loadError`, `stateChange`, `webContentProcessTerminated`, `present`, and `dismiss`. Each event contains `type`, nullable `navigationId`, `isMainFrame`, and a `state: WebViewState` snapshot. `loadError` also contains `error: {code, message}`. Lifecycle events use `isMainFrame: true`; unsupported subframe download decisions use false. Main-document lifecycle events share a navigation id; frame decisions use the navigation callbacks. `stateChange` combines changes within a main-queue turn, so it is not a notification for every intermediate progress value.

Registering the same function twice does not duplicate delivery. Remove it using the same function reference. Listener exceptions do not stop other listeners. Listeners are cleared on disposal. Events do not automatically announce progress to VoiceOver; scripts should expose useful loading status and preserve predictable focus in their own UI.

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

## User scripts, content worlds and asynchronous JavaScript

```ts
addUserScript(options: WebViewUserScriptOptions): Promise<string>
removeUserScript(id: string): Promise<void>
removeAllUserScripts(): Promise<void>
callAsyncJavaScript<T = any>(body: string, args?: Record<string, WebViewJSONValue>, options?: WebViewJavaScriptOptions): Promise<T>
```

A user script takes `source`, `injectionTime: "documentStart" | "documentEnd"` (default `documentStart`), `forMainFrameOnly` (default true), and optional `contentWorld`. Add/remove affects future documents; removal cannot undo code already executed. Removing user scripts preserves the controller's internal bridge.

`contentWorld` is `"page"` (default) or `{name: "my-world"}` for an isolated JavaScript world. Worlds share the DOM, but their JavaScript global variables are separate. `getCapabilities()` reports `contentWorlds` and `frameTargeting`.

`callAsyncJavaScript` executes an async **function body**, supports `await`, and waits for its returned Promise. Named `args` become local arguments; use `return` for a result. Arguments must contain only acyclic JSON values: null, booleans, finite numbers, strings, arrays, and plain objects. Functions, undefined values, cycles and native objects reject with `invalidArgument`. Syntax errors, thrown exceptions, Promise rejections, or a frame that WebKit can no longer execute in reject with `javaScriptError`. Navigation, process termination and disposal settle pending evaluations. The original `evaluateJavaScript` keeps its function-body/`return` behavior.

Options include `contentWorld` and `frameId`. Without `frameId`, execution targets the main frame. Obtain a frame token from an action's `sourceFrame`/`targetFrame` or a message's `info.frame`. Frame information contains `id`, `isMainFrame`, nullable `url`, and `securityOrigin: {protocol, host, port}`. Tokens belong to this controller and expire conservatively on **any new navigation**, including a subframe navigation, as well as process termination or disposal. Expired/foreign tokens reject with `invalidArgument`; tokens are not persistent frame identifiers. A document commit also invalidates tokens issued before it. Only the most recent 256 tokens are retained; obtain fresh metadata after navigation or heavy message activity.

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

## Asynchronous messages and removal

```ts
addScriptMessageHandler<P = any, R = any>(
  name: string,
  handler: (body: P, info?: WebViewMessageInfo) => R | Promise<R>,
  options?: {contentWorld?: WebViewContentWorld; includeFrameInfo?: boolean},
): Promise<void>
removeScriptMessageHandler(name: string, options?: {contentWorld?: WebViewContentWorld}): Promise<void>
```

The original body argument is unchanged. Set `includeFrameInfo: true` to receive a second argument containing `frame` and `contentWorld`. Registering the same name in the same world replaces that handler; the same name in another world is independent. Empty names and the internal names `callMethodsWithReply`, `callMethodsWithoutReply`, and `__exec_js_callback_swift__` are rejected.

Web content awaits `window.webkit.messageHandlers[name].postMessage(body)`. A handler may return a WebKit-serializable value or Promise: undefined, null, booleans, numbers (including nonfinite values), strings, Date, arrays, and plain objects containing these values. A handler with no return value preserves the original undefined reply; an explicit null remains null. Exceptions and Promise rejections reject the webpage Promise with a `javaScriptError` message. Unsupported or cyclic reply values reject it with `serializationError`. A 60-second reply timeout rejects with `timeout`; replacement/removal cancels that handler's pending replies. Navigation, process termination and disposal also cancel outstanding replies. Late results do not restore removed handlers.

```ts
await webView.addScriptMessageHandler("double", async (body: number) => body * 2)
const reply = await webView.callAsyncJavaScript<number>(
  "return await window.webkit.messageHandlers.double.postMessage(21)",
)
await webView.removeScriptMessageHandler("double")
```

## WebKit content rules

```ts
addContentRuleList(options: {id: string; rules: string | Array<Record<string, any>>}): Promise<void>
removeContentRuleList(id: string): Promise<void>
removeAllContentRuleLists(): Promise<void>
```

`rules` accepts WebKit content-blocker JSON text or a rule array. Compilation errors reject with `invalidArgument`. A successful compilation installs the list on this controller. Reusing an id replaces the old list only after the new list compiles successfully. Removal affects this controller's user lists; it does not remove another controller's rules or internal scripts. Removing a pending compilation cancels it with `code: "cancelled"` and prevents a late installation. Apply rules before loading the content they should affect; removing rules does not recreate previously blocked resources in the current document.

These are WebKit content-blocking rules, not a general HTTP interception API. Follow [Apple's content-blocker rule format](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker).

```ts
await webView.addContentRuleList({
  id: "images",
  rules: [{trigger: {"url-filter": ".*", "resource-type": ["image"]}, action: {type: "block"}}],
})
await webView.loadURL("https://example.com")
await webView.removeAllContentRuleLists()
```
