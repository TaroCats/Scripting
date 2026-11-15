The global `PixelBuffer` class owns native image storage for model inputs, outputs and output backings. It works without importing `scripting`; see [CoreML](scripting://doc?title=CoreML) for inference. To create or read ordinary UIImage pixels, use [UIImage](scripting://doc?title=UIImage).

Create raw NV12 planes, update selected pixel regions, and queue a display snapshot with [PixelBuffer Updates and Display](scripting://doc?title=PixelBuffer%20Updates%20and%20Display).

Use [PixelBuffer Camera Frames](scripting://doc?title=PixelBuffer%20Camera%20Frames) to prepare live camera pixels for models.

## Create a buffer

`PixelBuffer.create({ width, height, format?, data?, bytesPerRow?, colorSpace? })` creates a buffer. Dimensions are pixels; format defaults to `'bgra8'`, color space to `'sRGB'`. Without data the buffer is initialized to zero.

| Format | Raw pixels |
| --- | --- |
| `bgra8` | Four bytes per pixel, in blue/green/red/alpha order. |
| `gray8` | One byte per pixel. |
| `gray16Float` | One IEEE 754 half value per pixel, stored as two raw bytes. |

`data` accepts `Data`, `Uint8Array` or `Uint16Array` raw bytes. Uint16Array values are bit patterns, not numeric conversion to half. `bytesPerRow` describes input row layout and must be at least the tightly packed row size. When supplied, data must cover exactly `bytesPerRow * height` bytes; input padding is not copied to pixels. The returned buffer can have a different native row stride.

```ts
const pixels = PixelBuffer.create({
  width: 2, height: 1, format: 'bgra8',
  data: new Uint8Array([0, 0, 255, 255, 0, 255, 0, 255])
})
try {
  console.log(pixels.description)
  const plane = pixels.copyPlanes()[0]
  console.log(plane.bytesPerRow, plane.data)
} finally {
  pixels.dispose()
}
```

## Convert an image

`PixelBuffer.fromImage(image, { width?, height?, format?, colorSpace? })` applies UIImage orientation, optionally resizes to the requested size, and renders into native storage. Omitted dimensions retain the oriented image's pixel dimensions. Resize fills the requested rectangle; use an explicit crop before conversion or the model's image feature options for another crop/scale policy. Color spaces are `'sRGB'` and `'displayP3'`.

```ts
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const pixels = PixelBuffer.fromImage(image, {
    width: 224, height: 224, format: 'bgra8', colorSpace: 'sRGB'
  })
  try {
    const preview = pixels.toImage()
    console.log(preview.width, preview.height)
  } finally {
    pixels.dispose()
  }
}
```

## Inspect and copy

`description` reports width, height, format, native `pixelFormatCode`, and actual plane sizes/row strides. Native model outputs can use other formats; these report `format: 'native:<code>'` and remain usable as native inference resources.

`copyPlanes()` returns tightly packed Uint8Array bytes for each supported plane. `copyPlanes({ dataType: 'data' })` returns Data instead. Each result contains `width`, `height`, tight `bytesPerRow`, and `data`. Copying excludes native padding and does not expose a live pointer into the buffer. A half-float plane still exports raw bytes, not a Float32Array. Raw copying and `toImage()` are supported only for the formats listed above; unsupported formats report an error.

`toImage()` renders a new UIImage. It is a color-rendering conversion, not a promise to preserve arbitrary HDR values or every attachment byte for byte. It does not provide a continuously updated GPU view.

`CoreML.MultiArray.fromPixelBuffer(pixels, shape)` and `array.pixelBuffer` expose compatible shared native storage. The float16 path uses `gray16Float`; iOS 26+ also supports `gray8` storage for int8 arrays. The last shape dimension matches width and the product of the remaining dimensions matches height, for example `[2, 3, 4]` for width 4 and height 6. It is not a conversion to arbitrary array dtypes. Shared wrappers must obey the same in-use and alias rules as the original storage.

## Ownership

Dispose buffers when unused. A buffer passed to native inference remains retained until native work finishes, including after Promise cancellation or `dispose()`. Reads, writes and output backings cannot conflict with in-flight access to the same storage. Handles belong to one script run. Allocation failures, invalid layouts, unsupported formats and resource-limit failures are reported as errors; use `CoreML.getCapabilities()` to inspect the current limits.

See [Metal PixelBuffer Textures](scripting://doc?title=Metal%20PixelBuffer%20Textures) for shared Float16 or BGRA8 texture views.
