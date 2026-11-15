# VideoPictureInPictureController

Scripting 3.2.2 新增。通过此全局类，JavaScript 可以从 Layer 模式的 `AVPlayerView` 主动请求系统视频画中画（PiP）。直接使用，无需从 `"scripting"` 导入。它与自定义 UI 的 PiP 视图修饰符是独立的功能。

## API

```ts
class VideoPictureInPictureController {
  constructor()
  static isSupported(): boolean
  readonly isPossible: boolean
  readonly isActive: boolean
  readonly isSuspended: boolean
  readonly lastError: string | null
  start(): boolean
  stop(): void
  dispose(): void
  onStateChanged?: ((state: "willStart" | "didStart" | "willStop" | "didStop" | "failedToStart") => void) | null
  onPossibleChanged?: ((possible: boolean) => void) | null
}
```

| 成员 | 说明 |
| --- | --- |
| `isSupported()` | 设备/系统是否支持视频 PiP。这是方法，不是属性。 |
| `isPossible` | 已绑定的源视图是否在屏幕上，且原生控制器当前允许启动 PiP。支持能力不等于已经就绪。 |
| `isActive` | 系统 PiP 当前是否运行。 |
| `isSuspended` | 系统 PiP 当前是否挂起。 |
| `lastError` | 最近一次启动被拒绝或异步启动失败的错误；初始为 null，提交新的启动请求时清除。 |
| `start()` | 请求已提交，或当前可用时已有启动请求/正在运行，返回 true；不代表已经进入 PiP。已释放、未绑定、不在屏幕上或尚不可用时返回 false，不排队重试。应在用户操作中调用。 |
| `stop()` | 请求停止 PiP，不暂停 AVPlayer。 |
| `dispose()` | 幂等地停止并释放 PiP、清除回调；句柄不可复用，不销毁调用者的 AVPlayer。 |
| `onPossibleChanged` | 通知当前可用状态变化，可用于更新界面；启动时仍检查 `isPossible`。 |
| `onStateChanged` | 通知 `willStart`、`didStart`、`willStop`、`didStop`、`failedToStart`；失败时读取 `lastError`，通过 `didStart`/`didStop` 确认完成切换。 |

## 绑定与生命周期

通过 `pictureInPictureController` 传入句柄，并且必须**显式**指定 `renderingMode="layer"`。省略模式或传入 `"controller"` 会抛出错误，即使所在长按菜单预览默认采用 Layer 也不例外。一个句柄同一时间只能绑定一个源视图。

在组件重渲染之间保持句柄稳定，PiP 期间保持源视图挂载及 AVPlayer 存活。源视图移除后会停止并解绑 PiP；此 API 不支持关闭页面或退出脚本后继续浮窗。显式配置 `SharedAudioSession` 的 playback 音频会话，SDK 不会自动修改全局音频设置。Layer 模式没有原生播放控件、自动 PiP、全屏切换或 Now Playing 管理。`pipStatus` 仍为必传属性，绑定句柄时接收生命周期更新；启动失败通过 `onStateChanged` 通知。

离开页面时先释放 PiP 句柄，再停止并释放播放器。临时视频文件应保留到播放器释放后；不要删除用户选择的源文件。

## 完整示例

选择本地视频，等待就绪后点击 Start PiP。保持页面打开。此示例每次运行只加载一个视频，更换视频请重新打开示例；自己的应用中更换视频前先停止 PiP 并等待 `didStop`。实际可用性取决于设备和播放状态。

```tsx
import { AVPlayerView, Button, Navigation, NavigationStack, Script, Text, VStack,
  useEffect, useObservable, useRef, useState, PIPStatus } from "scripting";

function Demo() {
  const playerRef = useRef<AVPlayer | null>(null);
  const pipRef = useRef<VideoPictureInPictureController | null>(null);
  const alive = useRef(true);
  const hasSource = useRef(false);
  if (!playerRef.current) playerRef.current = new AVPlayer();
  if (!pipRef.current) pipRef.current = new VideoPictureInPictureController();
  const player = playerRef.current;
  const pip = pipRef.current;
  const pipStatus = useObservable<PIPStatus>();
  const [loaded, setLoaded] = useState(false);
  const [possible, setPossible] = useState(false);
  const [message, setMessage] = useState("Choose a local video, then start PiP. Keep this page open.");

  useEffect(() => {
    pip.onPossibleChanged = value => { if (alive.current) setPossible(value); };
    pip.onStateChanged = state => {
      if (alive.current) setMessage(state === "failedToStart" ? (pip.lastError ?? state) : state);
    };
    return () => {
      alive.current = false;
      pip.dispose();
      player.stop();
      player.dispose();
    };
  }, []);

  const chooseVideo = async () => {
    if (hasSource.current) { setMessage("Reopen this example to choose another video."); return; }
    try {
      const paths = await DocumentPicker.pickFiles({ types: ["public.movie"], allowsMultipleSelection: false });
      if (!alive.current || hasSource.current || !paths[0]) return;
      await SharedAudioSession.setCategory("playback", []);
      await SharedAudioSession.setActive(true);
      if (!alive.current || hasSource.current) return;
      if (!player.setSource(paths[0])) { setMessage("Unable to load video"); return; }
      hasSource.current = true;
      setLoaded(true);
      setPossible(pip.isPossible);
      player.play();
      setMessage("Wait until PiP is possible, then tap Start PiP.");
    } catch (error) {
      if (alive.current) setMessage(String(error));
    }
  };

  return <NavigationStack><VStack spacing={16} padding={16}>
    <Text>Video PiP</Text>
    <Text>{VideoPictureInPictureController.isSupported() ? "PiP supported" : "PiP unsupported"}</Text>
    {loaded ? <AVPlayerView player={player} pipStatus={pipStatus}
      renderingMode="layer" pictureInPictureController={pip} frame={{ height: 240 }} /> : <Text>No video loaded</Text>}
    <Button title="Choose and play video" action={chooseVideo} />
    <Text>{possible ? "PiP possible" : "PiP not possible"}</Text>
    <Button title="Start PiP" action={() => { if (!pip.start()) setMessage(pip.lastError ?? "Cannot start PiP"); }} />
    <Button title="Stop PiP" action={() => pip.stop()} />
    <Text>{message}</Text>
  </VStack></NavigationStack>;
}

async function run() {
  try { await Navigation.present({ element: <Demo /> }); }
  finally { Script.exit(); }
}
run();
```
