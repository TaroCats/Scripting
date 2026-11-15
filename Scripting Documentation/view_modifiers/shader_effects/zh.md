# SwiftUI 着色器特效

使用 `colorEffect`、`layerEffect` 和 `distortionEffect` 给视图着色、改变图片各处的模糊程度，或扭曲渲染内容。这些修饰符可用于从 `scripting` 导入的视图。`ShaderLibrary` 和 `Shader` 都是全局接口，无需导入即可加载着色器库并使用 `Shader.Argument` 构造参数。

在支持这些修饰符的 SwiftUI 视图上使用着色器。内置库要求 iOS 17 或更高版本，加载预编译库要求 iOS 18 或更高版本和可用的 Metal 设备。调用 `await ShaderLibrary.getCapabilities()` 查询 `builtIn`、`projectLibraries` 和 `platform`（`iphoneos`、`iphonesimulator` 或 `null`）。可以在显示视图之前加载库，包括通过 `scripting-ts project` 和编辑器预览运行已保存的项目。`projectLibraries` 表示当前脚本环境是否支持加载。清单和文件授权在调用 `load()` 时检查。文档里的可运行预览使用内置效果。体验自定义着色器时，请将示例和下文的资源放进已保存的项目中运行。

能力查询反映的是库接口。应用效果时请使用 Scripting 前台支持的视图。当前环境无法弹出权限请求时，请先为脚本授予文件访问权限。请对 `Image`、`Rectangle` 等 SwiftUI 视图使用着色器。网页视图、视频播放器等由 UIKit 承载的视图可能显示为占位内容。[Apple 的 SwiftUI 着色器文档](https://developer.apple.com/documentation/swiftui/shader)

## 修饰符与参数

| 修饰符 | 选项 | 着色器作用 |
| --- | --- | --- |
| `colorEffect` | `{ shader, isEnabled? }` | 返回每个像素的颜色。 |
| `layerEffect` | `{ shader, maxSampleOffset, isEnabled? }` | 对已渲染的视图取样，并返回颜色。 |
| `distortionEffect` | `{ shader, maxSampleOffset, isEnabled? }` | 返回要取样的源坐标。 |

JSX 属性和 `ViewModifiers` 使用相同的选项。`isEnabled` 默认是 `true`，设为 `false` 时显示原视图。`maxSampleOffset` 用 `{ width, height }` 指定每轴的最远采样距离，单位为 point。每轴必须是 0–256 的有限数值。例如，模糊半径为 24 point 时，两个轴上的采样距离都可能达到 24 point，因此两轴都设为 24。

按 Metal 函数签名顺序传入参数。使用 `Shader.Argument` 下的 `float(value)`、`float2(x, y)`、`float3(x, y, z)`、`float4(x, y, z, w)`、`color(value)`、`boundingRect` 和 `image(value)`。数值必须有限且在 32 位浮点数范围内。`color` 接收 Scripting 的颜色字符串。`boundingRect` 提供视图的 `(x, y, width, height)`。`image` 接收 `UIImage`。每个着色器可使用一张额外图片，每边最多 2048 像素。

## 内置特效

用 `ShaderLibrary.builtIn.shader(name, args)` 绑定内置函数。下表列出了参数顺序。

| 着色器 | 修饰符 | 参数 |
| --- | --- | --- |
| `tint` | `colorEffect` | `color`、`float` 混合强度，范围为 0–1 |
| `variableBlur` | `layerEffect` | `boundingRect`、`image`、`float` 最大半径，范围为 0–64 point。图片的红色通道值为 0 时不模糊，为 1 时使用最大半径。 |
| `wave` | `distortionEffect` | `float` 水平振幅，范围为 0–64 point；`float` 波长，至少 1 point；`float` 相位，单位为弧度。位移随垂直位置变化。 |
| `displacement` | `distortionEffect` | `boundingRect`、`image`、`float2` 每轴的幅度，范围为 0–64 point。红色控制水平位移，绿色控制垂直位移。通道值从 0 到 1 分别对应负幅度到正幅度。 |

打开**示例**可查看完整的 `index.tsx`。它演示四种内置特效，也提供可选的项目着色器用法。下面的精简示例用图片控制色块边缘的模糊程度，并通过链式修饰符应用水平波浪。

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
          accessibilityLabel="带可变模糊的色块边缘"
        />
        <Rectangle
          fill={fill}
          frame={{ width: 240, height: 120 }}
          modifiers={waveModifiers}
          accessibilityLabel="带波浪的色块边缘"
        />
        <Button
          title="关闭"
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

## 使用项目中的着色器

在装有 Xcode 和 Metal Toolchain 的 Mac 上将下例保存为 `Effects.metal`。SwiftUI 为 `colorEffect` 提供 `position` 和 `source`，脚本负责绑定其余参数 `tint` 和 `amount`。

```metal
#include <metal_stdlib>
using namespace metal;

[[ stitchable ]] half4 highlight(float2 position, half4 source, half4 tint, float amount) {
    half weight = half(clamp(amount, 0.0f, 1.0f));
    return half4(mix(source.rgb, tint.rgb * source.a, weight), source.a);
}
```

### 在 Mac 上用 Xcode 编译

在项目目录为每个目标平台单独编译。iOS 真机和 Simulator 使用各自的库文件。[Apple 的 Metal 编译指南](https://developer.apple.com/documentation/metal/building-a-shader-library-by-precompiling-source-files)

```sh
mkdir -p shaders
xcrun --sdk iphoneos metal -target air64-apple-ios17.0 -c Effects.metal -o Effects.iphoneos.air
xcrun --sdk iphoneos metal -target air64-apple-ios17.0 Effects.iphoneos.air -o shaders/Effects.iphoneos.metallib
xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator -c Effects.metal -o Effects.iphonesimulator.air
xcrun --sdk iphonesimulator metal -target air64-apple-ios17.0-simulator Effects.iphonesimulator.air -o shaders/Effects.iphonesimulator.metallib
```

### 用 GitHub Actions 编译

没有 Mac 时，把 `Effects.metal` 放到 GitHub 仓库根目录，在默认分支添加下方的 `.github/workflows/build-metal.yml`。这两个文件都可以在 GitHub 网页上创建。GitHub 托管的 macOS runner 会用 Xcode 编译两个目标，生成这些库文件无需签名凭据。 [GitHub 托管 runner](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) · [Apple Metal Toolchain 安装说明](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)

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

在仓库的 **Actions** 页面选择 **Build Metal libraries**，点击 **Run workflow**。成功后打开该次运行，在 **Artifacts** 下载 **metal-libraries**。解压后将两个 `.metallib` 放入 Scripting 项目的 `shaders/` 目录，与下面的清单放在一起。 [手动运行 workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) · [下载构建产物](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)

### 将库加入 Scripting 项目

将以下清单保存为 `shaders/effects.json`。把 JSON 和编译后的库放进项目的 `shaders/` 目录，分享项目时会一并打包。编译后可以删除中间产物 `.air` 文件。只在一个平台运行时，可以省略另一个平台的条目。

`ShaderLibrary.load` 接受绝对文件路径，也接受相对于当前脚本源码目录的路径。JSON 里的库路径始终相对于清单解析后的目录。用绝对路径加载时，把库放在清单同一目录或其子目录内。脚本需要有权限读取清单和库文件。

例如，文件保存在 `Documents/shaders` 时，从 `scripting` 导入 `Path`，用 `Path.join(FileManager.documentsDirectory, "shaders", "effects.json")` 得到清单的绝对路径。

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

清单记录作者提供的 Metal 函数签名，只按顺序列出需要脚本绑定的参数。支持 `float`、`float2`、`float3`、`float4`、`color`、`boundingRect` 和 `image`。函数名必须是唯一的 ASCII Metal 标识符，最多 64 个字符。每份清单最多声明 32 个函数，每个函数最多 16 个参数。App 会按清单检查实参并预编译声明的特效。作者需要确认声明与实际 Metal 签名一致。加载成功无法验证任意 GPU 代码的行为或安全性。编写自定义 `layerEffect` 或 `distortionEffect` 时，请让所有采样保持在 `maxSampleOffset` 范围内。

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
            accessibilityLabel="颜色滤镜预览"
          />
          <Button
            title="关闭"
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

要试用**示例**中的项目着色器，请把示例复制到已安装的脚本项目，加入清单和编译好的库，然后将 `useProjectShader` 设为 `true`。

库只需加载一次，视图打开期间可重复使用该句柄。`shader(name, args)` 同步检查参数数量和类型。库文件更新后，重新加载清单即可获取新内容。释放一个库句柄后，由它创建的着色器会停止应用到视图。脚本退出时，App 会释放剩余句柄。

清单最大为 32 KiB，每个库最大为 8 MiB。每次运行最多同时加载或持有八个项目库。`load` 失败时可通过 `Error.code` 处理。`unsupported` 或 `unsupportedPlatform` 表示当前环境不可用，`accessDenied` 表示文件权限不足，`invalidPath` 表示资源位置无效，`invalidManifest`、`invalidLibrary` 或 `invalidSignature` 表示资源内容有问题。`resourceLimit` 表示达到大小或数量限制，`disposed` 表示脚本或库已释放。修饰符无法应用着色器时，App 显示原视图并在脚本日志中报告错误。
