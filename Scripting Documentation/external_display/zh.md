# 外屏展示

在连接的显示器上独立展示图片，控制仍留在本机。请在控制中心连接 AirPlay **屏幕镜像**，或连接实体显示器；此 API 不选择或连接接收端。媒体输出选择与屏幕镜像是两种不同的系统操作。

`ExternalDisplay.createPresentation(): Promise<ExternalDisplayPresentation>` 要求前台主 App 脚本具有自己的可见页面。请从按钮或页面出现后调用。它登记展示意图，即使尚无外屏也可完成。整个 App 同时只允许一个图片句柄或 `ExternalDisplayContent` 占用外屏；竞争请求会被拒绝，不覆盖其他脚本。

```tsx
import { Button, Navigation, Text, VStack } from "scripting"
let display: ExternalDisplayPresentation | null = null
try {
  await Navigation.present({ element: <VStack>
    <Text>请通过控制中心连接外屏。</Text>
    <Button title="展示图片" action={async () => {
      display ??= await ExternalDisplay.createPresentation()
      display.onStateChanged = state => console.log(state)
      const image = UIImage.fromFile("/absolute/path/to/image.png")
      if (image) await display.setImage(image, { contentMode: "fit" })
    }}/>
  </VStack> })
} finally { display?.dispose() }
```

句柄提供：

- `state`：`waiting`、`presenting`、`suspended` 或终态 `disposed`。`waiting` 表示可见宿主已提供内容，但没有处于前台状态的外屏场景；`suspended` 包括宿主隐藏/最小化、输出禁用或 App 非活动。非交互场景可在前台可见而不接收输入事件。`presenting` 反映系统场景生命周期，接收端是否实际显示仍需单独确认。
- `displayInfo`：实际外屏场景的 `{width, height, scale}`，断开时为 `null`，宽高单位为点。状态或布局变化后重新读取；不会推断设备身份、物理尺寸或传输方式。
- `onStateChanged`：回调或 `null`，只通知变化。先订阅再读取 `state` 获取初始值。断开后若宿主仍可见则返回 waiting；隐藏宿主恢复后，由系统重新提供场景。
- `setImage(image, options?): Promise<void>`：替换保留的图片。`contentMode` 为默认 `"fit"` 或 `"fill"`；`backgroundColor` 默认黑色，接受支持的颜色字符串。仅接受不超过 4096×4096 像素的单帧 UIImage。非法输入以 TypeError 拒绝，动画和超限图片也会拒绝。仅保留一张图片，不下载或排队。完成表示原生已接收内容，不代表接收端已经显示。
- `clear(): Promise<void>`：释放图片并显示黑色，保留外屏所有权。
- `dispose(): void`：幂等释放内容、窗口、登记和回调；再次展示需新建句柄。脚本退出也会释放。访问权限丢失后仍能执行清理。

访问拒绝会使 Promise 拒绝或同步操作抛出 `name: "NotAllowedError"`、`code: "ERR_PRO_REQUIRED"`。无页面脚本、扩展、小组件、远程渲染及后台 JS 线程不支持。此 API 不修改音频会话或 AVPlayer 设置。

iOS 27+ 在所属页面登记 scene accessory，之前支持的系统使用外部非交互场景。系统决定何时、在哪个连接的显示器上展示。没有启动/停止镜像、枚举接收端或强制目标显示器的接口。释放句柄不会断开用户的 AirPlay 会话。

状态驱动布局请使用 [ExternalDisplayContent](../views/external_display_content/zh.md)。本机应保留等价、可读的状态与全部操作，外屏内容不可交互。媒体路由见 [AirPlay](../airplay/zh.md)。

## 运行完整示例

打开文档的示例入口，或将[完整 index.tsx](index.tsx)作为脚本入口，在主 App 中运行。无需图片文件或下载：示例通过 `ImageRenderer` 生成 960 × 540、scale 为 1 的图片。图片与 JSX 展示共享所有权，请一次只运行一个外屏示例。

1. 点 **Show image**，在控制中心连接**屏幕镜像**，随后关闭控制中心并返回示例。接收端应显示 EXTERNAL IMAGE 和 COUNT 0，本机仍保留按钮及可读状态。
2. 点 **Increment and update image**，将同一个本机计数渲染为新图片。**Clear image** 清空为黑色但保留句柄；**Release presentation** 释放所有权；**Close demo** 关闭并清理句柄，即使句柄在页面关闭后才创建完成也会释放。
3. 停止屏幕镜像，关闭系统面板并保持示例页面打开。可见宿主回到 `waiting`，同一个句柄与最后图片仍保留。断开时继续递增，再通过控制中心重连并回到页面，接收端应显示最新图片和计数；示例不会因 waiting 事件创建第二个句柄。

控制中心或其他系统面板遮盖 App 时可能进入 `suspended`，这不等于断开。请回到可见页面后再检查 `waiting` 或 `presenting`。示例在本机显示原生场景状态、尺寸和错误，接收端的真实画面仍需单独核对。
