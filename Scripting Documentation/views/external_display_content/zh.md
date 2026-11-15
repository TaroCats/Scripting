# ExternalDisplayContent

主 App 组件，将一个 JSX 子树仅挂载到连接的外屏，在本机不占可见空间，也不会调用 `ExternalDisplay.createPresentation()`。子树共享当前脚本上下文和状态。请通过系统先连接屏幕镜像或实体显示器，参见 [外屏展示](../../external_display/zh.md)。

```tsx
import { Button, ExternalDisplayContent, Navigation, Text, VStack, useState } from "scripting"
function Page() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState("waiting")
  return <VStack>
    <Text>{`输出：${status}；计数：${count}`}</Text>
    <Button title="下一项" action={() => setCount(value => value + 1)} />
    <ExternalDisplayContent onStateChanged={setStatus} onError={console.error}>
      <VStack><Text font="largeTitle">{`计数：${count}`}</Text></VStack>
    </ExternalDisplayContent>
  </VStack>
}
await Navigation.present({ element: <Page/> })
```

属性：`children` 是一个根节点（多个视图请放入 VStack/ZStack）；`enabled?: boolean` 默认 true；`onStateChanged?: (state) => void` 通知 waiting/presenting/suspended/disposed；`onError?: (message) => void` 报告所有权冲突。设 enabled=false 会暂停但保留占用，卸载才释放。已有图片句柄或组件时，竞争请求失败而不覆盖；发生冲突后请等待空闲再卸载重挂。

请使用展示型内容。外屏禁用交互，按钮、键盘输入、导航、媒体输出选择器、弹窗及等价的无障碍反馈应留在本机。视觉修饰器放到子树根节点，挂载组件本身没有本地视觉表面。不要在外屏内容中再嵌套 ExternalDisplayContent。Hooks 属于现有子树，effects 按其正常生命周期执行，不会再运行一份脚本；外屏断开不会自动卸载脚本子树。状态回调表示原生场景，不代表已验证接收端像素。真实 VoiceOver 任务完成仍需设备测试。

## 运行完整示例

打开文档的示例入口，或将[完整 index.tsx](index.tsx)作为主 App 脚本运行。示例无需素材，也不调用图片展示句柄。请与图片示例分开运行：同一时刻只能有一个外屏展示所有者。

1. 在控制中心连接**屏幕镜像**，关闭控制中心并返回示例。接收端应显示 EXTERNAL JSX 与 COUNT 0；本机保留全部按钮、相同计数和配色，以及可读状态和错误。
2. 使用 **Increment shared count**、**Reset shared count** 和 **Change shared color** 更新同一个外屏子树。暂停/恢复只修改 `enabled` 并保留所有权；释放/挂载会卸载/重挂宿主，而父页面中的共享计数和配色仍保留。遇到其他所有者占用报错时，请等其停止后释放并重新挂载。
3. 递增计数，断开屏幕镜像，关闭系统面板，再在断开时继续递增。保持子树挂载，重新连接并返回示例后，外屏应显示最新计数和配色。`onStateChanged` 只更新状态，不会在 `waiting` 时清空共享状态或重新抢占所有权。
4. **Close demo** 先关闭页面，由原生卸载释放外屏，再退出脚本；不会停止用户的系统屏幕镜像连接。

只有宿主页面真正可见时才检查 `waiting`。`suspended` 可能表示暂停输出或控制中心遮盖 App，不一定是接收端断开。原生场景状态不等于送达回执，请单独核对接收端画面。
