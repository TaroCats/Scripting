In a foreground app script, use `device.makeTextureView({ cameraFrame: frame, plane })` to read a live `AVCaptureVideoFrame` from Metal. It shares the original IOSurface when the device can map the requested plane. Camera Control scripts cannot use this path.

| Frame format | Plane | Metal format |
| --- | --- | --- |
| BGRA8 | 0 | `bgra8Unorm` |
| NV12 full or video range | 0, luma | `r8Unorm` |
| NV12 full or video range | 1, CbCr | `rg8Unorm` |

Use read-only `texture2d` bindings in `dispatch()` or `dispatchBatch()`. NV12 chroma dimensions are half the luma dimensions. The view preserves the delivered pixels, color range and plane ordering. It does not apply additional rotation or mirroring. A color kernel is responsible for applying the appropriate YCbCr matrix and range. Read frame metadata before disposing it if you need rotation, mirroring or color attachments.

Keep the frame alive until submitting the command. A texture view by itself does not keep a discarded camera frame alive. You may dispose the frame immediately after calling dispatch if you don't need it again; queued GPU work holds the sample until it completes. A view cannot be reused with a different frame. Dispose views when finished and check errors from both mapping and dispatch.

If camera access is revoked before submission, dispatch fails. A command already submitted can still write to its output buffers, even if a later permission change prevents its Promise from resolving successfully.

The demo captures a single NV12 frame, reads its central Y, Cb and Cr in Metal, and reports the values as text.
