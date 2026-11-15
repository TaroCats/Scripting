# 多轨播放与排期

每路独立轨道创建一个 `AVAudioPlayerNode`，attach 后连接到混音器，通过各播放器的音量/声像调整平衡。scheduleBuffer、scheduleFile、scheduleSegment 返回播放票据；排期不会自行启动已停止的播放器。

对齐起点时，先准备轨道、启动引擎、读取有效原生渲染时钟，再向每路播放器的 play() 传同一个未来 AVAudioTime。样本时间属于播放器时间轴，主机时钟属于系统单调时钟；主机时钟使用十进制字符串保存。不要把 Date.now() 当音频主机时钟，也不要用 JS 定时器协调多轨起点。

scheduleSegment 接受读取文件句柄、startingFrame 和 frameCount，位置单位是帧而不是字节。原生排期会持有文件/缓冲区直到完成点及后续原生读取结束；使用期间不能关闭文件或修改/销毁缓冲区。interrupts 立即替换播放，interruptsAtLoop 在循环边界替换；旧循环的公开票据取消后，原生仍可能在边界到来前使用其数据。

dataConsumed、dataRendered、dataPlayedBack 是不同完成点。循环票据在替换/停止/取消前保持待完成。pause 保留位置，stop 重置位置并取消排期。播放器/节点时间转换需要有效时钟，尚无时钟时可返回 null。实际路由延迟仍影响听感；排期时间不证明扬声器已经出声。

## 完整 index.tsx

两轨均使用本地生成 PCM，无需下载或麦克风。共享主机时钟启动，可让第二轨延迟 12000 样本，调整声像，再停止取消循环。文字显示请求的时间及票据结果。请不要和其它使用共享音频会话的脚本同时运行。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
