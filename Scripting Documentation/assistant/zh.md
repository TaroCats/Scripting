`Assistant` 模块是 Scripting 内置的 AI 交互与助手系统，提供三类核心能力：

1. **结构化数据请求（JSON Schema）**
2. **低层流式 AI 输出（Streaming）**
3. **系统级助手聊天页面（Conversation UI）**

该模块统一封装了多 AI Provider 的差异，使脚本可以用一致的方式访问不同模型能力。

---

## 一、Provider（AI 提供商）

### `Assistant.Provider`

```ts
type Provider =
  | "openai"
  | "gemini"
  | "anthropic"
  | "deepseek"
  | "openrouter"
  | "grok"
  | { custom: string }
```

#### 说明

* 表示 Assistant 使用的 AI 服务提供商
* 内置 Provider 覆盖主流平台
* `{ custom: string }` 用于：

  * 自建后端
  * 私有代理
  * 公司内部 AI 服务

在 **对话模式（Conversation）** 下，用户可在 UI 中切换 Provider。

---

## 二、可用性与状态变量

### 1. `Assistant.isAvailable: boolean`

#### 含义

表示 **当前用户是否拥有 Assistant 的使用权限**。

#### 说明

* 该值由 Scripting 内部统一判定
* 可能受以下因素影响：

  * 用户权限（如订阅、功能开关）
  * Assistant 功能是否对当前用户开放
* **不直接等同于 API Key 是否配置**
* 当该值为 `false` 时：

  * 所有 Assistant 请求都应被视为不可用
  * 调用相关方法可能抛出错误

#### 使用建议

```ts
if (!Assistant.isAvailable) {
  throw new Error("当前用户无法使用 Assistant")
}
```

---

### 2. `Assistant.isPresented: boolean`

#### 含义

表示 **Assistant 聊天页面是否正在屏幕上展示**。

#### 行为说明

* `true`：

  * 助手 UI 当前处于可见状态
* `false`：

  * 助手 UI 未展示（可能尚未 present，或已 dismiss）

#### 重要区别

* `isPresented` **只反映 UI 状态**
* 并不表示是否存在对话

---

### 3. `Assistant.hasActiveConversation: boolean`

#### 含义

表示 **当前是否存在一个正在进行中的助手会话**。

#### 行为说明

* `true`：

  * 已调用 `startConversation`
  * 会话尚未被 `stopConversation`
* `false`：

  * 当前没有活跃会话

#### 与 `isPresented` 的关系

| 状态        | isPresented | hasActiveConversation |
| --------- | ----------- | --------------------- |
| 未开始       | false       | false                 |
| 已创建但未展示   | false       | true                  |
| 已展示       | true        | true                  |
| dismiss 后 | false       | true                  |
| stop 后    | false       | false                 |

---

## 三、消息与内容模型（Message System）

Assistant 的流式请求与对话 API 使用统一的消息结构。

---

### 1. `MessageItem`

```ts
type MessageItem = {
  role: "user" | "assistant"
  content: MessageContent | MessageContent[]
}
```

#### 字段说明

* `role`

  * `"user"`：用户输入
  * `"assistant"`：模型输出（历史消息）
* `content`

  * 单个内容
  * 或多个内容组成的数组（多模态）

---

### 2. `MessageContent`（联合类型）

```ts
type MessageContent =
  | MessageTextContent
  | MessageImageContent
  | MessageDocumentContent
```

---

### 3. 文本内容

#### `MessageTextContent`

```ts
type MessageTextContent =
  | string
  | {
      type: "text"
      content: string
    }
```

#### 说明

* 最常用的内容类型
* 可直接使用字符串（语法糖）
* 在多内容数组中，建议使用对象形式以保持一致性

---

### 4. 图片内容

#### `MessageImageContent`

```ts
type MessageImageContent = {
  type: "image"
  content: string
}
```

#### 说明

* `content` 必须是 **Base64 Data URI**
* 格式要求：

```
data:image/png;base64,xxxx
data:image/jpeg;base64,xxxx
```

* 用于：

  * 图片理解
  * OCR
  * 场景识别

---

### 5. 文档内容

#### `MessageDocumentContent`

```ts
type MessageDocumentContent = {
  type: "document"
  content: {
    mediaType: string
    data: string
  }
}
```

#### 说明

* 用于向模型提供完整文档数据
* `mediaType` 示例：

  * `"application/pdf"`
  * `"text/plain"`
  * `"application/json"`
* `data` 为 **Base64 编码的原始文件数据**

---

## 四、流式输出（Streaming API）

用于实时消费模型输出，适合聊天、逐字展示、调试和分析。

---

### 1. Stream Chunk 类型

#### `StreamTextChunk`

```ts
type StreamTextChunk = {
  type: "text"
  content: string
}
```

* 普通文本输出
* 最常见的 chunk 类型

---

#### `StreamReasoningChunk`

```ts
type StreamReasoningChunk = {
  type: "reasoning"
  content: string
}
```

* 模型推理过程
* 仅部分模型支持
* 可用于：

  * 调试
  * 解释性展示
  * 隐藏或单独展示推理链

---

#### `StreamUsageChunk`

```ts
type StreamUsageChunk = {
  type: "usage"
  content: {
    totalCost: number | null
    cacheReadTokens: number | null
    cacheWriteTokens: number | null
    inputTokens: number
    outputTokens: number
  }
}
```

#### 字段说明

* `totalCost`

  * 本次请求的总费用（如可用）
* `cacheReadTokens / cacheWriteTokens`

  * 用于支持模型缓存的统计信息
* `inputTokens`

  * 输入 Token 数量
* `outputTokens`

  * 输出 Token 数量

---

### 2. `requestStreaming`

```ts
function requestStreaming(options: {
  systemPrompt?: string | null
  messages: MessageItem | MessageItem[]
  provider?: Provider
  modelId?: string
}): Promise<ReadableStream<StreamChunk>>
```

#### 使用说明

* 返回一个 `ReadableStream`
* 需使用 `for await ... of` 消费
* `systemPrompt`：

  * 用于设定模型角色
  * 与对话 UI 无关

---

## 五、结构化数据请求（requestStructuredData）

用于从自然语言或多模态输入中 **直接生成符合 Schema 的 JSON 数据**。

（Schema 定义此处略，与前文保持一致）

---

## 六、对话式助手（Conversation API）

用于展示 **系统级 Assistant 聊天页面**。

---

### 1. `startConversation`

```ts
function startConversation(options: {
  message: string
  images?: UIImage[]
  autoStart?: boolean
  systemPrompt?: string
  modelId?: string
  provider?: Provider
}): Promise<void>
```

#### 行为说明

* 创建一个新的对话实例
* **不会自动展示 UI**
* 若已有活跃会话：

  * 会抛出错误
  * 必须先调用 `stopConversation`

#### `systemPrompt` 特别说明

* 不传入：

  * 使用 Scripting 内置 Assistant Prompt
  * Assistant Tools 可用
* 传入自定义 Prompt：

  * **Assistant Tools 将不可用**
  * 适用于纯模型对话场景

#### `provider` 和 `modelId` 特别说明

* 用于指定AI提供商和模型，用户可以在对话 UI 中切换

### `autoStart` 特别说明

* `true`: 自动发送第一条消息
* `false` (默认): 不自动发送

---

### 2. `present`

```ts
function present(): Promise<void>
```

* 展示 Assistant 聊天页面
* 若已有会话：

  * 会继续当前会话
* 若无会话：

  * 不会自动创建

---

### 3. `dismiss`

```ts
function dismiss(): Promise<void>
```

* 仅关闭 UI
* **不会结束会话**
* 可稍后再次 `present`

---

### 4. `stopConversation`

```ts
function stopConversation(): Promise<void>
```

* 结束当前会话
* 自动调用 `dismiss`
* 清理内部对话状态

---

## 七、推荐使用流程

### 标准交互流程

```ts
if (!Assistant.isAvailable) return

await Assistant.startConversation({
  message: "帮我分析这张账单",
  systemPrompt: "你是一个财务分析师，你的任务是帮助用户分析账单。",
  provider: "openai",
  autoStart: true,
})

await Assistant.present()
```

### 完整结束流程

```ts
await Assistant.stopConversation()
```

---

## 八、适用场景总结

* 账单 / 发票 / 文档解析
* 多模态 AI 分析
* 交互式智能助手
* 可视化 Token / 成本监控
* AI 驱动的自动化脚本

## 模型选择器

```ts
const selected = await Assistant.presentModelPicker({
  provider: { custom: "已配置的服务商名称或 ID" },
  modelId: "模型 ID"
})
if (selected) {
  const stream = await Assistant.requestStreaming({
    ...selected,
    messages: { role: "user", content: "你好" }
  })
  for await (const chunk of stream) {
    if (chunk.type === "text") console.log(chunk.content)
  }
}
```

`presentModelPicker(options?)` 在当前脚本界面展示已配置服务商与模型，返回 `{ provider, modelId }`；关闭或下拉取消返回 `null`。自定义服务商返回 `{ custom: 服务商ID }`，可以直接传给请求 API。初始选项可以省略。选择仅影响本次返回值，不修改全局默认模型，也不修改服务商配置。配置服务商或增删模型请在应用设置中完成。

此 API 需要可展示界面的运行环境；没有 UI 的后台脚本会拒绝 Promise。支持 `translation_ui_provider.tsx` 的翻译面板，选择模型前建议调用 `TranslationUIProvider.expandSheet()`。


## 已配置的提供商账号

`await Assistant.getProviders()` 按持久配置顺序返回本地账号，不联系提供商、不刷新额度，也不启动登录。未使用的旧占位配置不会返回；列表中的账号仍可能需要凭据或重新登录。

每项包含 `providerID`（稳定 UUID）、`name`、`provider`、`modelId`（默认模型）和 `models`（模型 ID 到公开能力信息的映射）。模型信息包含上下文/输出限制、媒体、缓存和思考能力；缺失值保持缺失。不会返回密钥、Cookie、请求头、端点、User-Agent 或任意请求扩展设置。

```ts
const providers = await Assistant.getProviders()
const account = providers[0]
if (!account) throw new Error("请先在 App 中添加提供商")
const stream = await Assistant.requestStreaming({
  providerID: account.providerID,
  modelId: account.modelId,
  messages: [{ role: "user", content: "你好" }]
})
```

`requestStreaming`、两个 `requestStructuredData` 重载、`startConversation` 与 `presentModelPicker` 均支持 `providerID`。可在 Provider 面板复制 ID，或通过 `getProviders()` 获取；重命名不会改变 ID。未知或已删除的 ID 会报错，不会换用其他账号；同时传 `provider` 时必须匹配该账号。仅传内置 `provider` 类型时，选择该类型持久列表中的首个已配置账号，页面置顶/排序不会改变它；首个账号未登录会返回认证错误，不会跳过它换号。

```ts
const choice = await Assistant.presentModelPicker({ providerID: account.providerID })
if (choice) {
  const result = await Assistant.requestStructuredData("打个招呼", {
    type: "object", properties: { greeting: { type: "string" } }, required: ["greeting"]
  }, { providerID: choice.providerID, modelId: choice.modelId })
}
```

模型选择器需要脚本 UI 上下文，返回 `{provider, providerID, modelId}`，取消时返回 `null`，不修改全局默认。已保存的明确默认账号 ID 也会精确使用，账号缺失或认证失败不会静默切换提供商；仅旧的无 ID 默认路径保留可用性回退，并采用回退提供商自己的默认模型。
