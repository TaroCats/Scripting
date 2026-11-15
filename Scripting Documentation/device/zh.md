`Device` 命名空间提供对当前设备硬件、系统环境、语言区域、屏幕信息、电池状态、方向感知、接近传感器以及网络接口等信息的访问能力，并提供相关状态变化的监听接口。

该 API 主要用于根据设备环境动态调整 UI、行为逻辑或系统能力使用方式。

---

## 硬件与窗口几何

`Device` 是全局 API。以下只读属性返回读取时的快照，布局变化后可重新读取。

| 属性 | 含义 |
| --- | --- |
| `hardwareModel` | 硬件型号标识，例如 `"iPhone17,1"`。Simulator 返回所模拟的机型，无法读取时返回空字符串。 |
| `hasDynamicIsland` | 当前机型是否已知支持灵动岛。无法识别的机型返回 `false`。此属性描述机型能力，具体遮挡位置随当前显示器和布局变化。 |
| `nativeScreen` | 窗口所在显示器的 `{ width, height, scale, nativeScale }`，无窗口时读取主显示器。宽高为显示器固定方向下的物理像素，缩放因子描述点与像素的关系。后台线程读取时返回 `null`。 |
| `safeAreaInsets` | 窗口安全区 `{ top, bottom, leading, trailing }`，单位为点。leading 和 trailing 随窗口的布局方向变化。 |
| `statusBar` | 场景状态栏的 `{ height, isHidden }`，高度单位为点。 |
| `sceneBounds` | 场景坐标系中的 `{ x, y, width, height }`，单位为点。可用于读取多任务下的当前场景尺寸。 |
| `interfaceOrientation` | 当前场景的界面方向，取值为 `"portrait"`、`"portraitUpsideDown"`、`"landscapeLeft"` 或 `"landscapeRight"`。 |
| `occlusionRegions` | iOS 27.1 及以上系统报告的活动遮挡区，每项包含 `frame: { x, y, width, height }` 和 `isActive`。矩形使用窗口坐标，单位为点，原点在左上角。 |

窗口属性优先读取承载脚本的前台窗口。脚本展示界面之前，只有恰好一个前台键窗口（key window）时才读取该窗口。窗口数据适用于主 App 的入口脚本、主屏标签页脚本及 Camera Control 脚本。在小组件、扩展或窗口或属性值不可用时，窗口属性返回 `null`。系统未报告遮挡区、窗口不可用或低于 iOS 27.1 时，`occlusionRegions` 返回空数组。

遮挡区可来自摄像头、灵动岛或系统窗口控件，矩形表示系统为布局保留的范围。需要在某个视图内布局时，可用 [GeometryReader](views/geometry_reader/) 的 `proxy.reservedRegions("occlusion")` 读取该 reader 本地坐标中的矩形。

```ts
console.log(Device.hardwareModel, Device.hasDynamicIsland)
console.log(Device.sceneBounds, Device.safeAreaInsets)
for (const { frame } of Device.occlusionRegions) {
  console.log("遮挡区域", frame.x, frame.y, frame.width, frame.height)
}
```

## 屏幕捕获状态

录屏或镜像等持续捕获当前前台场景时，`Device.isScreenCaptured` 返回 `true`，未捕获时返回 `false`。窗口或其捕获状态不可用时返回 `null`。单次截图不会改变该状态。

通过属性读取初始值。`Device.onScreenCaptureChanged(listener)` 在系统报告捕获或窗口变化时回调，只发送变化后的状态，包括不可用状态。返回的函数可停止该订阅，重复调用也安全。脚本退出时会自动停止订阅。在不支持窗口数据的上下文中，返回的函数不执行任何操作。

```ts
import { Script } from "scripting"

async function main() {
  console.log("初始捕获状态", Device.isScreenCaptured)
  const stop = Device.onScreenCaptureChanged(isCaptured => {
    console.log("捕获状态", isCaptured)
  })
  try {
    await Dialog.alert({
      title: "屏幕捕获",
      message: "开始或停止屏幕录制。关闭此对话框即可停止监听。",
    })
  } finally {
    stop()
    Script.exit()
  }
}

void main()
```

---

## 屏幕亮度

`Device.brightness` 读取当前主屏幕亮度，`Device.setBrightness(level)` 提交新的亮度值。两者的范围都是 `0`（最低）到 `1`（最高）。传入超出范围、非有限或非数字的值时，设置方法会抛错。

这些 API 适用于主屏幕上的主 App 前台脚本，包括可以确定前台窗口的入口脚本。在小组件、扩展和外接屏等不支持的环境中，读取返回 `null`，设置返回 `false`。返回 `true` 表示设置已提交给系统。脚本结束后，亮度可能继续保持在调整后的水平。设备锁定后再次解锁时，系统会恢复原有亮度设置。

`Device.onBrightnessChanged(listener)` 在脚本拥有可用前台窗口时报告新的亮度值。初始值通过 `Device.brightness` 读取。调用返回的函数可取消订阅，脚本退出时也会结束订阅。如果注册时没有可用窗口，返回的函数不执行任何操作。

```ts
import { Script } from "scripting"

async function main() {
  const previous = Device.brightness
  if (previous === null || !Device.setBrightness(0.65)) {
    Script.exit()
    return
  }
  try {
    await Dialog.alert({ title: "屏幕亮度", message: "关闭此对话框可恢复之前的亮度。" })
  } finally {
    Device.setBrightness(previous)
    Script.exit()
  }
}

void main()
```

---

## 显示与电源状态

| 属性 | 含义 |
| --- | --- |
| `Device.maximumFramesPerSecond` | 前台窗口所在显示器的最高刷新率，单位为帧每秒。无窗口时读取主显示器，后台线程返回 `null`。实际刷新率可能变化。 |
| `Device.isLowPowerModeEnabled` | 是否开启低电量模式。 |
| `Device.thermalState` | 系统热状态，可为 `"nominal"`、`"fair"`、`"serious"`、`"critical"` 或 `"unknown"`。脚本可据此决定何时推迟非必要任务。 |

---

## 内存

以下只读属性通过全局 `Device` 直接访问，无需导入。数值统一以**字节**为单位，每次访问时读取。

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `physicalMemory` | `number` | 系统报告的设备物理内存总量，不是当前进程的内存上限。 |
| `processMemoryUsage` | `number \| null` | 当前宿主进程的内存占用（`phys_footprint`）。查询失败或系统返回的数据不足时为 `null`。 |
| `availableMemory` | `number` | 系统估计当前进程距离其当前内存上限还剩多少字节，不是设备全局空闲内存。 |

`processMemoryUsage` 包含宿主本身以及同进程中其他脚本的内存，不能单独统计一个脚本的 JavaScript 堆。在小组件或其他扩展中，它读取的是该扩展进程，不是主 App，也不是所有 App 进程的合计。Footprint 包含压缩内存的记账，与驻留内存的口径不同。

`availableMemory` 仅供参考，数值可能立即变化，系统也可能调整进程的内存上限。需要时应重新读取。`0` 可能表示进程已经达到或超过上限，也可能表示系统无法提供该进程的 App 内存额度。它不保证分配成功，也不应将可用内存或物理内存总量作为分配目标。

建议在关键步骤或以适当间隔读取内存，避免高频循环查询。将字节除以 `1024 * 1024` 可转换为 MiB。

```ts
import { Script } from "scripting"

const usage = Device.processMemoryUsage
console.log("设备物理内存（MiB）：", Device.physicalMemory / 1024 / 1024)
console.log("进程内存占用（MiB）：", usage === null ? "不可用" : usage / 1024 / 1024)
console.log("进程可用内存（MiB）：", Device.availableMemory / 1024 / 1024)
Script.exit()
```

---

## 网络状态与变化监听

`Device` 和 `Dialog` 是全局 API，无需导入；用于结束脚本的 `Script` 从 `"scripting"` 导入。这三个网络方法用于主 App 中的活跃脚本。

```ts
import { Script } from "scripting"

async function main() {
  const onChange = (state: Awaited<ReturnType<typeof Device.getNetworkState>>) => {
    console.log(state.status, state.interfaces, state.isExpensive, state.isConstrained)
  }

  try {
    const state = await Device.getNetworkState()
    console.log("系统初始网络路径：", state)
    Device.addNetworkChangeListener(onChange)
    await Dialog.alert({
      title: "网络监听",
      message: "切换 Wi-Fi 后返回，可在日志中查看变化。关闭此弹窗后结束监听。",
    })
  } catch (error) {
    console.error(error)
  } finally {
    Device.removeNetworkChangeListener(onChange)
    Script.exit()
  }
}

void main()
```

快照字段：

| 字段 | 含义 |
| --- | --- |
| `status` | `satisfied`（路径可用）、`unsatisfied`（不可用）、`requiresConnection`（需要建立连接），未来未知系统状态为 `unknown`。 |
| `interfaces` | 系统路径使用的接口类型数组：`wifi`、`cellular`、`wiredEthernet`、`loopback`、`other`。可以为空或含多个接口，VPN 下也不猜测唯一接入方式。 |
| `isExpensive` | 系统的高成本标记，蜂窝和个人热点都可能为 true，不能用来判定蜂窝。 |
| `isConstrained` | 路径是否受限，例如低数据模式。 |

`getNetworkState()` 等待真实系统路径回调，最多 10 秒；新建 monitor 不会伪造初始断网。监听异步发送初始快照，此后仅在公开字段变化时发送；同一函数重复注册会忽略。省略参数调用 `removeNetworkChangeListener()` 可移除当前 Device 对象的全部网络监听。脚本退出会清理监听和未完成查询；监听不会延长后台执行，也不保证挂起期间投递。

路径 `satisfied` **不代表** Internet、目标 TCP 服务、Bonjour 或 RSD 一定可达，应实际请求验证。接口不提供 SSID、蜂窝代际或飞行模式设置。原有 `Device.networkInterfaces()` 仍用于获取接口地址列表。

查询拒绝时可读取错误的 `code`：`ERR_NETWORK_STATE_TIMEOUT`（未收到首次系统事件）、`ERR_NETWORK_STATE_LIMIT`（超过 32 个待完成查询或 32 个不同监听）、`ERR_PLATFORM_NOT_SUPPORTED`（上下文不可用）、`ERR_PRO_REQUIRED`（访问被拒绝）。添加监听可能同步抛出适用的访问/数量错误和 `ERR_INVALID_ARG_TYPE`。移除始终可用于清理。访问被撤销后，下一次更新或调用会释放监听，不会把错误伪装成网络状态事件。

---

## Orientation

表示设备当前的物理朝向。

```ts
type Orientation =
  | "portrait"
  | "portraitUpsideDown"
  | "landscapeLeft"
  | "landscapeRight"
  | "faceUp"
  | "faceDown"
  | "unknown"
```

### 说明

* `portrait`：竖屏，Home 键在下（或标准竖屏方向）
* `portraitUpsideDown`：竖屏倒置
* `landscapeLeft`：横屏，设备向左旋转
* `landscapeRight`：横屏，设备向右旋转
* `faceUp`：设备平放，屏幕朝上
* `faceDown`：设备平放，屏幕朝下
* `unknown`：无法确定方向

---

## InterfaceOrientation

表示App UI 的可旋转方向

```ts
type InterfaceOrientation =
  | "portrait"
  | "portraitUpsideDown"
  | "landscape"
  | "landscapeLeft"
  | "landscapeRight"
  | "all"
  | "allButUpsideDown"
```

### 说明

* `portrait`：竖屏，Home 键在下（或标准竖屏方向）
* `portraitUpsideDown`：竖屏倒置
* `landscape`：横屏，设备向左旋转
* `landscapeLeft`：横屏，设备向左旋转
* `landscapeRight`：横屏，设备向右旋转
* `all`：所有可旋转方向
* `allButUpsideDown`：除了竖屏，所有可旋转方向

---

## NetworkInterface

描述单个网络接口地址的信息。

```ts
type NetworkInterface = {
  address: string
  netmask: string | null
  family: "IPv4" | "IPv6"
  mac: string | null
  isInternal: boolean
  cidr: string | null
}
```

### 字段说明

* `address`：IP 地址
* `netmask`：子网掩码
* `family`：地址族，IPv4 或 IPv6
* `mac`：MAC 地址（部分系统或接口可能为 null）
* `isInternal`：是否为内部接口（如 loopback）
* `cidr`：CIDR 表示形式，例如 `192.168.1.10/24`

---

## BatteryState

表示当前电池状态。

```ts
type BatteryState = "full" | "charging" | "unplugged" | "unknown"
```

### 说明

* `full`：电量已充满
* `charging`：正在充电
* `unplugged`：未连接电源
* `unknown`：无法确定状态

---

## Device Information

### model

```ts
const model: string
```

设备型号，例如 `"iPhone"`、`"iPad"`。

---

### localizedModel

```ts
const localizedModel: string
```

本地化后的设备型号名称。

---

### appVersion / appBuildNumber

同步只读字符串，用于识别 Scripting App，扩展中的脚本也可读取。`appVersion` 对应 `CFBundleShortVersionString`，`appBuildNumber` 对应 `CFBundleVersion`。构建号保持字符串（可能含小数点或前导零）。无法读取宿主 App 时使用当前运行 bundle；字段缺失时返回空字符串。

`Device` 是注入的全局 API，直接使用，无需导入：

```ts
console.log(`Scripting ${Device.appVersion} (${Device.appBuildNumber})`)
console.log(`OS ${Device.systemVersion}`)
```

这两个字段表示 Scripting 本体的版本，与脚本自身版本、操作系统版本分别独立，不需要权限或网络访问。

---

### systemVersion

```ts
const systemVersion: string
```

当前操作系统版本号，例如 `"18.2"`。

---

### systemName

```ts
const systemName: string
```

操作系统名称，例如 `"iOS"`、`"iPadOS"`、`"macOS"`。

---

### isiPad / isiPhone

```ts
const isiPad: boolean
const isiPhone: boolean
```

指示当前设备是否为 iPad 或 iPhone。

---

### screen

```ts
const screen: {
  width: number
  height: number
  scale: number
}
```

屏幕信息：

* `width`：屏幕宽度（逻辑像素）
* `height`：屏幕高度（逻辑像素）
* `scale`：屏幕缩放比例（如 2、3）

---

## Battery & Sensors

### batteryState

```ts
const batteryState: BatteryState
```

当前电池状态。

---

### batteryLevel

```ts
const batteryLevel: number
```

当前电量百分比，范围为 `0.0` 到 `1.0`。

---

### proximityState

```ts
const proximityState: boolean
```

接近传感器状态，`true` 表示设备靠近用户（例如通话时贴近耳朵）。

---

## Orientation & Layout

### isLandscape / isPortrait / isFlat

```ts
const isLandscape: boolean
const isPortrait: boolean
const isFlat: boolean
```

* `isLandscape`：是否处于横屏
* `isPortrait`：是否处于竖屏
* `isFlat`：设备是否平放（face up / face down）

---

### orientation

```ts
const orientation: Orientation
```

当前设备物理方向。

---

### supportedInterfaceOrientations

```ts
var supportedInterfaceOrientations: InterfaceOrientation[]
```

获取和设置当前支持的旋转方向。

#### 示例

```tsx
function Page() {
  useEffect(() => {
    Device.supportedInterfaceOrientations = ["all"]
    return () => {
      Device.supportedInterfaceOrientations = Device.userConfiguredInterfaceOrientations
    }
  }, [])
  return <VStack>...</VStack>
}
```

---

### userConfiguredInterfaceOrientations

```ts
const userConfiguredInterfaceOrientations: InterfaceOrientation[]
```

获取用户配置的旋转方向。你可以使用这个值的来设置`supportedInterfaceOrientations`以恢复为默认的旋转方向。

---

## Appearance & Environment

### colorScheme

```ts
const colorScheme: ColorScheme
```

当前系统颜色模式，例如浅色或深色模式。

---

### isiOSAppOnMac

```ts
const isiOSAppOnMac: boolean
```

指示当前进程是否为运行在 macOS 上的 iPhone / iPad App（Mac Catalyst 或 iOS App on Mac）。

---

## Locale & Language

### systemLocale

```ts
const systemLocale: string
```

当前系统 Locale，例如 `"en_US"`。

---

### preferredLanguages

```ts
const preferredLanguages: string[]
```

用户偏好的语言列表，例如：

```ts
["en-US", "zh-Hans-CN"]
```

---

### systemLocales（已废弃）

```ts
const systemLocales: string[]
```

已废弃，请使用 `preferredLanguages`。

---

### systemLanguageTag

```ts
const systemLanguageTag: string
```

语言标签，例如 `"en-US"`。

---

### systemLanguageCode

```ts
const systemLanguageCode: string
```

语言代码，例如 `"en"`。

---

### systemCountryCode

```ts
const systemCountryCode: string | undefined
```

国家代码，例如 `"US"`。

---

### systemScriptCode

```ts
const systemScriptCode: string | undefined
```

书写系统代码，例如 `"Hans"`（简体中文）。

---

## Wake Lock

### isWakeLockEnabled

```ts
const isWakeLockEnabled: Promise<boolean>
```

查询当前是否启用了屏幕唤醒锁定（防止设备自动锁屏）。

---

### setWakeLockEnabled

```ts
function setWakeLockEnabled(enabled: boolean): void
```

启用或禁用 Wake Lock。

说明：

* 仅在 **Scripting App** 内可用
* 启用后可防止设备自动休眠

---

## Battery Listeners

### addBatteryStateListener

```ts
function addBatteryStateListener(
  callback: (state: BatteryState) => void
): void
```

监听电池状态变化。

---

### removeBatteryStateListener

```ts
function removeBatteryStateListener(
  callback?: (state: BatteryState) => void
): void
```

移除电池状态监听器。

* 未传入 `callback` 时将移除所有监听器

---

### addBatteryLevelListener

```ts
function addBatteryLevelListener(
  callback: (level: number) => void
): void
```

监听电量变化。

---

### removeBatteryLevelListener

```ts
function removeBatteryLevelListener(
  callback?: (level: number) => void
): void
```

移除电量监听器。

---

## Orientation Listeners

### addOrientationListener

```ts
function addOrientationListener(
  callback: (orientation: Orientation) => void
): void
```

开始监听设备方向变化。

注意事项：

* 必须先调用该方法才能接收方向变化
* 系统方向锁开启时不会生效

---

### removeOrientationListener

```ts
function removeOrientationListener(
  callback?: (orientation: Orientation) => void
): void
```

移除方向监听器。

* 未传入 `callback` 时将停止所有方向监听并结束观察

---

## Proximity Listeners

### addProximityStateListener

```ts
function addProximityStateListener(
  callback: (state: boolean) => void
): void
```

监听接近传感器状态变化。

---

### removeProximityStateListener

```ts
function removeProximityStateListener(
  callback?: (state: boolean) => void
): void
```

移除接近传感器监听器。

---

## Network

### networkInterfaces

```ts
function networkInterfaces(): Record<string, NetworkInterface[]>
```

获取当前设备的网络接口信息。

返回值说明：

* Key：接口名称（如 `en0`、`lo0`）
* Value：该接口对应的地址信息数组

适用于网络诊断、本地 IP 获取、调试用途。
