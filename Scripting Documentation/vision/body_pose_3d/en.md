# 3D body pose

Use `Vision.detectBodyPose3D(image, options?)` to estimate the pose of the most prominent person in a still photo on iOS 17 or later. Choose a photo with the whole person visible. The result is an array containing one observation when Vision detects a pose, or an empty array when it detects none.

```ts
const image = UIImage.fromFile('/path/to/full-body-photo.jpg')
if (image && Vision.getCapabilities().requests.bodyPose3D.supported) {
  const [result] = await Vision.perform(image, [Vision.Request.bodyPose3D()])
  const pose = result?.kind === 'bodyPose3D' ? result.observations[0] : undefined
  const wrist = pose?.joints.leftWrist
  if (wrist) {
    const [x, y, z] = wrist.modelTransform.slice(12, 15)
    console.log('Left wrist position in meters', x, y, z)
    console.log('Projection in the image', wrist.imagePoint)
  }
}
```

The request supports the shared `revision` and `regionOfInterest` options. Pass `signal` to `Vision.detectBodyPose3D` or `Vision.perform` to cancel the operation. Use `Vision.getCapabilities().requests.bodyPose3D` to inspect the request's supported revisions, joint names and groups.

## Transforms and coordinates

- `joints` contains named joints and their `parentJoint` values. The native layout has 17 joints. The `root` is between the hips and has no parent. `jointGroups` lists the joints in each available native group, and `jointGroups.all` contains every returned joint.
- `modelTransform` places a joint in the model frame. `localTransform` places it relative to its parent. `cameraRelativeTransform` gives its transform in the camera frame when available.
- `cameraOriginMatrix` is Vision's transform from the model root to the camera's projection center. All four transforms are column-major 4 × 4 matrices. The translation is at indexes 12–14, in meters.
- `imagePoint` is the joint's projected position in the full display-oriented image with normalized coordinates and a lower-left origin. It can be null. Use `Vision.imagePointToView` to place an available point over an aspect-fit preview.
- `bodyHeight` is in meters. `heightEstimation` describes its provenance. `reference` uses Vision's 1.8 m reference height. `measured` denotes an estimate based on depth. `unknown` preserves a future native value.

This API accepts `UIImage` and analyzes its display-oriented pixels. The image path carries no embedded or paired depth to Vision, so plan for reference-height results. Run Demo lets you pick a photo and see its projected skeleton, joint count, and height provenance.

[Vision](scripting://doc?title=Vision) · [Apple's 3D body pose guide](https://developer.apple.com/documentation/vision/identifying-3d-human-body-poses-in-images)
