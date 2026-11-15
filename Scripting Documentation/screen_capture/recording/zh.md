# 屏幕采集：录像与预览

顺序为 `createSession()` → `addRecordingOutput({filePath, videoCodecType?, outputFileType?, mixesAudioWithMicrophone?, overwrite?})` → `start()`。启动前挂载可包含最初样本；同一时刻只允许一个原生录像。`getRecordingCapabilities()` 返回设备支持的编码与容器；默认 H.264（`avc1`）和 MP4（`public.mpeg-4`）。路径必须是脚本获准访问的可写绝对路径；已有文件默认拒绝 `fileExists`，只有显式 overwrite=true 才覆盖。

录像提供 `state`、秒数 `recordedDuration`、字节数 `recordedFileSize`、`onStateChanged`、`finished` 和 `stop()`。停止录像只移除该录像并完成文件，会话仍可继续；停止会话会完成当前录像。预览或分享前等待 `finished`，挂载成功、启动成功不代表文件完整。采集启动前移除录像会拒绝 `aborted`。原生录像直接使用原生流，不依赖 JS 原始样本消费速度。

系统声音使用 `configuration.capturesAudio`；讲解显示麦克风选项。用户选择及独立麦克风系统权限决定是否启用。`mixesAudioWithMicrophone` 默认 true，false 保留独立音轨。不兼容且正在使用的共享音频会话拒绝 `resourceBusy`，使用 SharedAudioSession 的应用可预先配置兼容输入。

`presentRecordingEditor(filePath)` 从该脚本的可见前台 scene 展示 Apple 编辑/预览界面，关闭时完成。不返回编辑后文件路径，也不代表用户已保存或分享。保留原始录像结果。另行保存到照片图库需要独立权限。

内置 **屏幕录制** 脚本使用相同公开流程：打开脚本、允许脚本权限、系统选择共享整个屏幕、切换 App、返回停止，再预览文件，审核员也可直接体验。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
