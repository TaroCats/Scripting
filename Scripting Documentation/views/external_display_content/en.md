# ExternalDisplayContent

A main App component that mounts one JSX subtree exclusively on a connected external display. It occupies no visible space on the device and does not invoke `ExternalDisplay.createPresentation()`. Children share the existing script context and state. Connect Screen Mirroring or a physical display through the system first; see [External Display](../../external_display/en.md).

```tsx
import { Button, ExternalDisplayContent, Navigation, Text, VStack, useState } from "scripting"
function Page() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState("waiting")
  return <VStack>
    <Text>{`Output: ${status}; Count: ${count}`}</Text>
    <Button title="Next" action={() => setCount(value => value + 1)} />
    <ExternalDisplayContent onStateChanged={setStatus} onError={console.error}>
      <VStack><Text font="largeTitle">{`Count: ${count}`}</Text></VStack>
    </ExternalDisplayContent>
  </VStack>
}
await Navigation.present({ element: <Page/> })
```

Props: `children` is one root (wrap several views in a VStack/ZStack); `enabled?: boolean` defaults to true; `onStateChanged?: (state) => void` reports waiting/presenting/suspended/disposed; `onError?: (message) => void` reports ownership conflicts. Set enabled=false to suspend while keeping ownership; unmount to release. A competing image handle/component fails instead of replacing the owner. After a conflict, unmount and remount when the display is free.

Use display-oriented content. Interaction is disabled: keep buttons, keyboard entry, navigation, media-output pickers, dialogs and equivalent accessible feedback on the device. Apply visual modifiers to the child root; the mounting component has no local visual surface. Do not nest another ExternalDisplayContent in external content. Hooks belong to the existing subtree and effects follow its normal lifetime, not a second script execution. Remote display loss does not automatically unmount the script subtree. State callbacks describe native scenes, not verified receiver pixels. Real VoiceOver task completion needs device testing.

## Run the complete demo

Open the documentation's example entry, or run [the complete index.tsx](index.tsx) as a main App script. No assets or image-presentation handles are used. Run it separately from the image demo: only one external presentation may own output.

1. Connect **Screen Mirroring** in Control Center, close Control Center, and return to the demo. The receiver should show EXTERNAL JSX with COUNT 0; the device keeps all buttons, the same count/color, and readable state/errors.
2. Use **Increment shared count**, **Reset shared count**, and **Change shared color** to update the existing external subtree. Pause/resume changes `enabled` while retaining ownership; release/mount unmounts/remounts the host while preserving state in the parent page. If another owner causes an error, release and mount again after that owner stops.
3. Increment, disconnect Screen Mirroring, close the system panels, and increment again while disconnected. Keep the subtree mounted. Reconnect and return to the demo: the external screen should show the latest count and color. The `onStateChanged` handler only updates status; it does not reset shared state or rebuild ownership on `waiting`.
4. **Close demo** dismisses the page; native unmounting releases output and the script then exits. This does not stop the user's system Screen Mirroring connection.

Check `waiting` only when the owning page is visible. `suspended` may mean paused output or an App covered by Control Center, rather than a disconnected receiver. Scene state is not a delivery receipt; inspect the receiver separately.
