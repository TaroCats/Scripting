# onTouchGesture：原生触摸事件

`onTouchGesture` 在 **iOS 18+** 通过 UIKit 获取每根手指的触摸阶段。适合自定义键盘的按键或整行专用触摸区，SwiftUI 继续负责布局，脚本判断点按、长按和划动。它是可选的新路径，不会自动改变 `DragGesture`。iOS 17 忽略此属性，不安装替代手势；旧系统兼容路径须由脚本明确选择。

```tsx
import { Text, modifiers, type TouchGestureEvent } from "scripting"

function receive(event: TouchGestureEvent) {
  switch (event.phase) {
    case "began": /* 按 startLocation 命中，锁定 touchId，显示按下状态。 */ break
    case "moved": /* 更新匹配手指的位移/意图。 */ break
    case "ended": /* 提交一次，释放匹配的手指。 */ break
    case "cancelled": /* 清高亮、弹窗和定时器；不能提交点按。 */ break
  }
}
const direct = <Text onTouchGesture={{ onEvent: receive }}>按键</Text>
const chained = <Text modifiers={modifiers().onTouchGesture({ onEvent: receive })}>按键</Text>
```

## 属性

```ts
type TouchGestureProps = {
  enabled?: boolean                  // 默认 true，false 取消活跃触摸
  coordinateSpace?: "local"          // 默认 local，目前只支持 local
  onEvent: (event: TouchGestureEvent) => void
}
```

回调同步运行，应保持简短。不要等待 Promise 或逐事件同步写盘。主线程/JS 阻塞仍会影响响应，本接口不保证延迟上限。

## 事件字段

| 字段 | 含义 |
|---|---|
| `touchId` | 触摸唯一字符串 ID；同一手指从 began 到结束保持不变，下次触摸不复用 |
| `sequence` | 同一绑定区域内递增的事件序号，不是手指编号 |
| `phase` | `began`、`moved`、`ended`、`cancelled` |
| `startLocation` | 初始 `{ x, y }`，绑定 SwiftUI 视图的 local 坐标，单位 point |
| `location` | 当前 local 位置 `{ x, y }`，单位 point |
| `translation` | 当前位置减初始位置 `{ width, height }`，单位 point |
| `velocity` | `{ width, height }`，point/s；使用事件时间差分与 30ms 指数低通，began 为零 |
| `timestamp` | UIKit 事件时间，系统 uptime 毫秒，不是 Unix 时间 |
| `receivedAt` | 原生接收时间，与 timestamp 同源的 uptime 毫秒 |
| `dispatchAt` | 原生调用 JS 前的时间，与 timestamp 同源的 uptime 毫秒 |
| `reason` | 可选取消原因，例如 `system`、`reset`、`disabled`、`removed`、`keyboardHidden`、`scriptSwitched`、`scriptExited`；不是固定枚举 |

`receivedAt - timestamp` 观察事件投递等待，`dispatchAt - receivedAt` 观察原生处理到 JS 调用前的等待，均不是画面呈现延迟。合成取消事件的 timestamp 为取消时刻。不能直接与 `Date.now()` 或未校准的 `performance.now()` 相减。

不提供 `predictedEndLocation` / `predictedEndTranslation`，速度也不保证与 SwiftUI 估计相同。依赖速度/预测来取消长按的脚本需要适配和验证启发式，不应伪造预测字段。

## 归属、取消与兼容

逐指保存 touchId 状态。单指状态机可以采用“第一根持有，其他手指整段忽略”，不能让第二根手指提交/结束第一根。整行通过初始位置命中扩大的按键区域，移动后仍保留初始目标。

初始触点按绑定视图的 local 布局矩形过滤，不提供任意 contentShape 或额外 hitSlop 的等价语义。需要扩大的命中区域时，先扩大专用触摸视图的实际 frame。

禁用、视图移除、系统取消和键盘隐藏/切换会取消活跃触摸。取消时停止长按、删除和光标 repeat，清理 popup/highlight，**不要调用提交点按的 end/settle**。脚本退出后不应依赖还能收到 JS 回调；组件 cleanup 也须清理计时器和状态。

该接口不是 `GestureInfo`，不接受 `GestureMask`，不能传入 `gesture`、`highPriorityGesture` 或 `simultaneousGesture`。它保留布局，但不保证与子级按钮、滚动和菜单的手势竞争关系等价。仅绑定专用输入区；整行与单键不要重叠，同一区域不要同时安装旧拖动路径。候选滚动、contextMenu、工具栏及系统键盘切换保留原交互。

完整多指输入还需要脚本隔离长按、repeat、光标等共享状态；增加此接口不等于单指键盘自动支持多指。保留显式回退开关，切换前取消活跃手势。

触摸取消时的位置为最后一个可靠位置；取消事件不会读取正在移除的视图几何信息。每根手指最多收到一个终止事件。请将 `cancelled` 用于清理按下状态，而不要提交按键动作。
