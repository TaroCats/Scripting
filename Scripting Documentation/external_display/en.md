# External Display

Show an independent image on a connected display while keeping controls on the device. Connect AirPlay **Screen Mirroring** in Control Center, or attach a physical display; this API does not choose or connect receivers. Media output selection and screen mirroring are different system operations.

`ExternalDisplay.createPresentation(): Promise<ExternalDisplayPresentation>` requires a foreground main App script with its own visible page. Call it from a button or after the page appears. It registers presentation intent and can resolve while no display is connected. Only one image handle or `ExternalDisplayContent` may own the App's external presentation; competing requests reject instead of replacing another script.

```tsx
import { Button, Navigation, Text, VStack } from "scripting"
let display: ExternalDisplayPresentation | null = null
try {
  await Navigation.present({ element: <VStack>
    <Text>Use Control Center to connect a display.</Text>
    <Button title="Show image" action={async () => {
      display ??= await ExternalDisplay.createPresentation()
      display.onStateChanged = state => console.log(state)
      const image = UIImage.fromFile("/absolute/path/to/image.png")
      if (image) await display.setImage(image, { contentMode: "fit" })
    }}/>
  </VStack> })
} finally { display?.dispose() }
```

The handle exposes:

- `state`: `waiting`, `presenting`, `suspended`, or terminal `disposed`. `waiting` means the visible owner is offering content without a foreground external scene. `suspended` includes a hidden/minimized owner, disabled output or an inactive App. A foreground noninteractive scene may be visible without receiving input events. `presenting` reflects the system scene lifecycle; verify actual receiver output separately.
- `displayInfo`: `{width, height, scale}` from the current external scene, or `null` when disconnected. Dimensions are points. Read again after state or geometry changes; no receiver identity, physical size or transport is inferred.
- `onStateChanged`: callback or `null`; changes only. Subscribe, then read `state` for its initial value. A disconnected display returns to waiting when the host remains visible. A hidden owner resumes when the system makes its scene available again.
- `setImage(image, options?): Promise<void>`: replaces the retained image. `contentMode` is `"fit"` (default) or `"fill"`; `backgroundColor` defaults to black and accepts supported color strings. Use a single-frame UIImage of at most 4096 by 4096 pixels. Invalid input rejects with TypeError; animated and larger images are rejected. The API retains one image; it does not download or queue images. Completion means native content was accepted, not that the receiver displayed it.
- `clear(): Promise<void>`: releases the image and shows black, retaining ownership.
- `dispose(): void`: idempotently releases content, window, registration and callbacks. Create a new handle to present again. Script exit also disposes the presentation. Cleanup remains available after access loss.

Access-denied operations reject or throw with `name: "NotAllowedError"`, `code: "ERR_PRO_REQUIRED"`. UI-less scripts, extensions, widgets, remote renderers and background JS threads are unsupported. No audio-session configuration or AVPlayer settings are changed.

iOS 27+ uses a scene accessory on the owning page; earlier supported systems use an external noninteractive scene. The system decides which connected display receives content and when it appears. There is no API to start/stop mirroring, list receivers or force a specific display. Detaching a handle does not disconnect a user's AirPlay session.

For state-driven layouts, use [ExternalDisplayContent](../views/external_display_content/en.md). Keep an equivalent readable status and all actions on the device; external content is noninteractive. See [AirPlay](../airplay/en.md) for media routing.

## Run the complete demo

Open the documentation's example entry, or use [the complete index.tsx](index.tsx) as a script's entry file and run it in the main App. No image files or downloads are needed: `ImageRenderer` creates a 960 × 540 image at scale 1. Run one external-display demo at a time, since image and JSX presentations share ownership.

1. Tap **Show image**, connect **Screen Mirroring** in Control Center, then close Control Center and return to the demo. The receiver should show EXTERNAL IMAGE and COUNT 0, while the device keeps its buttons and readable status.
2. Tap **Increment and update image**. The same local counter is rendered into the new image. **Clear image** shows black while retaining the handle; **Release presentation** frees ownership. **Close demo** also releases the handle, including a handle that finishes creating after the page closes.
3. Stop Screen Mirroring, close the system panels, and keep the demo open. The visible owner returns to `waiting`; its handle and last image remain. Increment while disconnected, then reconnect through Control Center and return to the page. The latest image and local count should remain; the demo does not create a second handle on a waiting event.

`suspended` can occur while Control Center or another system panel covers the App; it does not prove disconnection. Return to the visible page before checking `waiting` or `presenting`. The demo displays native scene state and geometry, and reports errors locally. Confirm the actual receiver picture separately.
