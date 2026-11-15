**Scripting** 是一款支持使用 TypeScript 和类 React 的 TSX 语法来创建 iOS 主屏幕小组件的应用。你可以在 `widget.tsx` 文件中使用受 SwiftUI 启发的组件定义小组件的界面。

---

## 1. 快速开始

### 第一步：创建脚本项目

1. 打开 **Scripting** 应用。
2. 创建一个新的脚本项目，并为你的小组件命名。

### 第二步：添加 `widget.tsx` 文件

1. 在项目中创建一个名为 `widget.tsx` 的文件。
2. 使用函数组件定义小组件的界面。
3. 从 `scripting` 包中导入所需组件和 API。

#### 示例：

```tsx
// widget.tsx
import { VStack, Text, Widget } from 'scripting'

function MyWidgetView() {
  return (
    <VStack>
      <Text>Hello world</Text>
    </VStack>
  )
}

Widget.present(<MyWidgetView />)
```

调用 `Widget.present()` 将该组件渲染为主屏幕小组件。

---

## 2. 获取小组件上下文

你可以通过 `Widget` API 提供的以下属性来适配布局和内容：

| 属性                   | 描述                                      |
| -------------------- | --------------------------------------- |
| `Widget.displaySize` | 小组件在运行时的宽高，单位为点（pt）。                         |
| `Widget.family`      | 小组件类型，如 `systemSmall`、`systemMedium` 或 `systemLarge`。 |
| `Widget.parameter`   | 用户在主屏幕小组件设置中配置的自定义参数。                   |

使用这些属性可以根据小组件的尺寸或用户偏好动态调整内容和布局。

iOS 27+ 中，`Widget.family` 还支持 `systemExtraLargePortrait`，用于竖向超大小组件布局。

---

## 3. 添加到主屏幕

1. 将 **Scripting** 小组件添加到 iOS 主屏幕。
2. 长按该小组件并点击 **编辑小组件**。
3. 选择你创建的脚本，并根据需要配置 **参数**。

配置完成后，`widget.tsx` 中定义的组件将直接显示在主屏幕上。

---

## 4. 视图构建方式

使用受 SwiftUI 启发的内置组件（如 `VStack`、`HStack`、`Text`、`Image` 等）构建小组件界面。你也可以将逻辑与视图分离到多个文件中进行组织，通过模块导入使用。

---

## 5. 开发限制与最佳实践

### 小组件中 Hooks 不生效

虽然可以在代码中使用 `useState`、`useEffect` 等 React Hooks，但在小组件中这些 **不会生效**，因为小组件是 **一次性渲染** 的，没有持续的交互生命周期。避免依赖任何动态状态逻辑。

### 内存限制

iOS 对小组件有约 **30MB** 的内存限制。为了不超出限制：

* 避免渲染过多嵌套视图。
* 减少图像资源使用。
* 避免内存泄漏或长时间引用的数据。

如果渲染失败或显示空白，通常是内存问题导致的。

### 小组件上下文立即销毁

调用 `Widget.present(...)` 后，当前执行上下文会被 **立即销毁**，因此：

* 所有数据准备应在调用前完成。
* 避免在 `Widget.present` 之后编写逻辑，因为这些代码不会执行。
* 将小组件函数视为一次性 UI 渲染器。

---

## 6. 交互支持

尽管小组件大多是静态的，但可以通过 AppIntent 实现 **基础交互功能**：

* 使用 `<Button>` 或 `<Toggle>` 等组件触发 AppIntent。
* 更多详情可参考 **Interactive Widget 和 LiveActivity** 文档。

---

## 7. 视图兼容性

**并非所有 SwiftUI 视图都支持在小组件中使用。** 某些布局容器与特效不被支持。请参考 Apple 官方文档：[WidgetKit 中支持的 SwiftUI 视图](https://developer.apple.com/documentation/widgetkit/swiftui-views)。

---

## 8. 小组件预览限制

Scripting 应用内的小组件预览仅是 **近似效果**，与 iOS 主屏幕上的实际渲染在以下方面可能略有差异：

* 文字对齐
* 小组件尺寸
* 小组件圆角
* 布局行为

要确保布局准确，请 **始终在主屏幕上测试小组件**。

---

## 9. 刷新小组件

### 通用刷新方法

* 调用 `Widget.reloadAll()` 可立即刷新所有小组件（包括用户和开发者小组件）。
* 可在 AppIntent 或 `index.tsx` 中调用。
* 也可以使用 Scripting 应用中的 **刷新小组件** 按钮快速测试开发时的变更。

这有助于快速迭代布局或逻辑。

### 新增：用户小组件与开发者小组件

Scripting 支持两种类型的小组件（kind）：

| 类型                       | 说明                         |
| ------------------------ | -------------------------- |
| **User Widgets（用户小组件）**  | 用于普通用户在主屏幕上添加和使用的正式小组件。    |
| **Test Widgets（开发者小组件）** | 用于开发者在开发阶段进行调试和预览的测试版本小组件。 |

这两类小组件使用不同的 `kind`，互不影响，便于在开发时安全地进行刷新与测试。

### 新增刷新方法

| 方法                           | 描述                                                   |
| ---------------------------- | ---------------------------------------------------- |
| `Widget.reloadUserWidgets()` | 仅刷新 **用户小组件（User Widgets）**，不影响开发者测试用的 Test Widgets。 |
| `Widget.reloadTestWidgets()` | 仅刷新 **开发者小组件（Test Widgets）**，不会影响用户主屏幕上的正式小组件。       |

这两个方法的设计目的是为了隔离开发和用户使用场景。当你在开发阶段修改 `widget.tsx` 并调用 `Widget.reloadTestWidgets()` 时，只会刷新测试用的小组件，而用户的正式小组件不会受到任何干扰。

#### 示例：

```tsx
// 在开发环境中刷新测试小组件
await Widget.reloadTestWidgets()

// 在发布前刷新所有用户小组件
await Widget.reloadUserWidgets()
```

#### 使用建议：

* 开发阶段：推荐使用 **`Widget.reloadTestWidgets()`**。
* 发布或用户脚本更新后：推荐使用 **`Widget.reloadUserWidgets()`** 或 **`Widget.reloadAll()`**。

---

## 10. 文档与支持

* 查看 **Views 文档** 获取所有可用组件和修饰器的完整列表。
* 参考 **API 文档** 获取更高级的功能集成（如 Calendar、FileManager、AVPlayer 等）。

---

## 11. 使用 `Widget.preview` 进行开发预览

开发过程中，你可以使用 `Widget.preview()` 方法在 `index.tsx` 中预览小组件的布局效果和参数配置，无需返回主屏幕进行测试。

### 方法：`Widget.preview(options)`

该方法可在应用内模拟不同参数和尺寸的小组件展示，适用于 **开发调试阶段**，可在 **Scripting 主 App** 中调用（`Script.env` 为 `"index"`、`"home_screen"` 或 `"camera_control"`，不能在 `widget.tsx` 或 `intent.tsx` 扩展环境中使用）。

### 参数说明

| 属性                   | 类型                                                   | 描述                               |
| -------------------- | ---------------------------------------------------- | -------------------------------- |
| `family` | `WidgetFamily` | 可选。预览的小组件尺寸，默认为 `'systemSmall'`。 |
| `parameters.options` | `Record<string, string>`                             | 参数选项的字典，键为参数名，值为可 JSON 解析的字符串内容。 |
| `parameters.default` | `string`                                             | 指定默认使用的参数名。                      |

### 示例

```tsx
const options = {
  "Param 1": JSON.stringify({
    color: "red"
  }),
  "Param 2": JSON.stringify({
    color: "blue"
  }),
}

await Widget.preview({
  family: "systemSmall",
  parameters: {
    options,
    default: "Param 1"
  }
})
console.log("Widget preview dismissed")
```

该方法可用于测试小组件在不同输入参数下的视觉表现，例如颜色、内容或配置状态等。

### 注意事项

* 该方法 **必须在 `index.tsx` 中调用**，适用于测试脚本或开发工具页面。
* 如果参数格式不正确，将会抛出错误。
* 预览效果仍受 [第 8 节 小组件预览限制](#8-小组件预览限制) 所述的限制影响，建议最终在主屏幕测试确认。

### 竖向超大小组件预览（iOS 27+）

在预览的 family 选择器中选择 `systemExtraLargePortrait`，或在 `index.tsx` 中传入该类型：

```tsx
import { Widget } from 'scripting'

async function main() {
  await Widget.preview({ family: 'systemExtraLargePortrait' })
}

void main()
```

应用内预览使用 **300 × 628 pt** 的模拟尺寸，对应现有 **628 × 300 pt** 超大横向预览的竖向布局。主屏幕小组件的实际尺寸依设备而异，请使用 `Widget.displaySize` 适配布局。

---

## 12. 在小组件按钮中运行系统快捷指令（iOS 27+）

iOS 27 及以上版本中，现有的 **User Widgets（用户小组件）**、**Test Widgets（测试小组件）**、**Transparent Background Widgets（透明背景小组件）** 和 **Blur Background Widgets（模糊背景小组件）** 均可通过按钮执行在小组件设置中选择的动作。每个小组件提供可编辑的 **Shortcuts（快捷指令）** 列表，可在系统配置界面添加、删除和排序，不再由 Scripting 限制为四个槽位。每个条目可选择自定义快捷指令、App Shortcut、系统动作或打开 App。

### 配置动作

1. 将现有的 Scripting 小组件添加到主屏幕，选择你的脚本。
2. 长按小组件，选择 **编辑小组件**。
3. 在 **Shortcuts（快捷指令）** 中使用 **Add New Item（添加新项目）** 选择动作，按需删除或调整顺序。
4. 在主屏幕点击按钮，执行对应条目中配置的动作。

脚本通过 `shortcutIndex` 引用条目的位置，索引从 `0` 开始：`0` 是第一个条目，`1` 是第二个。你可以自行定义每个按钮的标签、布局和样式：

```tsx
// widget.tsx
import { Button, HStack, Image, Text, VStack, Widget } from 'scripting'

Widget.present(
  <VStack spacing={12}>
    <Text>快捷操作</Text>
    <HStack spacing={12}>
      <Button title="回家" systemImage="house" shortcutIndex={0} />
      <Button shortcutIndex={1}>
        <VStack spacing={4}>
          <Image systemName="music.note" />
          <Text>音乐</Text>
        </VStack>
      </Button>
    </HStack>
  </VStack>
)
```

在 **编辑小组件** 中，将需要执行的动作添加为第一、第二个条目。排序或删除会改变后续条目的索引，请相应调整按钮标签或配置顺序。

`Widget.shortcutCount` 返回已配置条目的数量。例如，可以为每个条目生成一个按钮：

```tsx
Widget.present(
  <VStack>
    {Array.from({ length: Widget.shortcutCount }, (_, index) => (
      <Button title={`动作 ${index + 1}`} shortcutIndex={index} />
    ))}
  </VStack>
)
```

应用内预览及 iOS 27 之前的系统中，数量为 `0`。它不会暴露快捷指令的名称或值。

**3.2.2 Breaking Change：** 尚未发布的四槽位配置和 `shortcut="shortcut1"` API 已替换为列表及 `shortcutIndex={0}`。使用旧配置的测试小组件需要重新配置动作。

### 按钮约定与限制

- `shortcutIndex` 必须是配置列表范围内的非负安全整数。它表示位置，不是快捷指令名称或 ID；可添加的数量取决于系统配置界面。
- 同一个按钮的 `shortcutIndex`、`intent`、`action` 三选一，不能同时设置。
- 多个按钮可以引用同一个索引。其他按钮仍可使用脚本 AppIntent，**When Interacting（交互时）** 仍控制按钮以外区域的点击行为。
- 系统将所选动作保存在小组件配置中。脚本不能读取或构造其 `SystemShortcut` 值，也无需为它注册 AppIntent。
- 索引超出范围或当前环境不支持时，Scripting 保留标签并输出诊断信息，不会执行快捷指令或脚本回调。
- 快捷指令按钮仅支持 iOS 27+ 中可承载按钮的小组件类型，不支持 `accessoryInline`、应用内视图、Live Activity 或 Control Widget。
- 应用内预览可以检查布局，但不能配置或执行这些动作，请在主屏幕测试。需要交互的动作可能打开「快捷指令」应用。
