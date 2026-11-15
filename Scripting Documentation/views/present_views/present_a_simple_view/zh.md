本示例展示了如何使用 `Navigation.present` 在 Scripting 中展示一个基本的 UI 页面，同时演示了如何使用 `NavigationStack` 和 `navigationTitle` 设置导航标题。

---

## 示例功能

你将学习如何：

* 使用 `Navigation.present` 展示一个自定义页面
* 使用 `NavigationStack` 和 `VStack` 构建页面结构
* 设置导航栏标题（`navigationTitle`）

---

## 示例代码

```tsx
import { Navigation, NavigationStack, Script, Text, VStack } from "scripting"

function View() {

  return <NavigationStack>
    <VStack
      navigationTitle={"Present a simple view"}
    >
      <Text>Hello Scripting!</Text>
    </VStack>
  </NavigationStack>
}

async function run() {
  await Navigation.present({
    element: <View />
  })

  Script.exit()
}

run()
```

---

## 关键组件说明

### `Navigation.present(options)`

该方法以模态方式展示 UI 视图，默认样式为系统 sheet（`pageSheet`），可用 `modalPresentationStyle` 选择其他样式。它接收一个 `element` 参数，该参数是要展示的根组件。

```ts
await Navigation.present({
  element: <View />
})
```

### `NavigationStack`

导航堆栈容器组件，支持页面标题、导航栏按钮等功能。它必须作为页面结构的最外层容器使用，以启用导航行为。

### `VStack`

垂直方向布局容器，用于将子视图从上到下堆叠排列。在本例中，它包含一个 `Text` 组件。

### `navigationTitle`

在 `VStack` 上设置该属性可以设置页面的导航栏标题。

---

## 页面效果

该示例会展示一个标题为 **“Present a simple view”** 的页面，并在中央显示文本 **“Hello Scripting!”**。

---

## 注意事项

* 如果你的页面需要导航栏、标题、返回按钮等功能，请务必使用 `NavigationStack` 包裹视图。
* `Navigation.present` 弹出页面后，需在其完成后调用 `Script.exit()` 来确保资源正确释放，避免内存泄漏。


## 全屏边缘返回手势

`Navigation.present` 的对象参数支持 `swipeBackBehavior`：

```ts
swipeBackBehavior?: "disabled" | "dismiss" | "minimize"
```

从**左边缘向右拖动**，页面会跟随手指移动。拖动足够距离或以足够的向右速度松手后执行操作，否则页面回到原位。取消手势不会关闭或最小化页面，不会完成 Promise，也不会触发最小化事件。

| 值 | 完成手势后的行为 |
| --- | --- |
| `"disabled"`（默认） | 不启用模态页面的边缘返回手势，旧脚本保持原有行为。 |
| `"dismiss"` | 关闭本次呈现的页面。`present()` 返回 `undefined`，等价于调用本页不带返回值的 `Navigation.useDismiss()()`。该操作本身不会结束脚本。 |
| `"minimize"` | 隐藏整个脚本，保留页面和运行状态。`present()` 继续等待。最小化完成后触发一次 `Script.onMinimize`；恢复时复用原页面并触发 `Script.onResume`。 |

### 生效范围与导航

- 仅支持 `modalPresentationStyle: "fullScreen"` 或 `"overFullScreen"`。其他样式忽略此选项并保留系统交互。默认呈现样式为 `pageSheet`，因此需要显式指定支持的全屏样式。
- 可见的 `NavigationStack` 中还有已进入的子页面时，优先执行栈内返回；回到导航根层后才能执行模态页面的操作。如果上方还有另一个模态页面，需要先关闭它。
- 页面上的 `interactiveDismissDisabled={true}` 会禁止此手势及对应的 VoiceOver 退出操作。改回 `false` 后恢复可用。程序化关闭仍然可用。
- `"minimize"` 仅适用于脚本第一个呈现的页面，且要求 `Script.supportsMinimization()` 返回 `true`。嵌套的 `Navigation.present` 页面，以及独立脚本窗口等不支持最小化的环境，会**禁用**最小化手势，绝不会自动改成关闭页面。此选项不控制窗口关闭。
- `Script.enableMinimize()` 继续控制系统 sheet 的下拉行为。此全屏选项与其独立：`"minimize"` 无需调用 `enableMinimize()`；即使启用了该设置，`"dismiss"` 仍然关闭页面。
- 无论此选项如何配置，`Navigation.useDismiss()(result)` 仍会关闭页面并返回指定结果，`Script.exit()` 仍会结束脚本。页面已最小化时，也可以通过程序化调用 `useDismiss` 关闭。

### 示例：关闭页面

```tsx
import { Button, Navigation, NavigationStack, Script, VStack } from "scripting"

function Page() {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack navigationTitle="全屏页面">
      <Button title="关闭" action={() => dismiss()} />
    </VStack>
  </NavigationStack>
}

async function run() {
  await Navigation.present({
    element: <Page />,
    modalPresentationStyle: "fullScreen",
    swipeBackBehavior: "dismiss",
  })
  Script.exit()
}
run()
```

### 示例：最小化脚本

```tsx
import { Button, Navigation, NavigationStack, Script, VStack } from "scripting"

function Page() {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack navigationTitle="可恢复的脚本">
      {Script.supportsMinimization() && <Button title="最小化" action={async () => { await Script.minimize() }} />}
      <Button title="关闭" action={() => dismiss()} />
    </VStack>
  </NavigationStack>
}

async function run() {
  const canMinimize = Script.supportsMinimization()
  await Navigation.present({
    element: <Page />,
    modalPresentationStyle: "overFullScreen",
    swipeBackBehavior: canMinimize ? "minimize" : "disabled",
  })
  // 最小化时不会执行到这里，关闭页面后才会继续。
  Script.exit()
}
run()
```

在页面根层，VoiceOver 的双指擦除（退出）手势会在可用时执行配置的操作。请保留标签明确的关闭按钮，并在支持时提供最小化按钮，让用户无需边缘手势也能完成这些操作。转场遵循“减弱动态效果”设置。
