# AirPlayRoutePicker

用于主 App 脚本页面的原生输出选择按钮，从 `"scripting"` 导入。可独立于 AirPlay JS API 使用。

也可以在脚本页面直接放置按钮：

```tsx
import { AirPlayRoutePicker } from "scripting"

function OutputPicker() {
  return <AirPlayRoutePicker
    prioritizesVideoDevices
    tintColor="systemBlue"
    activeTintColor={{ light: "#0055CC", dark: "#99BBFF" }}
    accessibilityLabel="选择输出"
    onWillBeginPresentingRoutes={() => console.log("即将打开目的地菜单")}
    onDidEndPresentingRoutes={() => console.log("目的地菜单已关闭")}
  />
}
```

控件支持 `prioritizesVideoDevices?: boolean`、`tintColor?: Color | {light: Color, dark: Color}`、`activeTintColor?: Color | {light: Color, dark: Color}`、上述两个可选的 `() => void` 回调及常规视图修饰符。原生控件自带可访问性语义与选择状态，请使用简洁标签并保留足够的点击区域。菜单关闭不表示路由成功。控件不绑定特定播放器，没有 `player` 属性。不支持的宿主不会渲染该控件。用户通过系统 UI 选择输出；没有按设备 ID 静默连接、枚举所有接收器或启动屏幕镜像的 API。
