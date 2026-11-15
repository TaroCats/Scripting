import {
  Button,
  Navigation,
  Path,
  Rectangle,
  Script,
  ScrollView,
  Text,
  Toggle,
  VStack,
  modifiers,
  useState,
  type LinearGradient,
} from "scripting"

// The documentation preview uses built-in effects. To try a project shader,
// save this example in a script project, add the documented assets, and enable it here.
const useProjectShader = false

const frame = {
  width: 240,
  height: 72,
}

const blurOffset = {
  width: 24,
  height: 24,
}

const waveOffset = {
  width: 12,
  height: 0,
}

const displacementOffset = {
  width: 16,
  height: 0,
}

const edge: LinearGradient = {
  stops: [
    { color: "red", location: 0 },
    { color: "red", location: 0.5 },
    { color: "blue", location: 0.5 },
    { color: "blue", location: 1 },
  ],
  startPoint: "leading",
  endPoint: "trailing",
}

function makeBuiltInShaders() {
  const args = Shader.Argument
  const library = ShaderLibrary.builtIn

  const blurMap = UIImage.fromRGBA(
    1,
    2,
    new Uint8Array([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]),
  )

  const displacementMap = UIImage.fromRGBA(
    2,
    1,
    new Uint8Array([
      255, 128, 0, 255,
      0, 128, 0, 255,
    ]),
  )

  const tint = library.shader("tint", [
    args.color("yellow"),
    args.float(0.65),
  ])

  const blur = library.shader("variableBlur", [
    args.boundingRect,
    args.image(blurMap),
    args.float(blurOffset.width),
  ])

  const wave = library.shader("wave", [
    args.float(waveOffset.width),
    args.float(48),
    args.float(0),
  ])

  const displacement = library.shader("displacement", [
    args.boundingRect,
    args.image(displacementMap),
    args.float2(displacementOffset.width, displacementOffset.height),
  ])

  return { tint, blur, wave, displacement }
}

type ShaderPreviewProps = {
  builtIn?: ReturnType<typeof makeBuiltInShaders>
  projectShader?: Shader
}

function ShaderPreview({ builtIn, projectShader }: ShaderPreviewProps) {
  const dismiss = Navigation.useDismiss()
  const [enabled, setEnabled] = useState(true)

  const waveModifiers = builtIn
    ? modifiers().distortionEffect({
        shader: builtIn.wave,
        maxSampleOffset: waveOffset,
        isEnabled: enabled,
      })
    : undefined

  return (
    <ScrollView>
      <VStack spacing={16} padding>
        {builtIn ? (
          <Toggle
            title="Apply shader effects"
            value={enabled}
            onChanged={setEnabled}
          />
        ) : (
          <Text>Shader effects are unavailable in this script context.</Text>
        )}

        <Text>Color tint</Text>
        <Rectangle
          fill="red"
          frame={frame}
          colorEffect={
            builtIn && {
              shader: builtIn.tint,
              isEnabled: enabled,
            }
          }
          accessibilityHidden
        />

        <Text>Variable blur</Text>
        <Rectangle
          fill={edge}
          frame={frame}
          layerEffect={
            builtIn && {
              shader: builtIn.blur,
              maxSampleOffset: blurOffset,
              isEnabled: enabled,
            }
          }
          accessibilityHidden
        />

        <Text>Horizontal wave</Text>
        <Rectangle
          fill={edge}
          frame={frame}
          modifiers={waveModifiers}
          accessibilityHidden
        />

        <Text>Texture displacement</Text>
        <Rectangle
          fill={edge}
          frame={frame}
          distortionEffect={
            builtIn && {
              shader: builtIn.displacement,
              maxSampleOffset: displacementOffset,
              isEnabled: enabled,
            }
          }
          accessibilityHidden
        />

        {projectShader && (
          <VStack>
            <Text>Project shader</Text>
            <Rectangle
              fill="red"
              frame={frame}
              colorEffect={{
                shader: projectShader,
                isEnabled: enabled,
              }}
              accessibilityHidden
            />
          </VStack>
        )}

        <Button
          title="Close"
          role="close"
          action={() => {
            dismiss()
          }}
        />
      </VStack>
    </ScrollView>
  )
}

async function run() {
  const capabilities = await ShaderLibrary.getCapabilities()
  const builtIn = capabilities.builtIn ? makeBuiltInShaders() : undefined
  let projectLibrary: ShaderLibrary | undefined
  let projectShader: Shader | undefined

  try {
    if (useProjectShader && capabilities.projectLibraries) {
      try {
        const manifestPath = Path.join(Script.directory, "shaders", "effects.json")
        projectLibrary = await ShaderLibrary.load(manifestPath)
        projectShader = projectLibrary.shader("highlight", [
          Shader.Argument.color("yellow"),
          Shader.Argument.float(0.65),
        ])
      } catch (error) {
        console.error(error)
      }
    }

    await Navigation.present(
      <ShaderPreview
        builtIn={builtIn}
        projectShader={projectShader}
      />,
    )
  } finally {
    await projectLibrary?.dispose()
  }
}

run()
  .catch((error) => {
    console.error(error)
  })
  .finally(() => {
    Script.exit()
  })
