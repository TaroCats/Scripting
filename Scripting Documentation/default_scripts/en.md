# Default Scripts

Open **More → Default Scripts** to choose both main-app script entries.

- **Home Screen** selects a script containing `home_screen_default_ui.tsx`. That file default-exports a JSX component and runs with `Script.env === "home_screen"`. Turn on **Show Home Tab** in Settings. Long-pressing the Home tab still provides Choose Script, Reload and Clear Selection.
- **Camera Control** selects a TypeScript script containing `index.tsx`. It runs in the main app with `Script.env === "camera_control"`, either to draw its own camera UI or process photos/videos from Scripting's native capture extension. **Open Camera Script** tests this without a hardware camera key.

Selecting a script does not change the iPhone's system Camera Control assignment. Choose Scripting separately in system Camera settings. **Refresh Camera Setup** checks the current access state, updates the selected script for locked capture, and receives completed Lock Screen files. The button shows progress and a completion message; any errors appear separately. Use the latest example code to update an installed DEMO. After changing script storage or restoring a removed script, reselect it if shown as unavailable.

For the system camera target, select a script that provides a real capture experience. If a system camera entry has no working camera and capture interaction after about 3 seconds, Scripting attempts to open its built-in camera. Completed files go to the original script, or remain in Captured Files if it cannot receive them. Shared sessions that cannot be safely released or denied permissions can prevent takeover. **Open Camera Script** does not test those system checks. The same environment is also used for file handoff, which alone does not require starting a camera. Read [System capture entry requirements](../camera_control/).

On iOS 26+, the system camera entry prefers an existing main-app window. Camera prompts stay in the window handling the capture.

If no default camera script is selected, a system camera entry first shows the built-in camera, then opens the script picker. A selection takes effect the next time you open Scripting Camera, as the confirmation explains; the current capture stays saved for manual processing. Cancelling selection keeps the camera open.

**Captured Files** is always available in the Camera Control section. Its count shows photos/videos not yet sent to a script, including 0. The page shows thumbnails; tap a photo to view it or a video to play it. Use the main button to send a batch to the script, or the More menu to export or delete it. Previously delivered batches remain available, but do not contribute to the pending count.

The built-in **Camera Control DEMO** contains both files. Its complete `index.tsx` is in the [Camera Control guide](../camera_control/). Here is its standalone Home tab component:

```tsx
import { Button, Script, Text, VStack, useState } from "scripting"

export default function Home() {
  const [count, setCount] = useState(0)
  return <VStack padding spacing={16}>
    <Text font="title">Default Script Demo</Text>
    <Text>{`Environment: ${Script.env}`}</Text>
    <Text>{`Button count: ${count}`}</Text>
    <Button title="Increment" action={() => setCount(count + 1)} />
    <Text>Select this script for Camera Control in More → Default Scripts to try the camera and captured-file workflow.</Text>
  </VStack>
}
```
