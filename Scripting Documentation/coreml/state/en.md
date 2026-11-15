On iOS 18+, `model.makeState()` creates state bound to that exact model/function instance. Pass it to `predict(inputs, { state })`. `state.copyBuffer(name)` returns an independent MultiArray; `writeBuffer(name, data)` copies logical values into the named state buffer. State cannot be read, written or reset during native prediction. Predictions sharing state execute serially. A failed or cancelled stateful operation can have advanced the native state; call `reset()` before reusing it. Reset creates fresh state, not a rollback of the previous operation.

`predictBatch(inputs)` preserves input order and returns all results together. It does not accept one shared State or outputBackings as a substitute for native stateful batches.

For single predictions, `outputBackings` maps output names to suitably shaped and typed MultiArrays or PixelBuffers. Core ML may choose a different allocation. Compare the returned resource object with the supplied backing to learn whether it was used. Inputs and writable backings must not overlap, including wrappers sharing storage. A resource in native use cannot be mutated or copied until that work finishes. No zero-copy or backing-reuse guarantee is implied.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle)
