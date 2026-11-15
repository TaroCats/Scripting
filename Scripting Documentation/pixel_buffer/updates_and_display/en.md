`PixelBuffer.writePlanes()` updates native pixel storage in place. You can write the entire buffer, a rectangle or multiple planes in one call. `AVSampleBufferDisplayLayer.enqueuePixelBuffer()` displays a snapshot of BGRA8 or 8-bit NV12 through `SampleBufferView`.

## Plane layout

`bgra8`, `gray8`, and `gray16Float` have one plane. For `gray16Float`, a `Uint16Array` contains the raw bit patterns of half-precision values. The two NV12 formats use even image dimensions and two planes. Plane 0 is luma with one byte per image pixel. Plane 1 contains interleaved Cb and Cr, two bytes per chroma sample, at half the width and height. Coordinates for each update refer to that plane, with the first row at `y: 0`.

With `nv12VideoRange`, initial luma is 16. With `nv12FullRange`, it is 0. Both initialize chroma to 128 and use BT.709 color attachments. To initialize from bytes, pass `planes` with an entry for each plane. Packed formats can also use the existing `data` and `bytesPerRow` fields. Use `copyPlanes()` to read tightly packed rows, or `description.planes` to inspect native strides.

## Update a region

Each write supplies `plane`, `data` and optional `x`, `y`, `width`, `height` and `bytesPerRow`. With no rectangle, it writes the whole plane. Omitted dimensions extend from the start coordinates to the edge. Source row stride defaults to the minimum byte width of the region. The data must contain exactly `bytesPerRow * height` bytes. One call can write each plane once. All writes are validated before any pixels change. If a model operation is using the same storage, the write fails with `busy`.

```ts
const pixels = PixelBuffer.create({ width: 4, height: 4, format: 'nv12VideoRange' })
try {
  pixels.writePlanes([
    { plane: 0, x: 0, y: 0, width: 2, height: 2, data: new Uint8Array([180, 180, 180, 180]) },
    { plane: 1, x: 0, y: 0, width: 1, height: 1, data: new Uint8Array([90, 180]) },
  ])
  console.log(pixels.copyPlanes()[0].data)
} finally {
  pixels.dispose()
}
```

## Display at a media time

Attach a video renderer to an `AVSampleBufferRenderSynchronizer`. Pass a numeric `MediaTime` on that clock and an optional nonnegative duration. The queue owns its snapshot. You can update or dispose of the source after calling `enqueuePixelBuffer`. The Promise resolves when AVFoundation accepts the sample. Display follows the clock. Raw snapshots share a 64 MiB per-script budget, with up to 32 MiB reserved per snapshot so one frame leaves room for a replacement. See [Sample Buffer Playback](scripting://doc?title=Sample%20Buffer%20Playback) for the clock and view.
