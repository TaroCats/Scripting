# Camera Control

Use the iPhone Camera Control to open Scripting's camera experience. When the system opens the main app, your selected script runs `index.tsx` with `Script.env === "camera_control"` and draws its own UI. This environment has the same API scope as `index` and `home_screen`; system versions, device support, foreground requirements, and script/system permissions still apply.

Camera Control opens a capture experience. Show a visible camera preview and register a working `onCameraCaptureEvent` on the page while capturing. Handle later `Script.onResume` events and restore the capture experience when returning to it; a null camera parameter only means there is no new file batch. Do not leave a stopped camera page on screen or replay a previous batch. In the complete example, **Close** ends capture and releases resources. A file-only handoff does not automatically start the camera; it starts if the user chooses **Start Camera** or returns through the camera entry.

## System capture entry requirements

**When the system opens the main app:** Camera Control and the **Scripting Camera** system control are capture entries. Your custom script is responsible for starting a real camera session, showing its preview and handling capture events. If the script has not started a camera with usable capture interaction after about 3 seconds, Scripting attempts to open its built-in camera. A script that already opened a system camera page keeps that page. The fallback helps during startup; it does not continuously watch the script after capture becomes ready. A script that later stops capture and stays in this entry can still expose the app to system termination. A JS error handler cannot catch a system process termination. Apple describes this intent as an entry to a capture experience; a developer has also [reported termination of the main app](https://developer.apple.com/forums/thread/769024) on earlier iOS versions.

An active viewfinder does not require continuous recording or saving photos/video.

The built-in camera saves completed photos/videos before handing them to the original script through `Script.cameraControlParameter` or `Script.onResume`. If that script cannot accept the files, or the default selection changes, the batch stays in **More → Default Scripts → Camera Control → Captured Files** for manual processing. Scripting waits for the script to release its camera before taking over. Shared camera sessions that cannot be safely stopped, denied permissions, and an unresponsive main thread can prevent fallback; the 3-second wait is not a system guarantee.

If no default camera script is selected, a system entry opens the built-in camera first, then shows the script picker above it. Choosing a script displays a notice that it takes effect the next time you open Scripting Camera. Cancelling the picker leaves the camera open. The current capture is saved for manual processing and is not automatically sent to the newly selected script.

**When the system opens the locked capture extension:** Apple explicitly requires an active camera view, hardware capture interaction and a camera access request; without them the extension can be terminated shortly after launch. Scripting supplies that native camera. See [Apple's capture extension guide](https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen).

**Stopping and cleanup:** The cited documentation does not define a continuous main-app monitoring schedule or guarantee that every stop terminates the app. Do not rely on a fixed grace period or a brief start/stop workaround. Stop/dispose resources on exit; that cleanup is not a guarantee that the system's capture-entry checks have been cleared.

Receiving completed files alone does not require opening another camera. If the same script is selected as the system camera target, also handle the case where the system opens the main app directly for capture. `Script.env === "camera_control"` and a null camera parameter do not prove which entry was used. **Open Camera Script** in the app tests your script, not the system's capture-entry behavior. Use ordinary App, Home or Shortcuts entries for unrelated general-purpose scripts. See [Apple's launch guidance](https://developer.apple.com/videos/play/wwdc2024/10204/?time=882).

## Set up

1. Install the built-in **Camera Control DEMO** from the examples.
2. Open **More → Default Scripts → Camera Control** and select the script. Tap **Open Camera Script** to test it without a hardware camera key.
3. On a supported iPhone, select Scripting in **Settings → Camera → Camera Control**. The system setting is controlled by the user.
4. You can also add the **Scripting Camera** control to Control Center or the Lock Screen.

On iOS 26+, opening Scripting Camera prefers an existing main-app window. Camera messages and script selection appear in the window handling that capture; closing the built-in camera returns to that window.

From the Lock Screen, Scripting provides a native photo/video camera. After capture finishes, tap **Let Scripting Process**. The system authenticates as needed, opens the main app, and hands the files to the selected script. The system decides whether to open the main app or capture extension for each entry; remaining on the Lock Screen after authentication can still use the extension.

The extension does not run your script. The script receives finished files, not the extension's live camera session. A regular launch or direct main-app camera launch has `Script.cameraControlParameter === null`. An extension delivery or a completed built-in fallback capture has a non-null parameter. See [Captured files](capture_handoff/) for the complete contract.

The Lock Screen viewfinder prepares when the capture page appears and shows its startup status. If capture fails or is interrupted, the page explains the problem; capture can resume when available, or you can tap Retry Camera. Finish and save a recording before handing it to a script. Cancelling authentication or failing to open the app preserves completed files. Return to the capture page to continue capturing or tap Let Scripting Process again.

Choose the default script before the first Lock Screen handoff. In Camera Control DEMO, tap a photo or video under Captured files to preview it. If you captured before choosing a script, open More → Default Scripts → Camera Control → Captured Files and tap Let Scripting Process for the saved batch; selecting a script does not silently run old captures.

In the Lock Screen video mode, tap the microphone button beside the mode selector to include sound. A slashed microphone means the video will be silent.

## Build a script camera

Use `AVCaptureSession`, `AVCaptureDeviceInput`, `AVCapturePhotoOutput`, `AVCaptureMovieFileOutput`, and `CaptureVideoPreviewView` for your own main-app camera. Add `onCameraCaptureEvent` to the camera page for physical shutter events, and keep a touch button invoking the same action. Session controls such as zoom still use `supportsControls`, `canAddControl` and `setControlsDelegate`. Secondary events do not mean half-press. Do not attach a second `AVCaptureEventInteraction` to the same page.

The runnable example previews handed-off photos/videos, saves a selected file to Photos only on request, and provides a simple script photo camera when no files are supplied. It requests camera access when starting the camera; viewing already captured files does not start the camera. System capture entries and the new modifier require iOS 18+. Simulator can exercise the page and data flow but cannot reproduce physical camera-key events.

Use the latest **Camera Control DEMO 1.0.2** example. Its **Close** action waits for the camera to stop before dismissing the page. If you already installed an earlier copy, update its `index.tsx` from this example.

Stop/dispose your session and player when the page closes. Stopping while permission is pending cancels that start; it does not authorize a late start after the script exits. Saving to Photos uses the existing Photos permission. Files are not uploaded or automatically added to the photo library.

Camera lifecycle errors should be handled in your script. `startRunning()` rejects if permission is denied, configuration is still open, startup fails, or that start was cancelled. Use synchronous `configure(() => { ... })`, or pair every `beginConfiguration()` with `commitConfiguration()` before starting. Stopping an owned session finishes its open configuration and cancels a pending start; an explicit later start can retry. `dispose()` is final: create a new session to start again.

An uncaught error reported while executing a camera script or a synchronous resume callback ends that script and releases its capture resources. Handle errors in asynchronous work with `try/catch` or `.catch()`; resume callbacks are not awaited. Later resume callbacks for that failed script are not called. Capture controls and capture interaction callbacks stop being delivered after script exit; detached interactions can be reattached while the script is still running. A file-only entry or file resume may process its batch and call `Script.exit()` normally; that completes delivery without keeping a viewfinder open. Uncaught errors still fail delivery. These safeguards do not replace the system capture-entry requirements above.

## Complete index.tsx example

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
