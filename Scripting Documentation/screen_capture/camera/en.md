# Screen Capture: Camera Effects

Use `scope: "app"` with `picker.showsCameraControl: true`. The user must enable the camera in the system picker; read `selection.isCameraEnabled`, then obtain an existing `AVCaptureDevice` and call `addVideoEffectOutput(device)`. The camera also needs its own system authorization. Full-display sharing does not support this in-app camera output.

The system manages the floating camera preview and attaches it to the application's key window; no custom JSX preview or native view handle is exposed by this framework. `cameraDevice` reports the current device, and `setCameraDevice(device)` switches to another connected video camera. The API does not restrict you to front cameras.

Observe `state`, `onStateChanged` and `onError`. `stop()` removes the effect and waits for its native stop notification so it can be safely replaced. Session shutdown also removes it. Use recording or raw outputs on the same stream to consume captured content; a preview alone does not create a recording file.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
