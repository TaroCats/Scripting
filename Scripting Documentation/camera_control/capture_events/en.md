# Physical capture events

Add `onCameraCaptureEvent` to the visible main-app camera view on iOS 18+. It accepts `isEnabled` (default true), `primaryAction(event)`, and optional `secondaryAction(event)` (defaults to primaryAction). Events contain `phase: "began" | "ended" | "cancelled"` and `kind: "primary" | "secondary"`.

The camera session must be active. The modifier follows the page's lifecycle and is disabled while its scene is inactive. It is not a background hotkey. Secondary does not mean Camera Control half-press. Do not also attach `AVCaptureEventInteraction` to the same page. Use a touch button with the same capture function, and disable both while a capture is pending.

Stopping capture prevents hardware capture events from reaching the script. Registering this modifier alone does not start a camera or guarantee that the app meets the system's capture-entry requirements. Read [System capture entry requirements](../) before using a custom script as the system camera target; the documented event-delivery rules do not mean that every stop must terminate the app.

The system draws the Camera Control settings overlay; configure its zoom/exposure/custom controls through the existing capture session APIs. Your script draws the main app's page. This complete example handles both resource delivery and a live photo camera.


Attach the interaction to a stable page container so scrolling or replacing the preview does not remove it. Keep a visible viewfinder during the capture experience, including while inspecting a captured file. Disable capture while an operation is pending. In this example, close the page to end a Camera Control capture; a later resume restores the camera without creating a second session.

## Complete index.tsx example

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
