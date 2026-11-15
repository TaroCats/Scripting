The `Assistant` module is Scripting’s unified AI interaction system.
It provides a consistent abstraction over multiple AI providers and supports three major usage patterns:

1. **Structured JSON data extraction**
2. **Low-level streaming AI output**
3. **System-level assistant chat UI (conversation mode)**

The module is designed to be flexible enough for automation scripts while also supporting rich, interactive user experiences.

---

## 1. Provider

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

#### Description

Specifies which AI provider the Assistant should use.

* Built-in providers cover mainstream AI platforms
* `{ custom: string }` allows integration with:

  * Self-hosted backends
  * Internal company AI services
  * Proxy or gateway APIs

In **conversation mode**, users may change the provider directly from the assistant chat UI.

---

## 2. Availability and State Flags

### 2.1 `Assistant.isAvailable: boolean`

#### Meaning

Indicates **whether the current user has access to the Assistant feature**.

#### Notes

* This value is determined internally by Scripting
* It may depend on:

  * User permissions
  * Subscription or feature availability
  * App-level configuration
* It does **not** directly reflect whether an API key is configured

If `false`, all Assistant APIs should be considered unavailable and may throw errors.

#### Recommended usage

```ts
if (!Assistant.isAvailable) {
  throw new Error("Assistant is not available for the current user")
}
```

---

### 2.2 `Assistant.isPresented: boolean`

#### Meaning

Indicates **whether the Assistant chat page is currently visible on screen**.

#### Behavior

* `true`: the assistant UI is presented
* `false`: the assistant UI is not visible

This flag reflects **UI state only** and does not indicate whether a conversation exists.

---

### 2.3 `Assistant.hasActiveConversation: boolean`

#### Meaning

Indicates **whether there is an active assistant conversation instance**.

#### Behavior

* `true`: `startConversation` has been called and not yet stopped
* `false`: no active conversation exists

#### Relationship between flags

| State                | isPresented | hasActiveConversation |
| -------------------- | ----------- | --------------------- |
| Idle                 | false       | false                 |
| Conversation created | false       | true                  |
| UI presented         | true        | true                  |
| UI dismissed         | false       | true                  |
| Conversation stopped | false       | false                 |

---

## 3. Message and Content Model

The streaming API and conversation system use a unified message structure.

---

### 3.1 `MessageItem`

```ts
type MessageItem = {
  role: "user" | "assistant"
  content: MessageContent | MessageContent[]
}
```

#### Fields

* `role`

  * `"user"`: user input
  * `"assistant"`: assistant output or history
* `content`

  * A single content item
  * Or an array of content items for multimodal input

---

### 3.2 `MessageContent`

```ts
type MessageContent =
  | MessageTextContent
  | MessageImageContent
  | MessageDocumentContent
```

Represents one unit of message content. Multiple contents may be combined in an array.

---

### 3.3 Text Content

#### `MessageTextContent`

```ts
type MessageTextContent =
  | string
  | {
      type: "text"
      content: string
    }
```

#### Notes

* The string form is a shorthand for simple cases
* The object form is recommended when mixing multiple content types
* Used for:

  * Prompts
  * Chat messages
  * Instructions

---

### 3.4 Image Content

#### `MessageImageContent`

```ts
type MessageImageContent = {
  type: "image"
  content: string
}
```

#### Notes

* `content` must be a **Base64 data URI**
* Required format:

```
data:image/png;base64,...
data:image/jpeg;base64,...
```

* Used for:

  * Image understanding
  * OCR
  * Visual analysis

---

### 3.5 Document Content

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

#### Notes

* Designed for full document ingestion
* `mediaType` examples:

  * `application/pdf`
  * `text/plain`
  * `application/json`
* `data` must be Base64-encoded raw file data

---

## 4. Streaming API

The streaming API enables real-time consumption of assistant output.

---

### 4.1 Stream Chunk Types

#### `StreamTextChunk`

```ts
type StreamTextChunk = {
  type: "text"
  content: string
}
```

* Standard textual output
* The most common chunk type

---

#### `StreamReasoningChunk`

```ts
type StreamReasoningChunk = {
  type: "reasoning"
  content: string
}
```

* Represents the model’s reasoning process
* Only supported by some models
* Suitable for:

  * Debugging
  * Explanation displays
  * Internal inspection

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

#### Field descriptions

* `totalCost`: total request cost, if available
* `cacheReadTokens`: tokens read from cache
* `cacheWriteTokens`: tokens written to cache
* `inputTokens`: number of input tokens
* `outputTokens`: number of output tokens

---

### 4.2 `requestStreaming`

```ts
function requestStreaming(options: {
  systemPrompt?: string | null
  messages: MessageItem | MessageItem[]
  provider?: Provider
  modelId?: string
}): Promise<ReadableStream<StreamChunk>>
```

#### Behavior

* Returns a `ReadableStream`
* Must be consumed using `for await ... of`
* `systemPrompt` defines model behavior but is independent of the chat UI

---

## 5. Structured Data Requests

`requestStructuredData` allows the assistant to return JSON data that conforms to a predefined schema.

(Text-only and image-assisted variants behave as previously documented; schema definitions remain unchanged.)

---

## 6. Conversation (Assistant Chat UI)

The conversation APIs manage Scripting’s built-in assistant chat interface.

---

### 6.1 `startConversation`

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

#### Behavior

* Creates a new conversation instance
* Does **not** automatically present the UI
* Throws an error if a conversation already exists

#### `systemPrompt` note

* Not provided:

  * Uses Scripting’s default assistant system prompt
  * Assistant Tools are available
* Provided:

  * Replaces the default prompt
  * **Assistant Tools become unavailable**

#### `provider` and `modelId` note

If you want to use a custom provider, you can pass it in here, and the user can change the provider in the assistant chat page.

#### `autoStart` note

* `true`: automatically send the first message
* `false` (default): do not automatically send the first message

---

### 6.2 `present`

```ts
function present(): Promise<void>
```

* Presents the assistant chat UI
* If a conversation already exists, it resumes that conversation

---

### 6.3 `dismiss`

```ts
function dismiss(): Promise<void>
```

* Hides the assistant UI
* Does **not** end the conversation
* The conversation can be presented again later

---

### 6.4 `stopConversation`

```ts
function stopConversation(): Promise<void>
```

* Ends the current conversation
* Automatically dismisses the UI
* Clears internal conversation state

---

## 7. Recommended Usage Flow

### Typical interaction

```ts
if (!Assistant.isAvailable) return

await Assistant.startConversation({
  message: "Analyze this receipt",
  systemPrompt: "You are a receipt analyzer.",
  provider: "openai",
  autoStart: true,
})

await Assistant.present()
```

### Proper cleanup

```ts
await Assistant.stopConversation()
```

---

## 8. Typical Use Cases

* Receipt and invoice parsing
* Multimodal AI analysis
* Interactive AI assistants
* Token and cost visualization
* AI-driven automation workflows

## Model picker

```ts
const selected = await Assistant.presentModelPicker()
if (selected) {
  const stream = await Assistant.requestStreaming({
    ...selected,
    messages: { role: "user", content: "Hello" }
  })
  for await (const chunk of stream) {
    if (chunk.type === "text") console.log(chunk.content)
  }
}
```

`presentModelPicker(options?)` shows configured providers and models in the current script's UI context. It returns `{ provider, modelId }`, or `null` when closed or cancelled. Optional initial options contain `provider` and/or `modelId`. Custom providers are returned as `{ custom: providerId }`, which request APIs accept directly. The selection does not change global defaults or provider configuration. Configure providers and add/remove models in the app's settings.

Requires a UI context. Background scripts without a UI reject the Promise. It also works in `translation_ui_provider.tsx`; call `TranslationUIProvider.expandSheet()` before showing it.


## Configured provider accounts

`await Assistant.getProviders()` returns local account configurations in their persistent order. It does not contact a provider, refresh usage, or start sign-in. Unused legacy placeholders are omitted; a listed account may still need credentials or sign-in.

Each item contains `providerID` (stable UUID), `name`, `provider`, `modelId` (default), and `models` (model ID to public capability metadata). Model metadata includes context/output limits and supported media/caching/thinking flags; absent values remain absent. Credentials, cookies, request headers, endpoints, user agents, and arbitrary request settings are omitted.

```ts
const providers = await Assistant.getProviders()
const account = providers[0]
if (!account) throw new Error("Add a provider in the app first")
const stream = await Assistant.requestStreaming({
  providerID: account.providerID,
  modelId: account.modelId,
  messages: [{ role: "user", content: "Hello" }]
})
```

`providerID` is accepted by `requestStreaming`, both `requestStructuredData` overloads, `startConversation`, and `presentModelPicker`. Copy it from the Provider panel or read it with `getProviders()`. Renaming an account keeps its ID. An unknown/deleted ID rejects; it never selects another account. If `provider` is also supplied, it must match that account. Without `providerID`, a built-in `provider` type selects the first configured account of that type in persistent order, regardless of picker sorting. A signed-out first account reports its authentication error instead of switching accounts.

```ts
const choice = await Assistant.presentModelPicker({ providerID: account.providerID })
if (choice) {
  const result = await Assistant.requestStructuredData("Say hello", {
    type: "object", properties: { greeting: { type: "string" } }, required: ["greeting"]
  }, { providerID: choice.providerID, modelId: choice.modelId })
}
```

The picker needs a script UI context and returns `{provider, providerID, modelId}` or `null` on cancellation. It does not change global defaults. An explicitly saved default account ID is also used exactly; a missing account or authentication failure does not silently switch providers. The older default without an ID retains its availability fallback, using the fallback provider's default model.
