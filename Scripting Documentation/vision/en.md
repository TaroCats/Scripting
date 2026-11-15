The global `Vision` API recognizes text in images and scans documents. It also analyzes faces, body poses and hand poses in still images and camera frames.

Use [Live Text](scripting://doc?title=Live%20Text) to read all text in a still image or let people select it directly in the image.

Use [Vision Core ML Requests](scripting://doc?title=Vision%20Core%20ML%20Requests) to classify images, detect objects, and read model features.

Use [Vision Tracking](scripting://doc?title=Vision%20Tracking) to follow object boxes and rectangle corners in a sequence.

Use [Vision Image Registration](scripting://doc?title=Vision%20Image%20Registration) to align consecutive images by translation or perspective.

Use [Vision Trajectory Detection](scripting://doc?title=Vision%20Trajectory%20Detection) to measure a moving object’s parabolic path.

Use [Vision Optical Flow](scripting://doc?title=Vision%20Optical%20Flow) to read pixel motion across a frame sequence.

---

## Types

### `RecognizedText`
Represents a block of recognized text.

- `content: string`  
  The recognized text content.

- `confidence: number`  
  Confidence level (between `0.0` and `1.0`) where `1.0` indicates the highest confidence.

- `boundingBox: { x: number, y: number, width: number, height: number }`  
  The bounding box of the recognized text in normalized coordinates.

---

### `RecognizeTextOptions`
Configuration options for text recognition.

- `recognitionLevel?: "accurate" | "fast"`  
  Recognition mode:
  - `"accurate"` (default): Prioritizes accuracy.
  - `"fast"`: Prioritizes speed.

- `recognitionLanguages?: string[]`  
  Preferred recognition languages in ISO language codes, in priority order.

- `usesLanguageCorrection?: boolean`  
  Whether to apply automatic language correction during recognition.

- `minimumTextHeight?: number`  
  Minimum text height to recognize, relative to image height (default `0.03125`).

- `customWords?: string[]`  
  Custom vocabulary to prioritize during word recognition. Only effective when `usesLanguageCorrection` is `true`.

---

## Functions

### `recognizeText(image: UIImage, options?: RecognizeTextOptions): Promise<{ text: string, candidates: RecognizedText[] }>`
Recognizes text from the provided image.

- **Parameters**:
  - `image`: A `UIImage` object.
  - `options` *(optional)*: Recognition options.

- **Returns**:  
  A Promise resolving with:
  - `text`: All recognized text combined into a single string.
  - `candidates`: Array of recognized text blocks with details.

---

### `scanDocument(options?: RecognizeTextOptions): Promise<string[]>`
Scans a document using the device's camera and recognizes text.

- **Parameters**:
  - `options` *(optional)*: Recognition options.

- **Returns**:  
  A Promise resolving with an array of recognized text documents.  
  If the user cancels, the Promise rejects with an error.

---

## Usage Examples

### Recognize text from an image file
```tsx
const image = UIImage.fromFile('/path/to/image.png')
if (image) {
  const result = await Vision.recognizeText(image, {
    recognitionLevel: 'accurate',
    recognitionLanguages: ['en', 'zh-Hans'],
    usesLanguageCorrection: true
  })
  console.log('Recognized Text:', result.text)

  for (const block of result.candidates) {
    console.log(`Text: ${block.content}, Confidence: ${block.confidence}`)
  }
}
```

---

### Scan a document with camera
```tsx
try {
  const documents = await Vision.scanDocument({
    recognitionLevel: 'fast',
    recognitionLanguages: ['en']
  })
  console.log('Scanned Documents:', documents)
} catch (error) {
  console.error('Scan cancelled or failed:', error)
}
```

## Static faces and poses

The global Vision API also analyzes faces, body poses and hand poses in a UIImage. Call it from the main script executor; analysis runs in the background. It does not open the camera or require camera permission. Use captured photos or loaded images as input; live camera-frame analysis is not included here.

```ts
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const pixels = image.toPixels()
  const faces = await Vision.detectFaceLandmarks(image)
  for (const face of faces) {
    const eye = face.landmarks?.regions.leftEye
    if (eye) {
      const points = eye.points.map(p => Vision.imagePointToPixels(
        Vision.facePointToImage(p, face.boundingBox),
        { width: pixels.width, height: pixels.height }
      ))
      console.log(points)
    }
  }
}
```

- detectFaces(image, options?) returns face boxes and available roll/yaw/pitch in radians; unavailable angles are null.
- detectFaceLandmarks(image, options?) adds named face regions, allPoints, confidence, constellation, point classification and available precision estimates. The default constellation is points76; points65 can be requested. Native 76 points are not the common 68-point layout. Precision estimates are not point detection confidence.
- detectBodyPose(image, options?) returns available named joints with x/y/confidence.
- detectHandPose(image, options?) returns named joints with confidence and left/right/unknown chirality. maximumHandCount defaults to 2, supported range 1...16.

Shared options are regionOfInterest, revision and signal. Face landmarks additionally support constellation and either inputFaces (previous observations from the same UIImage) or inputFaceBoundingBoxes (manually supplied normalized face boxes). Observations are retained in a bounded lookup cache; create reusable requests promptly if needed. A reusable request retains the source identity and rejects use with another image. Missing regions/joints remain absent; no detected targets returns an empty array. Observation ids do not identify a person or guarantee stable tracking across calls.

Boxes, ROI and body/hand joints use the full display-oriented image with normalized bottom-left coordinates. Face-region points are normalized within the face box, also bottom-left. UIImage orientation is respected. The helpers facePointToImage, imagePointToPixels and imagePointToView handle face-box placement, top-left pixel conversion, and centered aspectFit/aspectFill layout. For view conversion, pass imageSize, viewSize, optional contentMode and mirrored. Aspect-fill points can fall outside the view. Two-dimensional angles and points do not supply full calibrated 3D pose or depth.

Batch requests share one image handler:

```ts
const requests = [Vision.Request.faces(), Vision.Request.bodyPose()]
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const results = await Vision.perform(image, requests)
  for (const result of results) console.log(result.kind, result.revision, result.observations)
}
```

Request descriptors are immutable and reusable; each execution creates independent native requests. Builder options omit signal; pass signal to perform instead. A batch rejects as a whole when a request fails. A script can have up to two pending jobs, with up to eight requests per job and at most 16 megapixels per image. `Vision.getCapabilities()` reports the wrapper's minimum iOS version, supported revisions/constellations/joint names and limits. Unsupported revisions reject rather than silently changing behavior. Cancellation rejects with code cancelled; native storage remains reserved until the task finishes. Script exit cancels work and discards callbacks.

```ts
const controller = new AbortController()
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const task = Vision.detectFaces(image, { signal: controller.signal })
  controller.abort()
  try { await task } catch (error) { console.log(error) }
}
```

Common input and processing errors include invalidArgument, unsupported, resourceLimit, cancelled, disposed and nativeFailure. Native failures include nativeDomain/nativeCode. Existing OCR and document-scanning return contracts are unchanged. For direct image construction, see [UIImage](scripting://doc?title=UIImage).

## 3D body pose

Estimate a skeleton from a full-body still photo with [Vision 3D Body Pose](scripting://doc?title=Vision%203D%20Body%20Pose).

## Camera frames

Use [Vision Camera Frames](scripting://doc?title=Vision%20Camera%20Frames) to analyze live capture with the same detection and batch APIs.
