# SwiftUI Shader Effects

Use `colorEffect`, `layerEffect`, and `distortionEffect` to tint a view, vary the blur across an image, or distort the rendered content. These modifiers are available on views from `scripting`. `ShaderLibrary` and `Shader` are globals. Load libraries and create arguments with `Shader.Argument` directly in your script without importing either global.

Use these modifiers in a supported SwiftUI view. The built-in library requires iOS 17 or later. Loading a precompiled library requires iOS 18 or later and a Metal device. Use `await ShaderLibrary.getCapabilities()` to check `builtIn`, `projectLibraries`, and `platform` (`iphoneos`, `iphonesimulator`, or `null`). The library can be loaded before any view is presented, including in `scripting-ts project` and saved editor previews. `projectLibraries` describes the current script context. The manifest and file permissions are checked when you call `load()`. The runnable documentation preview uses the built-in effects. To try a custom shader, run the example from a saved project with the assets below.

The capability flags describe the library API. Apply the effect in a supported foreground Scripting view. If your script cannot show a permission prompt, grant file access before running it. Use SwiftUI views such as `Image` and `Rectangle` as shader inputs. UIKit-backed views such as web views and video players can render as placeholders. [Apple's SwiftUI shader documentation](https://developer.apple.com/documentation/swiftui/shader)

## Modifiers and arguments

| Modifier | Options | What the shader does |
| --- | --- | --- |
| `colorEffect` | `{ shader, isEnabled? }` | Returns the color of each pixel. |
| `layerEffect` | `{ shader, maxSampleOffset, isEnabled? }` | Samples the rendered view and returns a color. |
| `distortionEffect` | `{ shader, maxSampleOffset, isEnabled? }` | Returns the source coordinate to sample. |

Use the same options with JSX props and `ViewModifiers`. Set `isEnabled: false` to display the view without the effect. It defaults to `true`. `maxSampleOffset` takes `{ width, height }` in points. Each axis must be finite and in the range 0–256. Specify the furthest distance the shader may sample on each axis. For example, a blur with a radius of 24 points can sample up to 24 points in either direction, so set both axes to 24.

Pass arguments in Metal signature order. Use `Shader.Argument.float(value)`, `float2(x, y)`, `float3(x, y, z)`, `float4(x, y, z, w)`, `color(value)`, `boundingRect`, and `image(value)`. Numbers must be finite and fit a 32-bit float. `color` takes a Scripting color string. `boundingRect` supplies the view bounds as `(x, y, width, height)`. `image` takes a `UIImage`. Each shader can use one extra image up to 2048 pixels on each side.

## Built-in effects

Use `ShaderLibrary.builtIn.shader(name, args)` with the following argument order.

| Shader | Modifier | Arguments |
| --- | --- | --- |
| `tint` | `colorEffect` | `color`, `float` amount from 0 to 1 |
| `variableBlur` | `layerEffect` | `boundingRect`, `image`, `float` maximum radius from 0 to 64 points. A red channel value of 0 gives no blur and 1 gives the maximum radius. |
| `wave` | `distortionEffect` | `float` horizontal amplitude from 0 to 64 points, `float` wavelength of at least 1 point, `float` phase in radians. The displacement varies along the vertical axis. |
| `displacement` | `distortionEffect` | `boundingRect`, `image`, `float2` amplitude from 0 to 64 points per axis. Red controls the horizontal offset and green controls the vertical offset. Channel values from 0 to 1 map from negative to positive amplitude. |

Open **Example** to view the complete `index.tsx`. It compares the four built-in effects and includes an optional project shader. The shorter example below varies blur along a colored edge and applies a horizontal wave with a chain of modifiers.

```tsx
import {
  Button,
  Navigation,
  Rectangle,
  Script,
  VStack,
  modifiers,
} from "scripting"

async function main() {
  const { builtIn } = await ShaderLibrary.getCapabilities()
  const strength = UIImage.fromRGBA(
    1,
    2,
    new Uint8Array([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  )

  const blur = builtIn
    ? ShaderLibrary.builtIn.shader("variableBlur", [
        Shader.Argument.boundingRect,
        Shader.Argument.image(strength),
        Shader.Argument.float(24),
      ])
    : undefined

  const wave = builtIn
    ? ShaderLibrary.builtIn.shader("wave", [
        Shader.Argument.float(12),
        Shader.Argument.float(40),
        Shader.Argument.float(0),
      ])
    : undefined

  const fill = {
    stops: [
      { color: "red" as const, location: 0 },
      { color: "red" as const, location: 0.5 },
      { color: "blue" as const, location: 0.5 },
      { color: "blue" as const, location: 1 },
    ],
    startPoint: "leading" as const,
    endPoint: "trailing" as const,
  }

  function Preview() {
    const dismiss = Navigation.useDismiss()
    const waveModifiers = wave
      ? modifiers().distortionEffect({
          shader: wave,
          maxSampleOffset: { width: 12, height: 0 },
        })
      : undefined

    return (
      <VStack spacing={16}>
        <Rectangle
          fill={fill}
          frame={{ width: 240, height: 120 }}
          layerEffect={
            blur && {
              shader: blur,
              maxSampleOffset: { width: 24, height: 24 },
            }
          }
          accessibilityLabel="Colored edge with variable blur"
        />
        <Rectangle
          fill={fill}
          frame={{ width: 240, height: 120 }}
          modifiers={waveModifiers}
          accessibilityLabel="Colored edge with a wave"
        />
        <Button
          title="Close"
          role="close"
          action={() => {
            dismiss()
          }}
        />
      </VStack>
    )
  }

  await Navigation.present(<Preview />)
}

main()
  .catch((error) => {
    console.error(error)
  })
  .finally(() => {
    Script.exit()
  })
```

## Use a shader from your project

On a Mac with Xcode and the Metal Toolchain, save this example as `Effects.metal`. SwiftUI supplies `position` and `source` for `colorEffect`. Your script binds the remaining `tint` and `amount` parameters.

```metal
#include <metal_stdlib>
using namespace metal;

[[ stitchable ]] half4 highlight(float2 position, half4 source, half4 tint, float amount) {
    half weight = half(clamp(amount, 0.0f, 1.0f));
    return half4(mix(source.rgb, tint.rgb * source.a, weight), source.a);
}
```

### Compile with Xcode on a Mac

From the project directory, compile a separate library for each platform you intend to run on. The iOS device and Simulator libraries are separate files. [Apple's Metal compilation guide](https://developer.apple.com/documentation/metal/building-a-shader-library-by-precompiling-source-files)

```sh
mkdir -p shaders
xcrun --sdk iphoneos metal -target air64-apple-ios17.0 -c Effects.metal -o Effects.iphoneos.air
xcrun --sdk iphoneos metal -target air64-apple-ios17.0 Effects.iphoneos.air -o shaders/Effects.iphoneos.metallib
xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator -c Effects.metal -o Effects.iphonesimulator.air
xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator Effects.iphonesimulator.air -o shaders/Effects.iphonesimulator.metallib
```

### Compile with GitHub Actions

If you do not have a Mac, put `Effects.metal` at the root of a GitHub repository and add the following workflow at `.github/workflows/build-metal.yml` on the default branch. You can create both files in the GitHub web editor. GitHub's hosted macOS runner compiles both targets with Xcode. Building these library files requires no signing credentials. [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) · [Apple Metal Toolchain setup](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)

```yaml
name: Build Metal libraries

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: macos-26
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Prepare Metal Toolchain
        run: |
          xcodebuild -version
          if ! xcrun --sdk iphoneos metal --version; then
            xcodebuild -downloadComponent MetalToolchain
          fi

      - name: Compile device and Simulator libraries
        run: |
          set -euo pipefail
          mkdir -p shaders
          xcrun --sdk iphoneos metal -target air64-apple-ios17.0 -c Effects.metal -o "$RUNNER_TEMP/Effects.iphoneos.air"
          xcrun --sdk iphoneos metal -target air64-apple-ios17.0 "$RUNNER_TEMP/Effects.iphoneos.air" -o shaders/Effects.iphoneos.metallib
          xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator -c Effects.metal -o "$RUNNER_TEMP/Effects.iphonesimulator.air"
          xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator "$RUNNER_TEMP/Effects.iphonesimulator.air" -o shaders/Effects.iphonesimulator.metallib

      - uses: actions/upload-artifact@v7
        with:
          name: metal-libraries
          path: |
            shaders/Effects.iphoneos.metallib
            shaders/Effects.iphonesimulator.metallib
          if-no-files-found: error
```

In the repository's **Actions** tab, select **Build Metal libraries** and click **Run workflow**. After it succeeds, open the run and download **metal-libraries** from **Artifacts**. Extract the two `.metallib` files into your Scripting project's `shaders/` directory beside the manifest below. [Run a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) · [Download artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)

### Add the library to Scripting

Save this manifest as `shaders/effects.json`. Keep the JSON and compiled libraries in a project folder such as `shaders/` to include them when you share the project. You can remove the intermediate `.air` files after compilation. You can omit a platform entry if you only intend to run on the other platform.

`ShaderLibrary.load` accepts an absolute file path or a path relative to the current script source directory. Library entries in the JSON are always relative to the resolved manifest directory. Keep the library in that directory or a subdirectory when loading by absolute path. The script must have file access to both the manifest and the library.

For example, if the shader files are saved under `Documents/shaders`, build the manifest path with `Path.join(FileManager.documentsDirectory, "shaders", "effects.json")`. Import `Path` from `scripting`.

```json
{
  "version": 1,
  "libraries": {
    "iphoneos": "Effects.iphoneos.metallib",
    "iphonesimulator": "Effects.iphonesimulator.metallib"
  },
  "functions": [
    {
      "name": "highlight",
      "effect": "colorEffect",
      "arguments": ["color", "float"]
    }
  ]
}
```

The manifest records the Metal function signature you provide. List only the arguments you bind, in order. Use `float`, `float2`, `float3`, `float4`, `color`, `boundingRect`, or `image`. Function names must be unique ASCII Metal identifiers up to 64 characters. Each manifest can declare up to 32 functions with up to 16 arguments each. The app checks your bindings against the manifest and precompiles the declared effects. Check that the declaration matches the actual Metal signature. A successful load cannot verify the behavior or safety of arbitrary GPU code. For custom `layerEffect` and `distortionEffect` functions, keep all sampling within `maxSampleOffset`.

```tsx
import {
  Button,
  Navigation,
  Path,
  Rectangle,
  Script,
  VStack,
} from "scripting"

async function main() {
  const { projectLibraries } = await ShaderLibrary.getCapabilities()
  let library: ShaderLibrary | undefined

  if (projectLibraries) {
    try {
      const manifestPath = Path.join(Script.directory, "shaders", "effects.json")
      library = await ShaderLibrary.load(manifestPath)
    } catch (error) {
      console.error(error)
    }
  }

  try {
    const shader = library?.shader("highlight", [
      Shader.Argument.color("yellow"),
      Shader.Argument.float(0.65),
    ])

    function Preview() {
      const dismiss = Navigation.useDismiss()
      return (
        <VStack spacing={16}>
          <Rectangle
            fill="red"
            frame={{ width: 240, height: 120 }}
            colorEffect={shader ? { shader } : undefined}
            accessibilityLabel="Color filter preview"
          />
          <Button
            title="Close"
            role="close"
            action={() => {
              dismiss()
            }}
          />
        </VStack>
      )
    }

    await Navigation.present(<Preview />)
  } finally {
    await library?.dispose()
  }
}

main()
  .catch((error) => {
    console.error(error)
  })
  .finally(() => {
    Script.exit()
  })
```

To try the project shader from **Example**, copy the example into an installed script project, add the manifest and compiled library, then set `useProjectShader` to `true`.

Load the library once and reuse its handle while the view is open. `shader(name, args)` checks the argument count and types synchronously. Reload the manifest to pick up an updated library. When you dispose a library, shaders created from that handle stop applying to views. The app releases any remaining handles when the script exits.

Manifests are limited to 32 KiB and libraries to 8 MiB each. A script can have up to eight project libraries loaded or loading at once. A failed `load` rejects with `Error.code`. Check `unsupported` or `unsupportedPlatform` for availability, `accessDenied` for file permissions, `invalidPath` for the resource location, and `invalidManifest`, `invalidLibrary`, or `invalidSignature` for problems with the files. `resourceLimit` indicates a size or handle limit. `disposed` indicates that the script or library has already been released. If a modifier cannot apply a shader, the app displays the original view and reports the error in the script log.
