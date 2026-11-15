`Translation` API 提供了将文本在不同语言之间翻译的能力，支持单条文本和批量文本的翻译，适用于 **iOS 18.0 及以上系统**。

## 概览

此 API 通过 `Translation` 类提供，包含以下功能：

* 共享的全局翻译实例 `Translation.shared`
* 翻译单条文本
* 翻译多条文本（批量翻译）
* 支持自动检测源语言并根据设备偏好选择目标语言

---

## 类：`Translation`

### `Translation.shared: Translation`

提供一个共享的 `Translation` 实例，适用于无界面脚本或需要复用统一翻译主机的场景。

#### 示例

```ts
const translated = await Translation.shared.translate({
  text: "Hello, world!",
  source: "en",
  target: "es"
})

console.log(translated) // 输出: "¡Hola, mundo!"
```

---

### 方法：`translate(options): Promise<string>`

将一段文本从源语言翻译为目标语言。

#### 参数

* `options.text: string`
  要翻译的文本内容。

* `options.source?: string`
  源语言代码，例如 `"en"` 表示英语。如果省略或为 `null`，系统将自动尝试识别源语言，并在不确定时提示用户选择。

* `options.target?: string`
  目标语言代码，例如 `"es"` 表示西班牙语。如果省略或为 `null`，系统将根据设备的 `Device.preferredLanguages` 和源语言自动选择目标语言。

#### 返回值

* `Promise<string>` — 返回一个 Promise，解析为翻译后的文本字符串。

#### 异常

* 翻译失败时会抛出错误（例如网络问题、不支持的语言等）。

#### 示例

```ts
const translated = await Translation.shared.translate({
  text: "Good morning",
  target: "fr"
})

console.log(translated) // 输出: "Bonjour"
```

---

### 方法：`translateBatch(options): Promise<string[]>`

将多个文本条目从源语言翻译为目标语言，支持批量处理。

#### 参数

* `options.texts: string[]`
  要翻译的文本数组。返回的翻译结果与输入顺序一一对应。

* `options.source?: string`
  源语言代码，作用同 `translate` 方法。

* `options.target?: string`
  目标语言代码，作用同 `translate` 方法。

#### 返回值

* `Promise<string[]>` — 返回一个 Promise，解析为翻译后的文本数组。

#### 异常

* 如果翻译过程中出现任何错误，会抛出异常。

#### 示例

```ts
const results = await Translation.shared.translateBatch({
  texts: ["Hello", "Good night", "Thank you"],
  source: "en",
  target: "ja"
})

console.log(results)
// 输出: ["こんにちは", "おやすみなさい", "ありがとう"]
```

---

## 注意事项

* 语言代码应使用 [ISO 639-1](https://zh.wikipedia.org/wiki/ISO_639-1) 标准（如 `"en"` 表示英语，`"zh"` 表示中文，`"de"` 表示德语）。
* API 使用系统级翻译服务，部分情况下可能弹出语言选择提示。
* 在以下场景中应使用 `translationHost` 视图修饰符：
  * **在用户界面中进行翻译操作**
    当你的脚本包含用户界面（例如使用 `<VStack>`、`<List>` 等）并使用自定义的 `Translation` 实例（例如通过 `new Translation()` 创建）执行翻译时，**必须**将 `translationHost` 应用于根视图，以便系统能够弹出权限请求、语言下载提示或源语言选择对话框。

  * **未指定源语言（`source` 为 `null`）**
    如果在翻译请求中省略了 `source` 字段，依赖系统自动检测语言，当检测失败时，`translationHost` 可确保系统能够提示用户手动选择源语言。

  * **可能需要下载语言包**
    如果设备未安装所需的源语言或目标语言，`translationHost` 允许系统向用户弹出下载提示，从而完成翻译任务。

* 如果你使用的是预设绑定的 `Translation.shared` 实例，并且脚本不涉及任何界面（如后台运行的脚本），则**不需要**设置 `translationHost`。

## 无 UI 翻译 — iOS/macOS 26+

新增 `translateInstalled(options): Promise<string>` 和 `translateInstalledBatch(options): Promise<string[]>`，使用设备上已经安装的语言进行翻译。可通过 `Translation.shared` 或 `new Translation()` 调用，无需 `translationHost`，不会弹出语言下载提示。

- 单条传入 `text: string`，批量传入 `texts: string[]`。
- `source: string` 必填；这两个方法不自动检测源语言。
- `target?: string` 指定目标语言；省略时系统根据首选语言和源语言选择。
- 批量结果与输入顺序一致，包括重复文本；空批次返回 `[]`。
- 26 之前的系统、不支持的语言或语言未安装时，Promise 会拒绝。请先在 App 中使用现有、带翻译宿主的方法准备语言。

```ts
const result = await Translation.shared.translateInstalled({
  text: "Hello", source: "en", target: "zh-Hans"
})
const results = await new Translation().translateInstalledBatch({
  texts: ["Hello", "Goodbye"], source: "en", target: "fr"
})
```

### Safari 用户脚本

Safari 仅通过 `Scripting.Translation` 暴露新的无 UI 方法。需要 iOS/macOS 26+、已安装语言和 `@grant Scripting.Translation`，在 content world 调用。Safari 不暴露依赖翻译宿主的 `translate`/`translateBatch`，也不弹出下载界面。单次请求最多 64 条文本，UTF-8 文本合计最多 256 KiB。原生失败时 Promise 拒绝，不自动重试请求。

```js
// @grant Scripting.Translation
// @inject-into content
const result = await Scripting.Translation.translateInstalled({
  text: "Hello", source: "en", target: "zh-Hans"
})
```

此无需 UI 的初始化接口见 [Apple 官方文档](https://developer.apple.com/documentation/translation/translationsession/init(installedsource:target:))。
