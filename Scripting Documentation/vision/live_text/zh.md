# 实况文本

使用 `LiveText.analyze()` 读取静态图片中的整图文字，或使用 `LiveTextView`，让用户通过系统实况文本控件直接在图片中选中文字。两者适用于 Scripting App 的前台脚本（`index` 和 `home_screen`），需要支持实况文本且运行 iOS 或 iPadOS 17 及以上版本的设备。

## 读取图片中的文字

`LiveText` 是全局 API。示例中的 `image` 是 `UIImage`，可通过 `UIImage.fromFile()` 或 `UIImage.fromData()` 等方式取得。

```ts
if (typeof LiveText !== 'undefined' && LiveText.isSupported()) {
  const text = await LiveText.analyze(image)
  console.log(text)
}
```

- `isSupported()` 检查当前脚本环境和设备是否支持实况文本。`getSupportedTextRecognitionLanguages()` 返回可用的语言标识。实况文本不可用时，返回空数组。
- 传入 `{ locales: [...] }` 时，按优先顺序填写列表中的语言标识。省略 `locales` 或传入 `[]` 使用系统默认设置。
- `analyze()` 按系统阅读顺序返回字符串。`""` 表示未找到文字。需要识别候选、置信度或文字边框时，使用 `Vision.recognizeText()`。
- 传入 Scripting `AbortController` 的 `{ signal }` 可以取消分析。失败时可检查 `error.code`，例如 `cancelled`、`unsupported`、`invalidArgument`、`resourceLimit` 或 `nativeFailure`。达到资源上限时，可以缩小图片或等其他分析结束后再试。

## 让用户选中文字

```tsx
import { LiveTextView } from 'scripting'

<LiveTextView
  image={image}
  frame={{ height: 260 }}
  accessibilityLabel="收据"
  onSelectionChange={text => console.log(text)}
  onError={code => console.log(code)}
/>
```

视图将图片按原比例居中显示，支持通用视图修饰符以及相同的 `locales` 选项。默认的 `interaction="textSelection"` 提供系统文本菜单。设为 `interaction="textAndDataDetectors"` 后，还可使用系统操作处理链接、电话号码和二维码等内容。

`onSelectionChange` 接收当前选中的文字。在同一张图上取消选区时收到 `""`。换图时，请清空脚本中保存的选区。`onError` 接收错误码，图片仍会显示。识别到文字时，也可通过「查看识别文字」入口阅读或复制整图文字。
