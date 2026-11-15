Scripting 提供了一套与 SwiftUI Drag & Drop 行为模型高度一致的 API，用于在脚本中实现视图间、应用内或跨应用的拖拽与放置操作。

该能力主要由以下三部分构成：

* **onDrag**：将当前视图声明为拖拽源
* **onDrop**：将当前视图声明为放置目标
* **DropInfo / ItemProvider / UTType**：描述拖拽内容与状态的上下文对象

拖拽与放置是一个严格受系统控制的交互流程，部分 API 只能在特定回调中调用，文档中会明确指出这些限制。

---

## 核心数据类型

### DropInfo

`DropInfo` 描述一次拖拽在当前放置视图上的实时状态。该对象仅在 `onDrop` 相关回调中有效。

#### 属性

##### location: Point

* 表示拖拽当前位置
* 坐标空间为 **放置视图自身的本地坐标系**
* 可用于实现基于位置的高亮、插入指示线、排序逻辑等

#### 方法

##### hasItemsConforming(types: UTType[]): boolean

* 用于判断拖拽内容中，是否至少有一个项目符合指定的 UTType
* 常用于：

  * `validateDrop`
  * `dropEntered`
  * `dropUpdated`
* 不会实际加载数据，仅用于能力判断

##### itemProviders(types: UTType[]): ItemProvider[]

* 返回符合指定 UTType 的 `ItemProvider` 列表
* **仅允许在 `performDrop` 回调中调用**
* 在该方法返回后，系统将撤销对拖拽数据的访问权限

> 重要约束
> 必须在 `performDrop` 方法作用域内 **立即开始** 对 ItemProvider 的数据加载（如 `loadData`、`loadText`）。
> 不允许延迟到其他回调或异步逻辑中再发起加载。

---

## DropOperation

`DropOperation` 用于描述当前拖拽更新阶段，目标视图期望执行的操作类型。

可选值如下：

* `"copy"`
  表示复制数据（最常见，用于文件、文本、图片等）

* `"move"`
  表示移动数据（通常仅用于应用内部拖拽）

* `"cancel"`
  取消本次拖拽，不执行任何数据传输

* `"forbidden"`
  明确禁止当前拖拽行为，系统通常会显示禁止指示

`DropOperation` 通常由 `dropUpdated` 回调返回，用于动态控制拖拽行为。

---

## DragDropProps

`DragDropProps` 是所有支持拖拽与放置能力的视图可选属性集合。

---

## onDrag

### 用途

将当前视图声明为 **拖拽源**，允许用户从该视图开始一次拖拽操作。

### 定义

```ts
onDrag?: {
  data: () => ItemProvider
  preview: VirtualNode
}
```

### 参数说明

#### data

```ts
data: () => ItemProvider
```

* 返回一个 `ItemProvider`
* 用于描述拖拽时传递的数据内容
* 支持文本、图片、文件、URL、自定义类型等
* 每次拖拽开始时调用

> 建议
> 仅在该回调中构造 ItemProvider，不要复用旧实例，以确保数据状态正确。

#### preview

```ts
preview: VirtualNode
```

* 指定拖拽开始后显示的预览视图
* 系统会自动将其渲染为拖拽浮层
* 预览视图默认居中于源视图

---

## onDrop

### 用途

将当前视图声明为 **放置目标**，并通过一组回调精细控制拖拽验证、状态变化与最终数据接收。

### 定义

```ts
onDrop?: {
  types: UTType[]
  validateDrop?: (info: DropInfo) => boolean
  dropEntered?: (info: DropInfo) => void
  dropUpdated?: (info: DropInfo) => DropOperation | null
  dropExited?: (info: DropInfo) => void
  performDrop: (info: DropInfo) => boolean
}
```

---

### onDrop.types

```ts
types: UTType[]
```

* 声明该视图 **允许接收的内容类型**
* 如果拖拽内容不包含任意一个匹配类型：

  * 放置区域不会激活
  * `validateDrop` 不会被调用
  * 视觉高亮不会出现

---

### validateDrop

```ts
validateDrop?: (info: DropInfo) => boolean
```

* 用于判断是否允许开始一次放置操作
* 返回 `false` 将直接拒绝拖拽
* 常见用途：

  * 检查类型数量
  * 校验业务状态（如只允许空列表接收）

默认行为：始终返回 `true`

---

### dropEntered

```ts
dropEntered?: (info: DropInfo) => void
```

* 当拖拽进入放置区域时触发
* 通常用于：

  * 显示高亮
  * 显示插入占位符
  * 触发动画状态

---

### dropUpdated

```ts
dropUpdated?: (info: DropInfo) => DropOperation | null
```

* 当拖拽在放置区域内部移动时反复调用
* 用于动态返回期望的 `DropOperation`

返回值说明：

* 返回具体的 `DropOperation`：更新当前拖拽行为
* 返回 `null`：

  * 使用上一次返回的有效值
  * 若没有历史值，默认使用 `"copy"`

---

### dropExited

```ts
dropExited?: (info: DropInfo) => void
```

* 当拖拽离开放置区域时触发
* 常用于清理高亮、移除占位 UI

---

### performDrop

```ts
performDrop: (info: DropInfo) => boolean
```

* **最关键的回调**
* 表示用户已松手，系统允许你读取拖拽数据
* 返回值：

  * `true`：表示成功接收并处理了拖拽
  * `false`：表示放置失败

#### 重要约束（必须遵守）

* 必须在该方法作用域内：

  * 调用 `info.itemProviders(...)`
  * 并立即开始数据加载
* 不允许：

  * 将 ItemProvider 保存到外部
  * 在异步回调中延迟访问拖拽数据

这是系统级安全限制，不遵守将导致数据无法访问。

---

## 典型使用流程总结

1. 用户从 `onDrag` 视图开始拖拽
2. 系统根据 `onDrop.types` 判断是否激活目标
3. 调用 `validateDrop`
4. 进入放置区域 → `dropEntered`
5. 移动过程中 → 多次 `dropUpdated`
6. 离开区域 → `dropExited`
7. 松手 → `performDrop`
8. 在 `performDrop` 中读取并处理数据

---

## 设计建议与最佳实践

* 始终精确声明 `UTType`，避免过于宽泛
* 在 `dropUpdated` 中返回 `"forbidden"` 可显式阻止非法拖拽
* 复杂数据解析逻辑应在 `ItemProvider` 加载完成后的异步回调中完成，而不是在 `performDrop` 中同步阻塞
* 跨应用拖拽时，优先使用系统标准类型（text、image、file、url）


---

## iOS 27.0 拖放会话与文本剪贴板

以下接口均支持直接 props 和链式 `modifiers()`，旧系统忽略。需要返回值的回调必须同步返回，不能返回 Promise。

- `dragConfiguration: { allowMove?: boolean, allowCopyOutsideApp?: boolean }`：App 内移动默认关闭，向其他 App 复制默认允许。
- `onDragSessionUpdated(session)` / `onDropSessionUpdated(session)`：接收普通对象快照，`id` 是不透明会话标识。拖拽快照包含 phase、operation（或 null）、location、draggedItemIndex、字符串 draggedItemIDs；放下快照包含 phase、operation、location、size、itemsCount、suggestedOperations、isLocal、字符串 draggedItemIDs、reorderDestination（或 null）。来源没有提供字符串 ID 时，ID 数组为空。
- `dropConfiguration(session)`：返回 `"copy"`、`"move"`、`"cancel"` 或 `"forbidden"`，无效结果回退为 forbidden。它只选择操作，不读取或处理负载，仍需保留 drop 处理器。
- `draggable: { containerItemID: string, containerNamespace?: NamespaceID }`、`dragContainer: { payload: (itemIDs: string[]) => string[], namespace?: NamespaceID }` 和 `dragContainerSelection: { selection: string[], containerNamespace?: NamespaceID }`：支持字符串 Transferable 负载。本桥接中字符串值本身就是 ID，payload 应返回这些 ID；需要隔离容器时通过 NamespaceReader 提供命名空间。文件或自定义负载继续使用 `onDrag` / `onDrop` 与 ItemProvider。
- `copyable: string[] | (() => string[])`、`cuttable: () => string[]`、`pasteDestination: { action: (items: string[]) => void, validator?: (items: string[]) => string[] }`：文本剪贴板操作。不提供 validator 时接受全部文本；cut 回调应同步更新源数据。这些接口配置视图的 SwiftUI 命令处理，不会主动创建按钮或菜单。

27.0 SDK 中 `onCopyCommand`、`onCutCommand`、`onPasteCommand` 所在扩展仍标记 iOS unavailable，因此没有暴露这三个名称。Swift 泛型 Transferable 不能直接映射成任意 JavaScript 负载，本次新增包装明确只支持字符串。

```tsx
<VStack
  dragContainer={{ payload: ids => ids }}
  dragContainerSelection={{ selection: selectedIDs }}
  dragConfiguration={{ allowMove: true, allowCopyOutsideApp: false }}
>
  <Text draggable={{ containerItemID: "apple" }}>Apple</Text>
</VStack>

<Text copyable={() => [selectedText]} pasteDestination={{
  validator: items => items.filter(text => text.length > 0),
  action: items => insertText(items.join("\n")),
}}>Clipboard target</Text>
```

### 会话快照类型

`operation` 在 ending / ended 阶段提供操作值，其余阶段为 null；`unknown` 用于兼容未来原生阶段。非原生重排容器内的 `reorderDestination` 为 null。坐标单位为 point，快照不暴露原生会话方法或负载读取方法。

```ts
type DropOperation = 'cancel' | 'copy' | 'forbidden' | 'move'

export type DragSession = {
  id: string
  phase: 'initial' | 'active' | 'ending' | 'ended' | 'dataTransferCompleted' | 'unknown'
  operation: DropOperation | null
  location: { x: number, y: number }
  draggedItemIndex: number
  draggedItemIDs: string[]
}
export type DropSession = {
  id: string
  phase: 'entering' | 'active' | 'exiting' | 'ended' | 'dataTransferCompleted' | 'unknown'
  operation: DropOperation | null
  location: { x: number, y: number }
  size: { width: number, height: number }
  /** Proposed native reorder destination, or null outside a reorderable container. */
  reorderDestination: ReorderDestination | null
  itemsCount: number
  suggestedOperations: DropOperation[]
  isLocal: boolean
  draggedItemIDs: string[]
}
export type ReorderDestination = ({ position: 'before', itemID: string } | { position: 'end' }) & { collectionID?: string }
export type ReorderDifference = {
  sources: string[]
  destination: ReorderDestination
}

```

### 剪切示例

同步返回文本并清空源数据。

```tsx
<Text cuttable={() => {
  const text = selectedText.value
  selectedText.value = ""
  return [text]
}}>{selectedText.value}</Text>
```
