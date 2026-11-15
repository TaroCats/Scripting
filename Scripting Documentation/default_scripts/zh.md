# 默认脚本

通过 **更多 → 默认脚本** 统一选择主 App 的两种脚本入口。

- **Home Screen（首页）**：选择包含 `home_screen_default_ui.tsx` 的脚本，该文件默认导出一个 JSX 函数组件，环境为 `Script.env === "home_screen"`。在设置中打开“显示 Home 标签页”。长按 Home 标签仍保留选择、重新加载和清除操作。
- **相机控制**：选择包含 `index.tsx` 的 TypeScript 脚本，在主 App 中以 `Script.env === "camera_control"` 运行，自行绘制相机页面或处理原生拍摄扩展交付的照片/视频。没有相机键也可点“打开相机脚本”测试。

选择默认脚本不会替用户修改 iPhone 的系统相机控制目标，仍需在系统相机设置中选择 Scripting。“刷新相机设置”会检查当前访问状态、将所选脚本更新给锁屏拍摄入口，并接收已完成的锁屏拍摄文件。按钮会显示进度和结束提示，错误单独显示；更新已安装的 DEMO 请参考最新示例代码。切换脚本存储位置或恢复已删除脚本后，如显示不可用，请重新选择。

用于系统相机目标的脚本应提供真实拍摄体验。系统相机入口约 3 秒内仍未具备运行中的相机和可用拍摄交互时，Scripting 会尝试打开内置相机；拍摄文件交给原脚本，无法接收时保留在“拍摄文件”中。共享会话无法安全释放或权限被拒绝时，可能无法接管。“打开相机脚本”不验证这些系统检查。同一环境也用于文件交接，仅接收文件不要求启动相机。请阅读[系统拍摄入口要求](../camera_control/)。

在 iOS 26+ 上，系统相机入口会优先使用已有的主 App 窗口，相机提示显示在本次拍摄所在窗口。

未选择默认相机脚本时，系统相机入口会先显示内置相机，再打开脚本选择页；选择后提示下次打开 Scripting 相机时生效，本次拍摄保留供手动处理。取消选择仍留在相机。

“相机控制”Section 中始终显示“拍摄文件”入口，右侧为尚未交给脚本的照片/视频文件数，没有时显示 0。进入后可浏览缩略图，点照片查看、点视频播放；主按钮将批次交给脚本，“更多”菜单可导出或删除。已交付批次仍可查看和管理，但不计入待处理数。

内置 **相机控制示例（Camera Control DEMO）** 同时包含这两个文件，完整 `index.tsx` 见[相机控制指南](../camera_control/)。下面是可直接使用的 Home 页组件：

```tsx
import { Button, Script, Text, VStack, useState } from "scripting"

export default function Home() {
  const [count, setCount] = useState(0)
  return <VStack padding spacing={16}>
    <Text font="title">Default Script Demo</Text>
    <Text>{`Environment: ${Script.env}`}</Text>
    <Text>{`Button count: ${count}`}</Text>
    <Button title="Increment" action={() => setCount(count + 1)} />
    <Text>Select this script for Camera Control in More → Default Scripts to try the camera and captured-file workflow.</Text>
  </VStack>
}
```
