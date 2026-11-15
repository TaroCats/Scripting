The `Device` namespace provides access to information about the current device and its environment, including hardware characteristics, system details, screen metrics, battery status, orientation, proximity sensor state, locale and language settings, wake lock control, and network interfaces.

This API is commonly used to adapt UI layouts, behavior, and feature availability based on the device’s runtime context.

---

## Hardware and window geometry

`Device` is global. These read-only properties return snapshots. Read them again when your layout changes.

| Property | Meaning |
| --- | --- |
| `hardwareModel` | Hardware model identifier such as `"iPhone17,1"`. The Simulator reports the simulated model. An unavailable identifier is an empty string. |
| `hasDynamicIsland` | Whether the model is known to support Dynamic Island. Unrecognized models return `false`. Support does not indicate where an occlusion appears on the current display. |
| `nativeScreen` | `{ width, height, scale, nativeScale }` for the window's display or the main display if there is no window. Dimensions are physical pixels in the display's fixed orientation. The scale factors describe points and pixels. The snapshot is `null` in a background thread. |
| `safeAreaInsets` | `{ top, bottom, leading, trailing }` in points for the window. Leading and trailing follow its layout direction. |
| `statusBar` | `{ height, isHidden }` for the scene's status bar. Height is in points. |
| `sceneBounds` | `{ x, y, width, height }` in the scene's coordinate space, in points. Use this to read the current scene size in multitasking. |
| `interfaceOrientation` | The current scene orientation, one of `"portrait"`, `"portraitUpsideDown"`, `"landscapeLeft"`, or `"landscapeRight"`. |
| `occlusionRegions` | On iOS 27.1 and later, active occlusions reported by the system, each with `frame: { x, y, width, height }` and `isActive`. Frames are in window coordinates, in points, with the origin at the upper left. |

Window properties use the foreground window containing the script. Before the script presents UI, they use the app's key window if exactly one foreground key window is available. Window data is available to main-app entry, Home Tab, and Camera Control scripts. In widgets, extensions, or when a window or value is unavailable, window properties return `null`. `occlusionRegions` returns an empty array when there is no reported region, the window is unavailable, or the system is earlier than iOS 27.1.

A system occlusion can represent a camera, Dynamic Island, or window controls. Its frame describes the area the system reserves for layout. To lay out content within a view, use [GeometryReader](views/geometry_reader/) and `proxy.reservedRegions("occlusion")` for frames in that reader's local coordinates.

```ts
console.log(Device.hardwareModel, Device.hasDynamicIsland)
console.log(Device.sceneBounds, Device.safeAreaInsets)
for (const { frame } of Device.occlusionRegions) {
  console.log("Reserved area:", frame.x, frame.y, frame.width, frame.height)
}
```

## Screen capture state

`Device.isScreenCaptured` is `true` when the current foreground scene is continuously captured, such as during screen recording or mirroring, and `false` when it is inactive. It is `null` when the window or its capture state is unavailable. Single screenshots do not change this state.

Read the property for the initial state. `Device.onScreenCaptureChanged(listener)` delivers distinct states when the system reports a capture or window change, including an unavailable state. The returned function stops that subscription and can be called repeatedly. Subscriptions also stop when the script exits. In a context without window support, the returned function has no effect.

```ts
import { Script } from "scripting"

async function main() {
  console.log("Initial capture state:", Device.isScreenCaptured)
  const stop = Device.onScreenCaptureChanged(isCaptured => {
    console.log("Capture state:", isCaptured)
  })
  try {
    await Dialog.alert({
      title: "Screen capture",
      message: "Start or stop screen recording. Close this dialog to stop monitoring.",
    })
  } finally {
    stop()
    Script.exit()
  }
}

void main()
```

---

## Screen brightness

`Device.brightness` reads the current main-screen brightness. `Device.setBrightness(level)` submits a new level. Both use a range of `0` (minimum) to `1` (maximum). The setter throws if the argument is outside this range, is not finite, or is not a number.

These APIs are available to foreground main-app scripts with a window on the main screen, including entry scripts with an unambiguous foreground window. Reading returns `null` and setting returns `false` in unsupported contexts, including widgets, extensions, and external displays. A return value of `true` means the setting was submitted to the system. Brightness can remain changed after the script ends. The system restores its prior brightness setting when the device is locked and unlocked.

`Device.onBrightnessChanged(listener)` observes new brightness levels while the script has a supported foreground window. Read `Device.brightness` for the initial level. The returned function cancels the subscription, and the subscription also ends when the script exits. If a supported window is unavailable at registration, the returned function has no effect.

```ts
import { Script } from "scripting"

async function main() {
  const previous = Device.brightness
  if (previous === null || !Device.setBrightness(0.65)) {
    Script.exit()
    return
  }
  try {
    await Dialog.alert({ title: "Screen brightness", message: "Close this dialog to restore the previous brightness." })
  } finally {
    Device.setBrightness(previous)
    Script.exit()
  }
}

void main()
```

---

## Display and power state

| Property | Meaning |
| --- | --- |
| `Device.maximumFramesPerSecond` | The maximum refresh rate of the foreground window's display in frames per second. Without a window, it reads the main display. Background threads receive `null`. The actual refresh rate can vary. |
| `Device.isLowPowerModeEnabled` | Whether Low Power Mode is active. |
| `Device.thermalState` | The system's thermal state, one of `"nominal"`, `"fair"`, `"serious"`, `"critical"`, or `"unknown"`. Use it to decide when to defer optional work. |

---

## Memory

These read-only properties are available globally through `Device` without an import. All values are in **bytes** and are read when accessed.

| Property | Type | Meaning |
| --- | --- | --- |
| `physicalMemory` | `number` | Physical memory reported by the system for the device. This is not the current process memory limit. |
| `processMemoryUsage` | `number \| null` | Current host process memory footprint (`phys_footprint`). Returns `null` if the query fails or the system returns insufficient data. |
| `availableMemory` | `number` | System estimate of bytes remaining before the current process reaches its current memory limit. This is not device-wide free RAM. |

`processMemoryUsage` includes the host's allocations and other scripts sharing that process; it does not isolate one script's JavaScript heap. In a widget or another extension, it measures that extension's process, not the main app or the sum of all app processes. Footprint includes compressed memory accounting and differs from resident memory.

`availableMemory` is advisory and can change immediately, including when the system changes the process memory limit. Read it fresh when needed. A value of `0` can mean that the process has reached/exceeded its limit or that the system cannot supply an app memory budget. It is not a guarantee that an allocation will succeed. Neither available memory nor total physical memory should be used as a target allocation size.

Read memory usage at meaningful checkpoints or at a modest interval; avoid tight polling. Convert bytes to MiB by dividing by `1024 * 1024`.

```ts
import { Script } from "scripting"

const usage = Device.processMemoryUsage
console.log("Device memory (MiB):", Device.physicalMemory / 1024 / 1024)
console.log("Process footprint (MiB):", usage === null ? "unavailable" : usage / 1024 / 1024)
console.log("Process available memory (MiB):", Device.availableMemory / 1024 / 1024)
Script.exit()
```

---

## Network state and changes

`Device` and `Dialog` are global APIs and need no import. Import `Script` from `"scripting"` to end the script. These methods run in an active main-app script.

```ts
import { Script } from "scripting"

async function main() {
  const onChange = (state: Awaited<ReturnType<typeof Device.getNetworkState>>) => {
    console.log(state.status, state.interfaces, state.isExpensive, state.isConstrained)
  }

  try {
    const state = await Device.getNetworkState()
    console.log("Initial system path:", state)
    Device.addNetworkChangeListener(onChange)
    await Dialog.alert({
      title: "Network monitoring",
      message: "Change your Wi-Fi connection, then return here. Close this dialog to stop monitoring.",
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

The snapshot contains:

| Field | Meaning |
| --- | --- |
| `status` | `satisfied`, `unsatisfied`, `requiresConnection`, or `unknown` for a future system status. |
| `interfaces` | Interface types used by the system path: `wifi`, `cellular`, `wiredEthernet`, `loopback`, `other`. Can be empty or contain several entries, including when VPN routing is involved. |
| `isExpensive` | System cost classification; cellular and Personal Hotspot can be expensive. Do not use it to identify cellular. |
| `isConstrained` | Whether the system path is constrained, such as Low Data Mode. |

`getNetworkState()` waits for an actual system path callback, with a 10-second timeout. A newly started monitor never reports a made-up initial offline value. A listener receives an asynchronous initial snapshot, then updates when these fields change; duplicate registration of the same function is ignored. `removeNetworkChangeListener()` without an argument removes all this Device object's network listeners. Listeners and pending queries are cleaned up when the script exits. Monitoring does not keep a script running in the background or guarantee delivery while suspended.

A satisfied path does **not** prove Internet, a particular TCP server, Bonjour or RSD is reachable. Test the operation itself. The API does not return SSID, cellular generation or airplane-mode settings. `Device.networkInterfaces()` remains the separate address-list API.

Queries reject with an error whose `code` identifies the failure: `ERR_NETWORK_STATE_TIMEOUT` (no initial system event), `ERR_NETWORK_STATE_LIMIT` (over 32 pending queries or 32 distinct listeners), `ERR_PLATFORM_NOT_SUPPORTED` (unsupported/inactive context), or `ERR_PRO_REQUIRED` (access denied). Listener registration can throw the same applicable access/limit errors and `ERR_INVALID_ARG_TYPE`. Removal remains available for cleanup. If access is revoked, the next update or call releases monitoring; no synthetic network-state callback is emitted for that error.

---

## Orientation

Represents the physical orientation of the device.

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

### Description

* `portrait`: Portrait orientation, default upright position
* `portraitUpsideDown`: Portrait orientation, upside down
* `landscapeLeft`: Landscape orientation rotated to the left
* `landscapeRight`: Landscape orientation rotated to the right
* `faceUp`: Device is lying flat with the screen facing upward
* `faceDown`: Device is lying flat with the screen facing downward
* `unknown`: Orientation cannot be determined

---

## InterfaceOrientation

Represents the supported interface orientations for the app.

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

### Description

* `portrait`: Portrait orientation, default upright position
* `portraitUpsideDown`: Portrait orientation, upside down
* `landscape`: Landscape orientation, either left or right
* `landscapeLeft`: Landscape orientation rotated to the left
* `landscapeRight`: Landscape orientation rotated to the right
* `all`: All supported orientations
* `allButUpsideDown`: All supported orientations except upside down

---

## NetworkInterface

Describes a single network interface address.

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

### Properties

* `address`: IP address
* `netmask`: Subnet mask
* `family`: Address family, either IPv4 or IPv6
* `mac`: MAC address (may be null depending on system restrictions)
* `isInternal`: Indicates whether the interface is internal (for example, loopback)
* `cidr`: CIDR notation, such as `192.168.1.10/24`

---

## BatteryState

Represents the current battery state.

```ts
type BatteryState = "full" | "charging" | "unplugged" | "unknown"
```

### Description

* `full`: Battery is fully charged
* `charging`: Device is currently charging
* `unplugged`: Device is not connected to power
* `unknown`: Battery state cannot be determined

---

## Device Information

### model

```ts
const model: string
```

The device model, such as `"iPhone"` or `"iPad"`.

---

### localizedModel

```ts
const localizedModel: string
```

The localized name of the device model.

---

### appVersion / appBuildNumber

Readonly synchronous strings identifying the Scripting App, including when a script runs in an extension. `appVersion` reads `CFBundleShortVersionString`; `appBuildNumber` reads `CFBundleVersion`. Build numbers stay strings (they can contain dots or leading zeros). If the containing App cannot be read, the running bundle is used; a missing value is an empty string.

`Device` is an injected global; use it directly without an import:

```ts
console.log(`Scripting ${Device.appVersion} (${Device.appBuildNumber})`)
console.log(`OS ${Device.systemVersion}`)
```

These values identify Scripting, independently of a script's own version and the OS version. They require no permission or network access.

---

### systemVersion

```ts
const systemVersion: string
```

The current operating system version, for example `"18.2"`.

---

### systemName

```ts
const systemName: string
```

The name of the operating system, such as `"iOS"`, `"iPadOS"`, or `"macOS"`.

---

### isiPad / isiPhone

```ts
const isiPad: boolean
const isiPhone: boolean
```

Indicates whether the current device is an iPad or an iPhone.

---

### screen

```ts
const screen: {
  width: number
  height: number
  scale: number
}
```

Screen metrics:

* `width`: Screen width in logical pixels
* `height`: Screen height in logical pixels
* `scale`: Screen scale factor (for example, 2 or 3)

---

## Battery and Sensors

### batteryState

```ts
const batteryState: BatteryState
```

The current battery state.

---

### batteryLevel

```ts
const batteryLevel: number
```

The current battery level, expressed as a value between `0.0` and `1.0`.

---

### proximityState

```ts
const proximityState: boolean
```

The state of the proximity sensor.
`true` indicates that the device is close to the user, such as during a phone call.

---

## Orientation and Layout

### isLandscape / isPortrait / isFlat

```ts
const isLandscape: boolean
const isPortrait: boolean
const isFlat: boolean
```

* `isLandscape`: Indicates whether the device is in a landscape orientation
* `isPortrait`: Indicates whether the device is in a portrait orientation
* `isFlat`: Indicates whether the device is lying flat (face up or face down)

---

### orientation

```ts
const orientation: Orientation
```

The current physical orientation of the device.

---

### supportedInterfaceOrientations

```ts
var supportedInterfaceOrientations: InterfaceOrientation[]
```

The list of supported interface orientations. You can set this property to limit the orientations that your page supports.

#### Example
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

The list of interface orientations configured by the user. You can use this value to set `supportedInterfaceOrientations` to restore the default interface orientations.

---

## Appearance and Environment

### colorScheme

```ts
const colorScheme: ColorScheme
```

The current system color scheme, such as light or dark mode.

---

### isiOSAppOnMac

```ts
const isiOSAppOnMac: boolean
```

Indicates whether the current process is an iPhone or iPad app running on macOS.

---

## Locale and Language

### systemLocale

```ts
const systemLocale: string
```

The current system locale, for example `"en_US"`.

---

### preferredLanguages

```ts
const preferredLanguages: string[]
```

The user’s preferred languages, for example:

```ts
["en-US", "zh-Hans-CN"]
```

---

### systemLocales (Deprecated)

```ts
const systemLocales: string[]
```

Deprecated. Use `preferredLanguages` instead.

---

### systemLanguageTag

```ts
const systemLanguageTag: string
```

The current language tag, such as `"en-US"`.

---

### systemLanguageCode

```ts
const systemLanguageCode: string
```

The current language code, such as `"en"`.

---

### systemCountryCode

```ts
const systemCountryCode: string | undefined
```

The current country code, such as `"US"`.

---

### systemScriptCode

```ts
const systemScriptCode: string | undefined
```

The script code of the current locale, such as `"Hans"` for Simplified Chinese.

---

## Wake Lock

### isWakeLockEnabled

```ts
const isWakeLockEnabled: Promise<boolean>
```

Retrieves whether the wake lock is currently enabled, preventing the device from automatically sleeping.

---

### setWakeLockEnabled

```ts
function setWakeLockEnabled(enabled: boolean): void
```

Enables or disables the wake lock.

Notes:

* Available only in the **Scripting app**
* When enabled, the device will remain awake and not auto-lock

---

## Battery Listeners

### addBatteryStateListener

```ts
function addBatteryStateListener(
  callback: (state: BatteryState) => void
): void
```

Registers a listener for battery state changes.

---

### removeBatteryStateListener

```ts
function removeBatteryStateListener(
  callback?: (state: BatteryState) => void
): void
```

Removes a battery state listener.
If `callback` is not provided, all battery state listeners are removed.

---

### addBatteryLevelListener

```ts
function addBatteryLevelListener(
  callback: (level: number) => void
): void
```

Registers a listener for battery level changes.

---

### removeBatteryLevelListener

```ts
function removeBatteryLevelListener(
  callback?: (level: number) => void
): void
```

Removes a battery level listener.
If `callback` is not provided, all battery level listeners are removed.

---

## Orientation Listeners

### addOrientationListener

```ts
function addOrientationListener(
  callback: (orientation: Orientation) => void
): void
```

Starts observing device orientation changes.

Notes:

* This method must be called before orientation updates are delivered
* Orientation updates do not work when system orientation lock is enabled

---

### removeOrientationListener

```ts
function removeOrientationListener(
  callback?: (orientation: Orientation) => void
): void
```

Removes an orientation change listener.
If `callback` is not provided, all orientation listeners are removed and observation is stopped.

---

## Proximity Listeners

### addProximityStateListener

```ts
function addProximityStateListener(
  callback: (state: boolean) => void
): void
```

Registers a listener for proximity sensor state changes.

---

### removeProximityStateListener

```ts
function removeProximityStateListener(
  callback?: (state: boolean) => void
): void
```

Removes a proximity state listener.
If `callback` is not provided, all proximity listeners are removed.

---

## Network

### networkInterfaces

```ts
function networkInterfaces(): Record<string, NetworkInterface[]>
```

Returns the network interfaces available on the device.

Return value:

* Keys are interface names (such as `en0`, `lo0`)
* Values are arrays of `NetworkInterface` objects associated with each interface

This method is useful for network diagnostics, retrieving local IP addresses, and debugging connectivity issues.
