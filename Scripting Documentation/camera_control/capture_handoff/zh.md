# 拍摄资源与恢复交付

`Script.cameraControlParameter: CameraControlParameter | null` 是本次首次运行 `index.tsx` 时携带的资源批次。已有相机脚本收到后续批次时，参数通过 `Script.onResume(event)` 的 `event.cameraControlParameter` 交付；首次属性不是实时队列。其他启动/恢复事件中的相机参数为 null。原有 `queryParameters` 留给脚本自己的输入。

```ts
import type { CameraControlParameter } from "scripting"
// CameraControlParameter 结构：
// { captureId: string, assets: CameraControlAsset[] }
// 每个资源：
// { id, type: "photo" | "video", filePath, typeIdentifier, capturedAt,
//   width?, height?, duration? }
```

| 字段 | 含义 |
| --- | --- |
| `captureId` | 稳定的批次 ID，显式重试时保持不变，便于脚本实现业务去重。 |
| `assets` | 按拍摄顺序排列的已完成文件。单个锁屏拍摄会话最多 128 项；内置兜底相机交付本次完成的照片或视频。 |
| `id` | 批次内的资源 ID。 |
| `type` | `photo` 或 `video`。 |
| `filePath` | 导入完成后，主 App 内可读取的本地绝对路径。 |
| `typeIdentifier` | 文件的真实 UTI。照片为 `public.jpeg`，锁屏视频为 `com.apple.quicktime-movie`；内置兜底相机的视频则提供返回文件的实际类型。 |
| `capturedAt` | 记录的拍摄时间，Unix 时间戳，单位毫秒。 |
| `width`、`height` | 已知时提供编码像素尺寸，展示仍应遵守图片/视频的方向元数据。 |
| `duration` | 已知的视频时长，单位秒；照片不包含此字段。 |

照片用 `UIImage.fromFile` 按需读取。视频路径可用于 `AVPlayer`/`VideoPlayer`、`AVAsset`、Photos 或文件处理/上传 API；不要仅为页面间传参就把整段视频转成 base64。

恢复事件中的相机参数为 null 不代表新资源批次。从相机入口返回时应恢复拍摄 UI，保留之前接收的文件但不再次处理。示例会在前一次拍摄或停止完成后处理排队的恢复请求。纯文件交接最初不启动相机；正在显示取景时收到新文件，会保留该取景界面。

恢复事件本身不会重启相机，参数为 null 也不能证明来自系统相机入口。仅接收文件不要求新建相机会话；若同时收到系统相机入口的拍摄请求，脚本应自行恢复该体验。主 App 被系统终止的风险和已知规则边界见[系统拍摄入口要求](../)。

本示例选择在 `camera_control` 的无资源恢复事件中回到取景。这是示例脚本的策略，不是原生识别具体启动来源的保证。

## 交付与保留

Scripting 会等待系统文件到达、完整导入后，再启动或恢复相机脚本。系统重复通知不会自动重复执行同一批次。但这不保证脚本崩溃前后的外部副作用恰好执行一次：上传等业务应使用 `captureId` 记录成功状态并自行设计重试策略。

拍摄文件在 `Script.exit()` 后仍保留在本机。通过 **更多 → 默认脚本 → 相机控制 → 拍摄文件** 重试、再次运行或明确删除。若相机脚本仍在使用批次，应先关闭脚本。“已交给脚本”表示完成交付，不代表业务处理成功。如果需要在用户删除批次后继续使用，请先另存文件。

未选择脚本、选择发生变化、脚本丢失或启动失败时，保留文件供重新选择和重试。仅退出拍摄扩展不会自动运行脚本。视频必须完成录制和文件保存，才能点处理。只有保存/读取照片库才需要照片权限；只有启用视频声音时才需要麦克风权限。

同级 `index.tsx` 示例同时处理首次参数和恢复参数。新批次也会取消尚在等待权限的相机启动，避免查看资源时又迟到打开相机。


取消系统解锁不会丢弃已完成的文件，也不会自动运行脚本。回到拍摄页面后，可继续拍摄或重新点“让 Scripting 处理”；处理按钮在录像或保存期间不可用。文件和主 App 启动可能先后到达，Scripting 会等待对应批次，脚本无需轮询扩展目录。

## 完整 index.tsx 示例

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。


可在“更多 → 默认脚本 → 相机控制 → 拍摄文件”导出原始文件；没有可用的默认脚本时仍可导出或删除。
