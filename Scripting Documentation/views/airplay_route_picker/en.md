# AirPlayRoutePicker

A native output-selection button for main App script pages. Import it from `"scripting"`. The component can be used independently of the AirPlay JS APIs.

For a button directly in a script page:

```tsx
import { AirPlayRoutePicker } from "scripting"

function OutputPicker() {
  return <AirPlayRoutePicker
    prioritizesVideoDevices
    tintColor="systemBlue"
    activeTintColor={{ light: "#0055CC", dark: "#99BBFF" }}
    accessibilityLabel="Choose output"
    onWillBeginPresentingRoutes={() => console.log("Opening destinations")}
    onDidEndPresentingRoutes={() => console.log("Destination menu closed")}
  />
}
```

The component accepts `prioritizesVideoDevices?: boolean`, `tintColor?: Color | {light: Color, dark: Color}`, `activeTintColor?: Color | {light: Color, dark: Color}` and the two optional `() => void` callbacks above, plus ordinary view modifiers. The native control provides its own accessible semantics and selection state; give it a concise label and retain an adequate touch target. Closing the menu does not indicate successful routing. It is not bound to one player; there is no `player` prop. Unsupported hosts do not render this control. Users select routes through the system UI; there is no API to silently connect by device ID, enumerate every receiver, or start screen mirroring.
