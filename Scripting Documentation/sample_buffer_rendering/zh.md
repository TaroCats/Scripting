# 样本缓冲区播放

在 iOS/iPadOS 17 及以上的主 App 脚本中，使用统一时间线播放原生音视频样本。`AVSampleBufferDisplayLayer` 通过 `SampleBufferView` 显示视频，`AVSampleBufferAudioRenderer` 播放声音，`AVSampleBufferRenderSynchronizer` 协调两者的时间戳。

播放不需要相机或麦克风授权。文件访问沿用文档选择器和 AVAsset 的规则。音频使用共享音频会话：按需要配置 category，不要关闭其他功能正在使用的会话。示例激活当前会话，退出时不替其他使用者停用会话。

完整示例可选择本地视频或音频文件，从最早的源时间戳开始播放，提供暂停、继续和停止按钮，退出时释放读取器、样本、渲染器和时钟。可用编解码格式由系统决定。

## index.tsx

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
