`toolbar` 属性用于为导航栏、底部工具栏或键盘附加区域添加自定义操作项。该机制参考了 SwiftUI 中的工具栏 API，允许开发者以声明式方式将按钮、控制组等元素精确地放置在界面的特定位置。

这套系统适用于提供主操作、上下文操作或增强文本输入时的交互体验。

---

## 定义

```ts
toolbar?: ToolBarProps
```

### ToolBarProps 类型定义

```ts
type ToolBarProps = {
  bottomBar?: VirtualNode | VirtualNode[]
  cancellationAction?: VirtualNode | VirtualNode[]
  confirmationAction?: VirtualNode | VirtualNode[]
  destructiveAction?: VirtualNode | VirtualNode[]
  keyboard?: VirtualNode | VirtualNode[]
  navigation?: VirtualNode | VirtualNode[]
  primaryAction?: VirtualNode | VirtualNode[]
  principal?: VirtualNode | VirtualNode[]
  topBarLeading?: VirtualNode | VirtualNode[]
  topBarTrailing?: VirtualNode | VirtualNode[]
}
```

---

## 放置位置说明

`ToolBarProps` 的每个字段都对应一个界面区域，可传入单个或多个 `VirtualNode` 元素进行展示。

* **`automatic`**（隐式）：由系统自动判断最佳放置位置（未在类型中显式声明）。
* **`bottomBar`**：放置于底部工具栏。
* **`cancellationAction`**：表示“取消”操作，通常用于模态界面中。
* **`confirmationAction`**：表示“确认”操作，通常用于模态界面中。
* **`destructiveAction`**：表示破坏性操作，系统可能使用红色等强调样式。
* **`keyboard`**：当键盘弹出时显示在键盘附加区域。
* **`navigation`**：用于导航行为（如返回或关闭）。
* **`primaryAction`**：表示当前上下文中的主要操作。
* **`principal`**：放置在导航栏中间区域。
* **`topBarLeading`**：放置于导航栏的前导位置（通常是左侧）。
* **`topBarTrailing`**：放置于导航栏的尾部位置（通常是右侧）。

---

## 示例

```tsx
<VStack
  navigationTitle={"Toolbars"}
  navigationBarTitleDisplayMode={"inline"}
  toolbar={{
    topBarTrailing: [
      <Button
        title={"选择"}
        action={() => {}}
      />,
      <ControlGroup
        label={
          <Button
            title={"添加"}
            systemImage={"plus"}
            action={() => {}}
          />
        }
        controlGroupStyle={"palette"}
      >
        <Button
          title={"新建"}
          systemImage={"plus"}
          action={() => {}}
        />
        <Button
          title={"导入"}
          systemImage={"square.and.arrow.down"}
          action={() => {}}
        />
      </ControlGroup>
    ],
    bottomBar: [
      <Button
        title={"新建子分类"}
        action={() => {}}
      />,
      <Button
        title={"添加分类"}
        action={() => {}}
      />
    ],
    keyboard: <HStack padding>
      <Spacer />
      <Button
        title={"完成"}
        action={() => {
          Keyboard.hide()
        }}
      />
    </HStack>
  }}
>
  <TextField
    title={"文本输入框"}
    value={text}
    onChanged={setText}
    textFieldStyle={"roundedBorder"}
    prompt={"点击输入框以显示键盘工具栏"}
  />
</VStack>
```

此示例展示了：

* 在顶部导航栏右侧添加了一个“选择”按钮和一个带“新建”“导入”按钮的控制组。
* 在底部工具栏添加了两个分类相关操作按钮。
* 在键盘区域右侧添加了一个“完成”按钮，可点击关闭键盘。

---

## 注意事项

* 所有工具栏项支持响应状态变化，UI 会自动刷新。
* `keyboard` 区域的内容仅在输入框聚焦、键盘弹出时显示。
* 推荐使用 `ControlGroup` 来组织功能相关的按钮，提升可读性和操作一致性。

---

## iOS 27 新增 API

以下选项要求 iOS 27.0+；除注明降级行为外，在旧系统上忽略。

### 工具栏项目

`ToolbarItem`、`ToolbarItemGroup`、`DefaultToolbarItem` 和 `ToolbarSpacer` 新增：

* `visibilityPriority`：`"automatic"`、`"low"` 或 `"high"`。空间不足时，优先保留较高优先级的项目。
* `contentMarginsRemoved`：是否移除项目内容的内边距，默认 `false`；与 `sharedBackgroundVisibility` 分别控制。

`placement="topBarPinnedTrailing"` 将项目固定在顶部工具栏的后置边缘。旧系统降级为 `topBarTrailing`。

```tsx
<ToolbarItem placement="topBarPinnedTrailing" visibilityPriority="high" contentMarginsRemoved>
  <Button title="完成" action={dismiss} />
</ToolbarItem>
```

### 工具栏视图修饰符

* `toolbarOverflowMenu`：溢出菜单的内容视图，例如包含多个按钮的 `Group`。
* `toolbarMinimizationBehavior`：`"automatic"`、`"never"`、`"onScrollDown"`、`"onScrollUp"`，或 `{ behavior, bars? }`。
* `toolbarMinimizationRestoration`：`"automatic"`、`"atScrollEdge"`，或 `{ restoration, bars? }`。目前 `atScrollEdge` 仅对使用 `onScrollDown` 的 `navigationBar` 生效。
* `toolbarMinimizationSafeAreaAdjustment`：`"automatic"`、`"enabled"`、`"disabled"`，或 `{ adjustment, bars? }`。
* `toolbarVisibility`：`Visibility` 值或 `{ visibility, bars? }`。此修饰符本身支持 iOS 18.0+；`bars: ["statusBar"]` 要求 iOS 27.0+。

`bars` 支持 `"automatic"`、`"navigationBar"`、`"bottomBar"`、`"tabBar"`、`"statusBar"`；省略时使用系统自动选择的位置。iOS 27 上 `toolbarColorScheme` 的 `bars` 也可指定 `statusBar`。这些修饰符控制由 SwiftUI 管理的栏。

```tsx
<ScrollView
  toolbarMinimizationBehavior={{ behavior: "onScrollDown", bars: ["navigationBar"] }}
  toolbarMinimizationRestoration={{ restoration: "atScrollEdge", bars: ["navigationBar"] }}
  toolbarVisibility={{ visibility: "hidden", bars: ["statusBar"] }}
  toolbarOverflowMenu={<Group><Button title="归档" action={archive} /></Group>}
>
  {/* 内容 */}
</ScrollView>
```

工具栏视图修饰符也支持 `modifiers().toolbarOverflowMenu(...)`、`modifiers().toolbarVisibility(...)` 及对应的最小化链式方法。项目选项应设置在工具栏项目本身。

---

## 竖向工具栏（iOS 27.1+）

- `toolbarVerticalBehavior?: "automatic" | "disabled"`：允许系统选择工具栏方向，或禁用竖向栏并使用顶部／底部横向栏。它不会隐藏工具栏。应作为稳定的布局选择，避免随页面状态频繁切换；隐藏栏仍使用 toolbarVisibility。
- `toolbarVerticalCompressionBehavior?: "automatic" | "prefersTabBar" | "prefersToolbarItems"`：竖向空间不足时，优先保留标签栏或工具栏项目。
- `axisBehavior?: "automatic" | "horizontalOnly" | "verticalPreferred"`：设置在 ToolbarItem、ToolbarItemGroup、DefaultToolbarItem、ToolbarSpacer 上，控制可使用竖向栏时项目的位置偏好，不是通用视图修饰符。

两个视图修饰符均支持链式调用。旧系统忽略这些选项；这些是布局偏好，不会在所有设备上强制显示竖向栏。EnvironmentValuesReader 可读取 `toolbarVerticalEdge`，值为 leading／trailing，无竖向栏时为 null。布局变化时应保留工具栏操作的明确标签。

```tsx
<NavigationStack toolbarVerticalBehavior="automatic" toolbarVerticalCompressionBehavior="prefersToolbarItems">
  <Text toolbar={<Toolbar>
    <ToolbarItem placement="topBarTrailing" axisBehavior="verticalPreferred">
      <Button title="Compose" action={compose} />
    </ToolbarItem>
  </Toolbar>}>Content</Text>
</NavigationStack>
```
