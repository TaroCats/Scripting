The global `CoreML` API runs local Core ML models, manages native arrays and state, performs supported on-device model updates, and inspects model structures and compute plans. No `scripting` import is needed.

Use it from the main script executor. Loading, compilation, prediction and materialization return Promises; model work runs in the background. Core ML support starts at iOS 17 in this bridge. Function inspection, multiple functions, state and Tensor computation require iOS 18; compute-plan and structure inspection require iOS 17.4. Check `CoreML.getCapabilities()` and the individual model's constraints.

## Topics

| API | Contents |
| --- | --- |
| [CoreML.Model](scripting://doc?title=CoreML.Model) | Load, predict, validate and save models; feature values and numeric precision. |
| [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset) | Assets, model functions, source options, configuration and compilation cache. |
| [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray) | Dtypes, shapes, strides, logical copies and pixel-buffer storage. |
| [CoreML.State](scripting://doc?title=CoreML.State) | Model-bound state, batch prediction and output backings. |
| [CoreML.UpdateTask](scripting://doc?title=CoreML.UpdateTask) | Training data, progress, cancellation, saving and subsequent updates. |
| [CoreML.Tensor](scripting://doc?title=CoreML.Tensor) | Factories, operations, indexing, materialization and tensor predictions. |
| [Model Inspection](scripting://doc?title=CoreML%20Model%20Inspection) | Model structures, native compute plans and their availability limits. |
| [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle) | Cancellation, disposal, resource limits, errors and API scope. |

## Related documentation

- [PixelBuffer](scripting://doc?title=PixelBuffer)
- [UIImage](scripting://doc?title=UIImage)
- [Vision](scripting://doc?title=Vision)
