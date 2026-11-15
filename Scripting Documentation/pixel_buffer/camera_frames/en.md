`PixelBuffer.fromCaptureFrame(frame, options?)` copies a live [camera frame](scripting://doc?title=Live%20Camera%20Frames) into an independent buffer. Dispose the frame once the call returns. The resulting pixels can be used by [CoreML](scripting://doc?title=CoreML), modified with `writePlanes`, or converted to a UIImage.

- The default preserves the delivered BGRA or NV12 format, dimensions, and propagating color attachments. You can also request the delivered NV12 format explicitly for an unchanged copy. Other camera layouts are converted to BGRA when supported by Core Image.
- Use `format: 'bgra8'` for RGB/BGR model inputs, or `'gray8'` or `'gray16Float'` for a grayscale model that requires that format. Grayscale conversion uses gamma 2.2. BGRA conversion defaults to sRGB and supports Display P3.
- `orientation` is an additional EXIF transform applied to the delivered pixels. It defaults to `'up'`. A quarter turn swaps the default width and height. `width` and `height` stretch the oriented image to the requested size. Transforming an image with no format specified produces BGRA.
- To associate a prediction or a display submission with the original frame, read `frame.info.presentationTime` before disposing the frame. The copy is synchronous, so choose the model's input size and use `nextFrame` to process one frame at a time.

This example assumes a running capture session and a model whose `image` input is a 224 × 224 color image. Read your model's description for its input name and constraints. The caller owns the returned outputs.

```ts
async function predictCameraImage(
  model: CoreML.Model,
  frames: AVCaptureVideoDataOutput,
  signal: AbortSignal,
) {
  const frame = await frames.nextFrame({ signal })
  const time = frame.info.presentationTime
  let pixels: PixelBuffer
  try {
    pixels = PixelBuffer.fromCaptureFrame(frame, {
      format: 'bgra8', width: 224, height: 224, orientation: 'up',
    })
  } finally {
    frame.dispose()
  }
  try {
    const outputs = await model.predict({ image: { type: 'image', value: pixels } }, { signal })
    return { time, outputs }
  } finally {
    pixels.dispose()
  }
}
```

The demo captures one frame and shows both the original layout and a resized BGRA preview. It runs without downloading a model.
