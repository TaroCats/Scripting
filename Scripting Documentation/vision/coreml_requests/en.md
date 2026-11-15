Use `Vision.Request.coreML(model, options?)` to apply a loaded [CoreML](scripting://doc?title=CoreML) image model to a UIImage or [live camera frame](scripting://doc?title=Live%20Camera%20Frames). Pass one or more requests to `Vision.perform`. You can mix model requests with face, hand, or body pose requests in the same batch. Supported on iOS 17 and later.

## Configure a request

- `imageInputName` identifies the model input filled by Vision. Specify it when the model has multiple image inputs. Supply any other required input through `additionalFeatures`, using Core ML input feature values.
- `cropAndScale` controls how Vision prepares pixels. Choose `centerCrop` (the default), `scaleFit`, `scaleFill`, `scaleFitRotate90CCW`, or `scaleFillRotate90CCW`.
- `regionOfInterest` is a normalized rectangle in the oriented image, with a bottom-left origin. Pass any additional camera `orientation` and an optional abort `signal` to `Vision.perform`.
- `revision` selects an available Vision revision. `preferBackgroundProcessing` asks Vision to favor lower resource use. The loaded model keeps its Core ML configuration. Use direct `CoreML.Model.predict` for models that require a state handle.

The descriptor copies the additional feature records when created. Native handles must stay valid while the descriptor is reused. Edits to a supplementary PixelBuffer or MultiArray between calls apply to the next call.

## Read observations

| `type` | Data |
| --- | --- |
| `classification` | Model label and confidence. |
| `recognizedObject` | Native normalized bounding box, overall confidence, class labels, and a segmentation mask when supplied by Vision. |
| `image` | PixelBuffer in the model output's dimensions, plus the feature name when available. |
| `featureValue` | Named Core ML feature, such as a scalar, dictionary, or MultiArray. |

A request can return several observation types. Vision supplies the order and confidence values. For detections, use the returned rectangle as Vision reports it for the chosen crop mode and ROI. A model may expose additional features through direct Core ML prediction. Results can share the identity of a supplied Core ML buffer or array. Images that share camera frame storage are copied. Dispose result buffers and arrays when you finish with them.

```ts
async function classifyPhoto(model: CoreML.Model, photo: UIImage, signal: AbortSignal) {
  const request = Vision.Request.coreML(model, { cropAndScale: 'centerCrop' })
  const [result] = await Vision.perform(photo, [request], { signal })
  if (result.kind !== 'coreML') throw new Error('Expected a model result.')
  const labels: Vision.CoreMLClassificationObservation[] = []
  for (const observation of result.observations) {
    if (observation.type === 'classification') labels.push(observation)
    if (observation.type === 'image') observation.pixelBuffer.dispose()
    if (observation.type === 'recognizedObject') observation.globalSegmentationMask?.pixelBuffer.dispose()
    if (observation.type === 'featureValue') {
      const feature = observation.value
      if (feature.type === 'image' || feature.type === 'multiArray') feature.value.dispose()
    }
  }
  return labels
}
```

The demo includes a small offline classifier. Choose the red or blue half of one image and compare the results.
