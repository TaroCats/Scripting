`ScrollView` 组件用于在可滚动区域中显示其内容。当用户执行滚动手势时，可视区域会随之更新。你可以通过 `axes` 属性控制滚动方向，支持垂直、水平或双向滚动。

## 类型定义

```ts
type ScrollViewProps = {
  axes?: AxisSet
  children?: VirtualNode | VirtualNode[] | (VirtualNode | undefined | null)[]
}
```

## 基本说明

* 滚动方向由 `axes` 属性控制。
* 内容通过 `children` 指定，通常使用如 `<VStack>`、`<HStack>` 等布局容器。
* 不支持缩放操作。

## 默认行为

* 默认滚动方向为 **垂直**。
* 滚动指示器根据平台默认行为自动显示，除非通过 modifier 显式设置。

## 示例

```tsx
<ScrollView>
  <VStack>
    {new Array(100).fill('').map((_, index) => (
      <Text>Row {index}</Text>
    ))}
  </VStack>
</ScrollView>
```

---

## ScrollView 修饰符说明

你可以使用以下视图修饰符配置滚动行为：

---

### `scrollIndicator`

控制滚动指示器的显示方式。

#### 类型定义

```ts
scrollIndicator?: ScrollScrollIndicatorVisibility | {
  visibility: ScrollScrollIndicatorVisibility
  axes: AxisSet
}
```

#### `ScrollScrollIndicatorVisibility` 可选值：

* `"automatic"`：遵循系统默认行为。
* `"visible"`：显示指示器，可能会自动隐藏。
* `"hidden"`：隐藏指示器，除非被系统强制显示。
* `"never"`：从不显示指示器。

#### 示例

```tsx
<ScrollView scrollIndicator="never">
  <VStack>{/* 内容 */}</VStack>
</ScrollView>
```

设置特定方向的指示器：

```tsx
<ScrollView
  scrollIndicator={{
    visibility: "hidden",
    axes: "vertical"
  }}
>
  <VStack>{/* 内容 */}</VStack>
</ScrollView>
```

---

### `scrollDisabled`

完全禁用滚动行为。

#### 类型定义

```ts
scrollDisabled?: boolean
```

#### 示例

```tsx
<ScrollView scrollDisabled>
  <Text>该滚动视图已被锁定。</Text>
</ScrollView>
```

---

### `scrollClipDisabled`

控制是否允许内容超出滚动视图边界显示。

#### 类型定义

```ts
scrollClipDisabled?: boolean
```

#### 示例

```tsx
<ScrollView scrollClipDisabled>
  {/* 内容可能会超出滚动区域边界 */}
</ScrollView>
```

---

### `scrollDismissesKeyboard`

指定滚动行为对软件键盘的影响。

#### 类型定义

```ts
scrollDismissesKeyboard?: ScrollDismissesKeyboardMode
```

#### 可选值

* `"automatic"`：根据上下文决定默认行为。
* `"immediately"`：滚动开始时立即关闭键盘。
* `"interactively"`：允许用户拖动关闭键盘。
* `"never"`：滚动不会影响键盘。

#### 示例

```tsx
<ScrollView scrollDismissesKeyboard="interactively">
  {/* 含有输入框的内容 */}
</ScrollView>
```

---

### `defaultScrollAnchor`

设置初始显示的内容锚点，或内容变化时保持该锚点对齐。

#### 类型定义

```ts
defaultScrollAnchor?: KeywordPoint | Point
```

#### `KeywordPoint` 关键词

如 `"top"`、`"bottom"`、`"leading"`、`"trailing"`、`"center"`、`"topLeading"`、`"bottomTrailing"` 等。

#### 示例

```tsx
<ScrollView defaultScrollAnchor="bottom">
  <VStack>
    {/* 新增内容会保持底部对齐 */}
  </VStack>
</ScrollView>
```

---

### `AxisSet`

定义滚动方向。

#### 类型定义

```ts
type AxisSet = 'vertical' | 'horizontal' | 'all'
```

#### 示例

```tsx
<ScrollView axes="horizontal">
  <HStack>{/* 横向滚动内容 */}</HStack>
</ScrollView>
```

---

### `scrollTargetLayout`

用于标记滚动区域中的主要布局容器，便于对齐与滚动控制。

#### 类型定义

```ts
scrollTargetLayout?: boolean
```

#### 示例

```tsx
<ScrollView axes="horizontal">
  <LazyHStack scrollTargetLayout>
    {items.map(item => <Text>{item.title}</Text>)}
  </LazyHStack>
</ScrollView>
```

---

### `scrollTargetBehavior`

定义滚动时如何对齐内容。

#### 类型定义

```ts
scrollTargetBehavior?: ScrollTargetBehavior
```

```ts
type ScrollTargetBehavior =
  | "paging"
  | "viewAligned"
  | "viewAlignedLimitAutomatic"
  | "viewAlignedLimitAlways"
  | "viewAlignedLimitNever"
  | "viewAlignedLimitAlwaysByFew"
  | "viewAlignedLimitAlwaysByOne"
```

#### 模式说明

* `"paging"`：分页滚动，以容器尺寸为单位。
* `"viewAligned"`：滚动时按视图边界对齐。
* `"viewAlignedLimitAutomatic"`：在紧凑横向环境下限制滚动数量，其他情况放开。
* `"viewAlignedLimitAlways"`：始终限制每次滚动的项目数量。
* `"viewAlignedLimitNever"`：不限制滚动范围。
* `"viewAlignedLimitAlwaysByFew"` *(仅 iOS 18.0+)*：每次滚动少量视图。
* `"viewAlignedLimitAlwaysByOne"` *(仅 iOS 18.0+)*：每次滚动一个视图。

#### 描述

用于配置内容滚动对齐策略，适用于横向滚动的列表、分页等场景。

---

### `scrollPosition`

把 ScrollView 中**当前 leading 可见 item 的 id** 双向绑定到 JS state。对应 SwiftUI 的 `.scrollPosition(id:anchor:)`，无需 `ScrollViewReader` 包一层。

#### 类型定义

```ts
scrollPosition?:
  | Observable<string>
  | Observable<number>
  | Observable<string | null>
  | Observable<number | null>
  | { value: Observable<string | number | null>; anchor?: KeywordPoint | Point }
  | {
      value: string | number | null
      onChanged: (newValue: string | number | null) => void
      anchor?: KeywordPoint | Point
    }
```

#### 三步起步

1. `ScrollView` 下面的直接容器（一般是 `LazyVStack` / `LazyHStack` / `VStack`）必须开 `scrollTargetLayout`。
2. 想被滚到的子节点都要加 `key="..."`，bridge 会把它映射到 SwiftUI `.id()`。
3. `scrollPosition` 绑到 state —— 可以直传 `Observable`，也可以用 `{ value, onChanged }`。

#### 示例

```tsx
const [visibleId, setVisibleId] = useState<string | null>(null)

<ScrollView
  scrollPosition={{ value: visibleId, onChanged: setVisibleId, anchor: "top" }}
>
  <LazyVStack scrollTargetLayout>
    {items.map(it => (
      <HStack key={it.id}>{/* row content */}</HStack>
    ))}
  </LazyVStack>
</ScrollView>
```

* `id` 可以是 `string` 或 `number`。state 初始化用什么类型就一直用这个类型，bridge 按运行时类型分发。
* state 设成 `null` 时由 SwiftUI 自己管滚动位置；设成具体 id 时滚到该 item 并贴在 `anchor` 处。
* `anchor` 是 `UnitPoint`：字符串关键字 `"top"` / `"center"` / `"leading"` 等，或 `{ x, y }`。

#### 注意点

* **忘了 `scrollTargetLayout`。** 没开 SwiftUI 不知道哪个子节点是 "当前 scroll target"，binding 静默无效。
* **id 类型混用。** `Observable<number>` 跟 `key="some-string"` 的子节点匹配不上。两边类型保持一致。
* **运行时类型切换。** Observable 初值给一个具体值（如 `useState<string|null>("first")`），bridge 才能在 modifier 创建时识别类型。一直是 `null` 时默认走 string 路径。
* **ScrollViewReader vs scrollPosition。** 同一个 ScrollView 不要同时用 —— 命令式的 `scrollTo(id:)` 和声明式的 `scrollPosition` 会互相打架，二选一。

---

### `onScrollTargetVisibilityChange`

iOS 18+。订阅 ScrollView 中**当前可见 scroll target 的 id 集合**变化。每次满足 `threshold` 的可见 id 集合发生变化时回调一次。对应 SwiftUI 的 `.onScrollTargetVisibilityChange(idType:threshold:_:)`。

#### 类型定义

```ts
onScrollTargetVisibilityChange?: {
  idType: "string" | "number"
  threshold?: number   // 0.0 - 1.0, 默认 0.5
  onChanged: (ids: string[] | number[]) => void
}
```

#### 必备条件

跟 `scrollPosition` 一样：

1. 直接容器开 `scrollTargetLayout`。
2. 子节点用 `key="..."` 或 `key={123}` 标 id。
3. **`idType` 必须跟 key 的实际类型一致** —— SwiftUI 这个 API 是泛型，桥层需要在 modifier 创建时就静态分发，运行期没法从 `[AnyHashable]` 反推 ID 类型。string key → `"string"`；number key → `"number"`。

#### 示例

```tsx
const [visibleIds, setVisibleIds] = useState<string[]>([])

<ScrollView
  onScrollTargetVisibilityChange={{
    idType: "string",
    threshold: 0.5,
    onChanged: (ids) => setVisibleIds(ids as string[]),
  }}
>
  <LazyVStack scrollTargetLayout>
    {items.map(it => <Row key={it.id} />)}
  </LazyVStack>
</ScrollView>
```

#### 注意点

* **iOS 17 fallback**：iOS 17 上 bridge 打印 `API deprecated` 警告并跳过，content 透传，不挂任何效果。其他 modifier 不受影响。
* **`threshold` 语义**：0.5 = view 至少有 50% 出现在 viewport 才算可见。0 = 任何一像素出现就触发；1 = 整个 view 必须完整可见。
* **回调频率**：滚动期间 SwiftUI 在主线程同步调用 callback，JSCore 也在主线程，所以是 in-line 推送，没有节流。一般 30 个 item / 视口 ≈ 5 个可见 id 的场景没问题；如果列表非常密集且滚动很快，注意 callback 内别做重活。
* **`scrollPosition` 与 `onScrollTargetVisibilityChange` 可同时使用**：前者拿 leading 一个 id，后者拿全部可见 id 集合，互不冲突。

---

### `scrollContentBackground`

指定滚动区域的默认背景是否显示。

#### 类型定义

```ts
scrollContentBackground?: Visibility
```

#### 可选值

* `"automatic"`：根据上下文自动决定是否显示背景。
* `"hidden"`：隐藏默认背景，可实现透明或自定义背景。
* `"visible"`：强制显示默认背景，即使已有自定义背景。

#### 示例

```tsx
<List scrollContentBackground="hidden">
  <Text>这里没有默认背景</Text>
</List>
```

---

## 滚动监听（iOS 18+）

以下三个监听同时支持 JSX 属性与 `modifiers()` 链式调用。iOS 17 会提示版本要求并忽略监听，内容仍可滚动。几何和阶段监听应直接挂在目标 `ScrollView`；挂到包含多个滚动容器的祖先上时，SwiftUI 只使用第一个，并可能报告运行时诊断。不要假定 `List`、嵌套容器与普通 `ScrollView` 在所有系统版本上行为一致。

### `onScrollGeometryChange`

监听**选定几何字段**变化，原生先比较该字段，再回调旧值和新值。`of` 必填；不接受任意 JS transform。

```tsx
<ScrollView onScrollGeometryChange={{
  of: "contentOffset.y",
  onChanged: (oldY, newY) => {
    // newY - oldY 是两次事件间的偏移变化，不是速度。
  },
}}>
  <LazyVStack>{/* 内容 */}</LazyVStack>
</ScrollView>
```

| `of` | 回调 oldValue / newValue 类型 |
| --- | --- |
| `"contentOffset.x"`、`"contentOffset.y"` | `number` |
| `"contentOffset"` | `Readonly<Point>`：`{ x, y }` |
| `"contentInsets"` | `{ top, leading, bottom, trailing }`（只读） |
| `"contentSize"`、`"containerSize"` | `Readonly<Size>`：`{ width, height }` |
| `"visibleRect"`、`"bounds"` | `Readonly<Rect>`：`{ x, y, width, height }` |
| `"geometry"` | `ScrollGeometry`：包含以上六个原生字段的只读快照 |

所有几何数值以 point 为单位；`contentOffset` 保留 inset 和回弹造成的负值或越界值，不进行归零或裁剪。`bounds` 与 `visibleRect` 的 inset 语义不同，均原样读取原生数据。监听 y 时，仅 x 或尺寸变化不会触发；监听 `geometry` 时任一字段变化都会触发。动态更改 `of` 开始新的观察，不把旧字段 payload 交给新字段 callback。

这不是固定帧率或每帧 API，不额外保证初始几何回调；内容/容器尺寸变化和程序化滚动也可能触发。无需 `scrollTargetLayout`。高频回调避免整页 `setState` 或逐次日志；可用 `useRef` 存采样值，在阶段转为 `idle` 时更新展示。回调中自行过滤不会减少进入 JS 的次数。

### `onScrollPhaseChange`

```ts
onScrollPhaseChange?: (
  oldPhase: ScrollPhase,
  newPhase: ScrollPhase,
  context: ScrollPhaseChangeContext
) => void

type ScrollPhase = "idle" | "tracking" | "interacting" | "decelerating" | "animating"
// context.geometry: ScrollGeometry，阶段变更时的六字段快照。
// context.velocity: Readonly<{ dx: number; dy: number }> | null。
```

`tracking` 表示潜在滚动的触摸跟踪；`interacting` 表示用户正在交互；`decelerating` 表示惯性减速；`animating` 表示程序化滚动动画；`idle` 表示无活跃滚动。不保证每次手势经历全部阶段，也不能将无动画定位当作一定会产生 `animating`。`phase !== "idle"` 对应原生 `isScrolling`，包含 tracking。

`context.geometry` 与阶段变更处于同一时刻；`velocity` 为原生速度向量，缺失时为 null，不补零，也不是两次几何事件的差值。只关心 old/new 的函数可忽略第三参数。

```tsx
<ScrollView onScrollPhaseChange={(_, next, context) => {
  if (next === "idle") console.log("停止位置", context.geometry.contentOffset.y)
}}>{/* 内容 */}</ScrollView>
```

### `onScrollVisibilityChange`

```ts
onScrollVisibilityChange?: {
  threshold?: number // 有限值 [0,1]，默认 0.5；非法输入报错，不自动裁剪。
  onChanged: (isVisible: boolean) => void
}
```

挂在需要观察的元素上。首次出现时已达到阈值也会回调，随后跨越阈值时回调；重新进入可能再次触发。它提供 Bool，不提供连续百分比、遮挡判断或一次性曝光保证，不等价于 `onAppear/onDisappear`。本封装首版阈值范围为 `[0,1]`，不接受负阈值预加载。

```tsx
<ScrollView>
  <LazyVStack>
    <Text onScrollVisibilityChange={{
      threshold: 0.5,
      onChanged: visible => console.log("元素可见", visible),
    }}>被观察的元素</Text>
  </LazyVStack>
</ScrollView>
```

观察单个元素不要求 target ID 或 `scrollTargetLayout`。订阅整组可见 ID 时继续使用现有 `onScrollTargetVisibilityChange` 和 `scrollTargetLayout`。

**实测边界：** 在 iPadOS 27.0.1 的 `LazyVStack` 中，快速程序化跳转将首行移出屏幕时，纯原生 SwiftUI 与 JS 桥接都可能只给出初始 `true`，没有对应 `false`；同场 `VStack` 会收到出屏事件。监听遵循原生行为，不合成回调。不要依赖惰性元素的出屏回调保证资源清理；可结合容器的可见目标 ID 集合管理播放/曝光状态，并在脚本或页面关闭时清理资源。

### 链式入口与公共类型

```tsx
import { modifiers, ScrollView, type ScrollGeometry, type ScrollPhase } from "scripting"

<ScrollView modifiers={modifiers()
  .onScrollGeometryChange({ of: "contentOffset.y", onChanged: (oldY, newY) => {} })
  .onScrollPhaseChange((oldPhase, newPhase, context) => {})
}>{/* 内容 */}</ScrollView>
// 元素可用 modifiers().onScrollVisibilityChange({ onChanged: visible => {} })。
```

导出类型：`ScrollGeometry`、`ScrollGeometryValues`、`ScrollGeometryChangeOptions`、`ScrollPhase`、`ScrollPhaseChangeContext`、`ScrollVisibilityChangeOptions`。`ScrollGeometryChangeOptions` 按 `of` 推断回调类型。上述 API 与 `scrollPosition` 的语义 ID 绑定、`ScrollViewReader.scrollTo` 的程序化定位不同，可以观察它们产生的滚动。

---

## 总结

| 修饰符 / 属性                  | 说明                                      |
| ------------------------- | --------------------------------------- |
| `axes`                    | 设置滚动方向（`vertical`、`horizontal` 或 `all`） |
| `scrollIndicator`         | 控制滚动指示器的显示及滚动方向                         |
| `scrollDisabled`          | 设置为 `true` 时禁用滚动行为                      |
| `scrollClipDisabled`      | 允许内容超出滚动区域边界可见                          |
| `scrollDismissesKeyboard` | 滚动时控制是否关闭软件键盘                           |
| `defaultScrollAnchor`     | 设置初始锚点或内容变化时的锚点                         |
| `scrollTargetLayout`      | 标记布局容器为滚动对齐的目标区域                        |
| `scrollTargetBehavior`    | 设置内容滚动对齐方式（分页、视图对齐等）                    |
| `scrollPosition`          | 把当前 leading 可见 item 的 id 双向绑定到 JS state |
| `onScrollTargetVisibilityChange` | iOS 18+，订阅当前可见 id 集合的变化           |
| `onScrollGeometryChange` | iOS 18+，监听选定字段的旧值与新值 |
| `onScrollPhaseChange` | iOS 18+，滚动阶段与同时刻几何/速度上下文 |
| `onScrollVisibilityChange` | iOS 18+，单元素跨可见阈值的 Bool 回调 |
| `scrollContentBackground` | 控制是否显示默认背景（透明、自定义背景场景常用）                |
