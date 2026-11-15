Use `device.makeTextureView({ pixelBuffer })` to share an existing `PixelBuffer` with Metal compute. The view uses the same pixel storage, so you can bind it without copying bytes through JavaScript. Create a buffer with `metalCompatible: true` when you control its allocation. A buffer must have a mappable IOSurface; a source that cannot be mapped raises an error.

Supported formats for this view are `bgra8` → `bgra8Unorm` and `gray16Float` → `r16Float`. Both use plane 0. Supply a read-only 2D texture binding in your kernel, for example `texture2d<half, access::read>`. Pass `textures: [{ index: 0, texture }]` in `dispatch()` or a batch command. The texture has the native pixel dimensions and does not resize, rotate, or color-convert the source.

Image outputs from Core ML are `PixelBuffer` objects. Use the actual returned `feature.value` as the texture source. If you supplied a matching buffer via `outputBackings` for a single prediction, check `feature.value === backing` to find out whether Core ML returned it. The model may return a different buffer, including one without a shareable surface. Handle a mapping error and choose an explicit pixel copy when needed. A `CoreML.MultiArray` can be shared only when its `pixelBuffer` is present and can be mapped. The texture view does not control how Core ML prepares or runs the model.

Keep the source alive until you no longer need to start new commands with the view. Wait for Metal to finish before updating the source or using the shared storage in another prediction. Disposing the source prevents new submissions; an already admitted GPU command retains its resources until completion. Dispose unused views to release their shared storage reservation.

The demo writes four values through a Float16 MultiArray, then uses a Metal kernel to read them through the same pixel storage. The result is shown as text.

See [Metal Camera Textures](scripting://doc?title=Metal%20Camera%20Textures) for zero-copy views of live camera frames.
