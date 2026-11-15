# onTouchGesture: Native Touch Events

On **iOS 18+**, `onTouchGesture` receives per-finger UIKit phases on dedicated keys or keyboard rows. SwiftUI handles layout; scripts handle tap, long-press and swipe intent. This opt-in path does not change existing `DragGesture`. iOS 17 ignores the property without installing a fallback; scripts must select their legacy path explicitly.

```tsx
import { Text, modifiers, type TouchGestureEvent } from "scripting"

function receive(event: TouchGestureEvent) {
  switch (event.phase) {
    case "began": /* Hit-test startLocation and claim touchId. */ break
    case "moved": /* Update the matching finger's intent. */ break
    case "ended": /* Commit once, then release. */ break
    case "cancelled": /* Clear highlights/popups/timers; never commit. */ break
  }
}
const direct = <Text onTouchGesture={{ onEvent: receive }}>Key</Text>
const chained = <Text modifiers={modifiers().onTouchGesture({ onEvent: receive })}>Key</Text>
```

## Options

```ts
type TouchGestureProps = {
  enabled?: boolean                   // true by default; false cancels active touches
  coordinateSpace?: "local"           // local by default; only local is supported
  onEvent: (event: TouchGestureEvent) => void
}
```

Callbacks run synchronously. Keep them short; do not await promises or write storage for every event. Main-thread/JS blocking can still delay input. This API does not guarantee a latency bound.

## Event fields

| Field | Meaning |
|---|---|
| `touchId` | Unique string, stable for a touch lifetime and never reused for a later touch |
| `sequence` | Increasing event number within one attached surface, not a finger ID |
| `phase` | `began`, `moved`, `ended`, or `cancelled` |
| `startLocation` | Initial `{ x, y }` in the attached SwiftUI view's local space, in points |
| `location` | Current local `{ x, y }`, in points |
| `translation` | Current minus initial position as `{ width, height }`, in points |
| `velocity` | `{ width, height }` in points/second, measured from event deltas with a 30ms exponential low-pass; zero at began |
| `timestamp` | UIKit event time in system-uptime milliseconds, not Unix time |
| `receivedAt` | Native receipt time, in uptime milliseconds on the same clock |
| `dispatchAt` | Native time before invoking JS, on the same uptime clock |
| `reason` | Optional cancellation reason, e.g. `system`, `reset`, `disabled`, `removed`, `keyboardHidden`, `scriptSwitched`, `scriptExited`; not a fixed enum |

`receivedAt - timestamp` measures delivery delay; `dispatchAt - receivedAt` measures native handling before JS invocation. Neither measures frame presentation. Synthetic cancellation timestamps represent cancellation time. Do not subtract these fields from `Date.now()` or uncalibrated `performance.now()`.

There are no `predictedEndLocation` or `predictedEndTranslation` fields. Velocity is not guaranteed to match SwiftUI's estimate. Adapt and test scripts relying on these fields to cancel long press/repeat instead of fabricating predictions.

## Ownership and cancellation

Store state by touchId. Single-owner adapters may keep the first finger and ignore subsequent fingers for their entire touch. A second finger must not commit or release the first. Row hit testing uses the initial position and retains that target while moving.

Initial touches are filtered by the attached view's local layout rectangle, not an arbitrary contentShape or extra hitSlop. Enlarge the dedicated surface's actual frame when a larger hit area is required.

Disabling, removal, system interruption and keyboard hiding/switching cancel active touches. Stop long-press/repeat/cursor timers and clear popups/highlights; do not call a tap-committing end/settle handler. After script termination do not rely on another JS callback; component cleanup must also release resources.

This is not a `GestureInfo`, does not accept `GestureMask`, and cannot be passed to `gesture`, `highPriorityGesture`, or `simultaneousGesture`. It preserves layout, but not necessarily arbitration with child buttons, scrolling or menus. Only bind dedicated input surfaces; do not overlap row/key handlers or install both old/new paths on the same region. Keep candidate scrolling, context menus, toolbar controls and keyboard switching on their existing paths.

Full multitouch input also needs per-finger intent and isolation of shared repeat/cursor state in JS. This property alone does not make a single-owner keyboard multitouch. Keep an explicit fallback switch and cancel active gestures before changing paths.

When a touch is cancelled, its position is the last reliable position; cancellation does not read geometry from a view being removed. Each finger receives at most one terminal event. Handle `cancelled` as cleanup rather than committing a key action.
