Pass an `AVCaptureVideoFrame` to `Vision.perform`, `Vision.detectFaces`, `Vision.detectFaceLandmarks`, `Vision.detectBodyPose`, `Vision.detectBodyPose3D`, or `Vision.detectHandPose`. Vision reads the original camera sample and its attachments. Read the frame's sequence and `presentationTime` to associate observations with capture timing. See [Live Camera Frames](scripting://doc?title=Live%20Camera%20Frames) for camera setup.

## Direction and coordinates

By default, Vision analyzes the pixels as delivered. Rotation and mirroring already applied by the capture connection are part of those pixels. When the subject still appears sideways or upside down, pass `orientation` for the analysis. Choose `up`, `down`, `left`, `right`, or the corresponding `upMirrored`, `downMirrored`, `leftMirrored`, or `rightMirrored` EXIF orientation.

Normalized observations and `regionOfInterest` use the analyzed image with a bottom-left origin. For `left`, `right` and their mirrored variants, swap the pixel width and height when converting normalized observations to that orientation. `inputFaces` can reuse detections from the same active frame and analysis orientation. Match the preview's crop and mirroring separately if you draw on it.

## Capture and analysis lifetime

Keep the frame alive until the analysis settles, then call `dispose()` in a `finally` block. Cancelling the operation, stopping or reconfiguring capture, or disposing the frame prevents result delivery. Capture can replace unconsumed frames while analysis is running. Request another frame after disposing the previous one to keep latency and memory bounded. Each call performs independent analysis, with up to two pending jobs and eight requests per batch.

```ts
async function analyze(output: AVCaptureVideoDataOutput, signal?: AbortSignal) {
  const frame = await output.nextFrame({ signal })
  try {
    const { presentationTime } = frame.info
    const results = await Vision.perform(frame, [Vision.Request.faces(), Vision.Request.bodyPose()], { signal })
    return { presentationTime, results }
  } finally {
    frame.dispose()
  }
}
```

The demo analyzes one frame at a time and reports face, body and hand counts. Grant camera access and select the direction that makes the subject upright. Use [Vision](scripting://doc?title=Vision) for the result types and coordinate helpers.
