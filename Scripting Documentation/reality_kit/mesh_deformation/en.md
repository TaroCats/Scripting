# RealityKit Mesh Deformation Stacks

Mesh deformation stacks apply ordered stages to meshes in foreground App scripts on iOS 27 or later. Check `RealityKit.getCapabilities().meshDeformationStacks` and `customMeshDeformers` before using them.

## Choose targets and stages

Use `entity.deformationTargets()` to find a standard mesh resource's model, instance and part names. Each stack contains one or more targets and a list of stages in execution order.

- `{ kind: "all" }` selects the mesh.
- `{ kind: "model", name, part? }` selects the named model across its instances.
- `{ kind: "instance", name, part? }` selects one instance. Omit `part` to include all its parts.

Each rendered part can belong to one target across the stacks. A replacement with invalid targets or stages leaves the current stack in place. Parts outside the selected targets keep their existing deformation stages. Read the configuration with `entity.deformationStacks()`. Call `entity.removeDeformationStacks()` to restore the configuration that preceded the script's stack.

| Stage | Geometry or data |
| --- | --- |
| `blendShapes` | Blend shapes on all selected parts. Set weights with `entity.setBlendShapeWeights()`. |
| `skinning` | Skin weights and a skeleton. Set `tangentFrame: true` to deform the tangent frame with the mesh. |
| `subdivision` | Imported subdivision topology, reported by `hasSubdivisionTopology`. |
| `renormalize` | Runs RealityKit’s tangent-frame stage. |
| `bounds` | Updates bounds for render culling. Place it after stages that change vertex positions. |
| `custom` | A `MeshDeformer` that modifies positions on the CPU or GPU. |

With custom position changes on the tested 27.2 runtime, lighting continued to use the authored normals after `renormalize`. The `bounds` stage affects visibility during rendering. `entity.bounds()` still reports the authored geometry bounds.

## CPU displacements

Create a stage with a uniform translation, packed XYZ offsets, or both. Each selected part must have the same vertex count as the offset stream. Create the stage once and update it as controls change. Updates affect every use of that stage.

```ts
function movePart(entity: RealityKit.Entity, name: string, part: string) {
  const deformer = RealityKit.MeshDeformer.cpuDisplacement({ translation: [0, 0.1, 0] })
  entity.setDeformationStacks([{
    targets: [{ kind: "model", name, part }],
    stages: [{ kind: "custom", deformer }, { kind: "bounds" }],
  }])
  deformer.setDisplacement({ translation: [0, 0.2, 0] })
  return deformer
}
```

## Metal kernels

Compile a trusted local `.metallib` for the platform running the script. Device and Simulator libraries are separate builds. Supply its local file path, kernel name and number of Float32 parameters. Use a kernel that writes one position per dispatched thread and checks the vertex index against `vertexCount`.

| Buffer index | Kernel declaration |
| --- | --- |
| 0 | `device const packed_float3 *input` |
| 1 | `device packed_float3 *output` |
| 2 | `constant uint &vertexCount` |
| 3 | `constant float *parameters` when the parameter count is greater than zero |

The kernel receives packed position buffers for the current part. Positions begin as a copy of the input. Supply up to 256 finite parameter values through `setParameters()`, in the order used by the kernel. Place Metal stages and CPU stages with per-vertex offsets before subdivision.

```ts
async function twist(entity: RealityKit.Entity, path: string) {
  const kernel = await RealityKit.MeshDeformer.loadMetal({
    path, functionName: "twistPositions", parameterCount: 1,
  })
  kernel.setParameters(new Float32Array([0.5]))
  entity.setDeformationStacks([{
    targets: [{ kind: "all" }],
    stages: [{ kind: "custom", deformer: kernel }, { kind: "bounds" }],
  }])
}
```

Save the following as `Twist.metal` and build `Twist.metallib` with the Xcode Metal toolchain. Pass the resulting file path to `twist`.

```metal
#include <metal_stdlib>
using namespace metal;

kernel void twistPositions(device const packed_float3 *input [[buffer(0)]],
                           device packed_float3 *output [[buffer(1)]],
                           constant uint &vertexCount [[buffer(2)]],
                           constant float *parameters [[buffer(3)]],
                           uint index [[thread_position_in_grid]]) {
  if (index >= vertexCount) return;
  float3 p = float3(input[index]);
  float angle = p.y * parameters[0];
  float c = cos(angle);
  float s = sin(angle);
  output[index] = packed_float3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
```

For an iPhone or iPad, use the `iphoneos` SDK. For Simulator, use `iphonesimulator`.

```sh
xcrun --sdk iphoneos metal -c Twist.metal -o Twist.air
xcrun --sdk iphoneos metallib Twist.air -o Twist.metallib
```

See [Apple's mesh deformation reference](https://developer.apple.com/documentation/realitykit/scene-content-mesh-deformation).
