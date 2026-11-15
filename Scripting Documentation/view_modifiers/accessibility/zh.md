# 无障碍(Accessibility)修饰器

一组把视图信息传达给 VoiceOver 等辅助功能的 modifier,对应 SwiftUI 的无障碍修饰符。

## Modifier 列表

### `accessibilityLabel?: string`
标识视图的简短标签(如播放按钮用 `"Play"`)。

### `accessibilityHint?: string`
描述执行视图动作后会发生什么(如 `"Plays the current track"`)。

### `accessibilityValue?: string`
视图当前值的文字描述(如滑块的 `"70%"`)。

### `accessibilityHidden?: boolean`
为 `true` 时对辅助功能隐藏该视图。

### `accessibilityIdentifier?: string`
用于 UI 测试的稳定标识符。VoiceOver 不会朗读。

### `accessibilitySortPriority?: number`
该元素相对同级的朗读顺序。数值越大越先朗读。

### `accessibilityAddTraits?: AccessibilityTrait | AccessibilityTrait[]`
为元素添加一个或多个描述其行为的 trait。取值可为:
`isButton`、`isHeader`、`isSelected`、`isLink`、`isSearchField`、`isImage`、`playsSound`、`isKeyboardKey`、`isStaticText`、`isSummaryElement`、`updatesFrequently`、`startsMediaSession`、`allowsDirectInteraction`、`causesPageTurn`、`isModal`、`isToggle`(iOS 17+)。

### `accessibilityRemoveTraits?: AccessibilityTrait | AccessibilityTrait[]`
从元素移除给定 trait。

### `accessibilityHeading?: AccessibilityHeadingLevel`
把视图标记为某级标题:`unspecified`、`h1`、`h2`、`h3`、`h4`、`h5`、`h6`。

### `accessibilityElement?: boolean | AccessibilityChildBehavior`
把视图合并为单个无障碍元素,并控制子元素如何暴露:
`ignore`(默认)、`contain`、`combine`。传 `true` 等价 `ignore`。

## 示例

```tsx
<Image
  systemName="play.fill"
  accessibilityLabel="Play"
  accessibilityHint="Plays the current track"
  accessibilityAddTraits="isButton"
/>

<HStack accessibilityElement="combine">
  <Text>Battery</Text>
  <Text>70%</Text>
</HStack>

<Text accessibilityHeading="h1">Chapter One</Text>
```

## 默认激活与命名操作

这些接口需要包含本次更新的 Scripting 版本；Scripting 3.3.0（27）及更早版本不支持。适用于有存活脚本上下文的前台界面，包括 Home UI。静态 Widget 和 Intent 快照、后台执行及单个图表 mark 不属于这些接口的交互回调场景。

### `accessibilityAction?: () => void`
处理默认无障碍激活，例如旁白双击。提供后会替代视图原有的默认无障碍激活；通常应调用与触摸控件相同的操作。只添加 `isButton` 不会自动安装操作。

### `accessibilityActions?: AccessibilityAction[]`
提供旁白用户可选择的命名操作，每项为 `{ name: string; action: () => void }`。`name` 是脚本提供并负责本地化的可见名称。名称首尾空白会被移除；空名称、重复名称和非函数回调会被忽略，并输出 console 警告。同名操作保留第一个有效项，其余有效项保持数组顺序。空数组移除此 modifier 提供的命名操作。

两者均支持 JSX 属性与 `modifiers()` 链式调用。回调返回值不决定原生操作是否成功；异步完成后可更新脚本状态，同步异常与 Promise 拒绝会记录到脚本控制台。不要保存或直接调用桥接事件 ID：组件重新构建或卸载后，旧构建的回调会失效。

### 分组与触摸操作

只有父元素提供了必要标签、状态和全部等价操作时，才使用 `ignore`。描述性内容可以用 `combine` 合并，独立子控件用 `contain` 保持可访问。命名操作不会自动让装饰性视图成为可聚焦控件，需要选择合适元素与角色；触摸用户也应能执行相同操作。

下面是完整可运行的脚本：计数器提供默认激活与额外命名操作，重置控件演示链式写法。

```tsx
import { HStack, Navigation, Script, Text, VStack, modifiers, useState } from "scripting"

async function main() {
  function Counter() {
    const [count, setCount] = useState(0)
    const increment = () => setCount(value => value + 1)
    const reset = () => setCount(0)

    return <VStack spacing={20}>
      <HStack
        onTapGesture={increment}
        accessibilityElement="ignore"
        accessibilityLabel="计数器"
        accessibilityValue={String(count)}
        accessibilityHint="增加一"
        accessibilityAddTraits="isButton"
        accessibilityAction={increment}
        accessibilityActions={[
          { name: "增加一", action: increment },
          { name: "重置", action: reset }
        ]}
      >
        <Text>计数器</Text>
        <Text>{String(count)}</Text>
      </HStack>
      <Text modifiers={modifiers()
        .onTapGesture(reset)
        .accessibilityElement(true)
        .accessibilityLabel("重置计数器")
        .accessibilityAddTraits("isButton")
        .accessibilityAction(reset)
        .accessibilityActions([{ name: "增加一", action: increment }])
      }>重置计数器</Text>
    </VStack>
  }

  await Navigation.present(<Counter />)
  Script.exit()
}

void main()
```

## 自定义导航转子

转子是旁白的导航分类，例如“收藏”或“错误”。用户通过旁白转子手势选择分类，再上下轻扫，在目标元素之间导航。命名操作用于执行当前元素的功能，导航转子用于寻找另一个元素。这些接口需要包含本次更新的 Scripting 构建和前台运行的脚本界面；Scripting 3.3.0 (27) 及更早版本未实现。静态 Widget/Intent 快照及后台脚本不支持交互导航。

### `accessibilityRotor?: AccessibilityRotor`

在容器上提供自定义分类：

```ts
interface AccessibilityRotor {
  label: string
  namespace: NamespaceID
  entries: AccessibilityRotorEntry[]
}
interface AccessibilityRotorEntry {
  id: string
  label: string
  prepare?: () => void
}
```

通过 `NamespaceReader` 获取 `namespace`。导航顺序遵循 entries 数组顺序。label 是脚本负责本地化的用户可见文字，会去掉首尾空白。id 必须是非空、稳定的字符串，原值会完整保留：`"a"` 与 `" a "` 对应不同目标。空标签、纯空白 ID、格式错误的条目及非函数 prepare 会被忽略，并输出控制台警告。同 ID 的重复条目保留第一个有效项。空数组会移除此修饰符提供的分类。

### `accessibilityRotorEntry?: AccessibilityRotorTarget`

用 `{ id: string; namespace: NamespaceID }` 标记目标。id 和 namespace 必须与分类条目匹配，复用 reader 提供的同一 namespace 实例；不同 namespace 中的相同 ID 互相隔离。此标记保持原有视图身份，不会自动把视图变成可访问元素。应标记实际可聚焦的元素；父视图的 `accessibilityElement="ignore"` 可能隐藏子目标。同一个 namespace 中不要重复标记相同目标 ID。

### 准备回调、动态更新与多个分类

可选的 `prepare` 在原生导航前同步执行，可用来展开或滚动到目标，不会激活目标本身。返回值会被忽略，不等待 Promise，错误会输出到脚本控制台。不要依赖异步加载，也不要假设尚未创建的目标一定可达。懒加载滚动列表应通过 `ScrollViewReader.scrollTo` 滚动，并为目标行设置匹配的 `key`。prepare 执行成功不代表旁白已经完成焦点移动。

数据变化时同步更新条目与目标视图：排序时保持 ID 不变，删除时移除对应条目，更名时更新 label。旧构建或已卸载组件的回调会失效，不要保存桥接事件 ID。本版不提供文本范围导航或系统转子分类替换。

JSX 的单个属性提供一个分类。同一容器需要多个分类时，使用多次 fluent 调用，分别传入标签与条目：

```ts
// favorites 和 errors 是使用 reader 的 namespace 的 AccessibilityRotor 对象。
modifiers().accessibilityRotor(favorites).accessibilityRotor(errors)
```

以下完整脚本演示懒加载滚动、排序和删除。开启旁白并进入列表，在转子中选择“收藏”，然后上下轻扫导航；也请在使用两个按钮后，检查真机焦点与朗读结果。

```tsx
import { Button, LazyVStack, NamespaceReader, Navigation, Script, ScrollView, ScrollViewReader, Text, VStack, useState } from "scripting"

async function main() {
  function ReadingList() {
    const [rows, setRows] = useState(() => Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`, title: `文章 ${i + 1}`, favorite: i % 10 === 0
    })))

    return <NamespaceReader>{namespace =>
      <ScrollViewReader>{proxy =>
        <VStack>
          <Button title="反转顺序" action={() => setRows(items => [...items].reverse())} />
          <Button title="删除首个收藏" action={() => setRows(items => {
            const first = items.find(item => item.favorite)
            return items.filter(item => item.id !== first?.id)
          })} />
          <ScrollView accessibilityRotor={{
            label: "收藏", namespace,
            entries: rows.filter(row => row.favorite).map(row => ({
              id: row.id, label: row.title,
              prepare: () => proxy.scrollTo(row.id, "center")
            }))
          }}>
            <LazyVStack>{rows.map(row =>
              <Text key={row.id}
                accessibilityElement={true}
                accessibilityLabel={row.title}
                accessibilityRotorEntry={{ id: row.id, namespace }}
              >{row.title}</Text>
            )}</LazyVStack>
          </ScrollView>
        </VStack>
      }</ScrollViewReader>
    }</NamespaceReader>
  }

  await Navigation.present(<ReadingList />)
  Script.exit()
}

void main()
```
