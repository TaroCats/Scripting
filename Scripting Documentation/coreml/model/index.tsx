import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

// Project-owned fixture that returns the supplied 2×2 image.
const modelBase64 = "CAMSrAEKBwoBeBoCEgAKEQoFaW1hZ2UaCCIGCAIQAhgeUgcKAXkaAhIAUhEKBWltYWdlGggiBggCEAIYHqIGcQpMUHJvamVjdC1vd25lZCBkZXRlcm1pbmlzdGljIENvcmUgTUwgYnJpZGdlIHRlc3QgZml4dHVyZTsgbm8gdHJhaW5lZCB3ZWlnaHRzLhIBMRoeU2NyaXB0aW5nIENvcmVNTCB0ZXN0IGZpeHR1cmVz0gyqAQqnAQgBEokBCgcKAXgaAhIAUgcKAXkaAhIAWgF5ogZxCkxQcm9qZWN0LW93bmVkIGRldGVybWluaXN0aWMgQ29yZSBNTCBicmlkZ2UgdGVzdCBmaXh0dXJlOyBubyB0cmFpbmVkIHdlaWdodHMuEgExGh5TY3JpcHRpbmcgQ29yZU1MIHRlc3QgZml4dHVyZXPiEhYKCgoIAAAAAAAAAEASCAAAAAAAAPA/"

function ImagePredictionDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("Comparing a UIImage and a prepared PixelBuffer.")

  async function compare() {
    if (active.current) return
    const controller = new AbortController()
    const { signal } = controller
    active.current = controller
    setBusy(true)
    setStatus("Predicting with both inputs…")
    const path = FileManager.temporaryDirectory + "/coreml-image-demo-" + UUID.string() + ".mlmodel"
    let model: CoreML.Model | undefined
    let pixels: PixelBuffer | undefined
    try {
      const data = Data.fromBase64String(modelBase64)
      if (!data) throw new Error("The example model data is invalid.")
      await FileManager.writeAsData(path, data)
      model = await CoreML.Model.load(path, { computeUnits: "cpuOnly" }, { signal })
      const image = UIImage.fromRGBA(2, 2, new Uint8Array([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
      ]))
      const expected = "0,0,255,255,0,255,0,255,255,0,0,255,255,255,255,255"
      pixels = PixelBuffer.create({ width: 2, height: 2, format: "bgra8", data: new Uint8Array([
        0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255,
      ]) })
      for (const input of [image, pixels]) {
        const result = await model.predict({ x: { type: "double", value: 3 }, image: { type: "image", value: input } }, { signal })
        if (result.image?.type !== "image") throw new Error("The model returned no image.")
        const output = result.image.value
        try {
          if (output.copyPlanes()[0].data.join(",") !== expected) {
            throw new Error("The output pixels differ from the expected colors.")
          }
        } finally { if (output !== pixels) output.dispose() }
      }
      if (!signal.aborted) {
        const result = "Both inputs returned red, green, blue, and white in the expected order."
        setStatus(result)
        console.log(result)
      }
    } catch (error) {
      if (!signal.aborted) setStatus(String(error))
    } finally {
      pixels?.dispose()
      model?.dispose()
      try { await FileManager.remove(path) } catch {}
      active.current = null
      if (!signal.aborted) setBusy(false)
    }
  }

  useEffect(() => {
    void compare()
    return () => active.current?.abort()
  }, [])

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="Core ML image inputs">
      <Text>{status}</Text>
      <Button title="Compare image inputs" disabled={busy} action={() => { void compare() }} />
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <ImagePredictionDemo /> }) }
  finally { Script.exit() }
}

void run()
