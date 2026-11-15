import { Button, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from "scripting"

// Small project-authored classifier with red and blue labels.
const modelBase64 = "CAMSwQEKEQoFaW1hZ2UaCCIGCAIQAhgUUhUKDXByb2JhYmlsaXRpZXMaBDICEgBSCwoFbGFiZWwaAhoAWgVsYWJlbKIGcQpMUHJvamVjdC1vd25lZCBkZXRlcm1pbmlzdGljIENvcmUgTUwgYnJpZGdlIHRlc3QgZml4dHVyZTsgbm8gdHJhaW5lZCB3ZWlnaHRzLhIBMRoeU2NyaXB0aW5nIENvcmVNTCB0ZXN0IGZpeHR1cmVzYg1wcm9iYWJpbGl0aWVzmhmvAQpFCghyZWQtYmx1ZRIFaW1hZ2UaBnNjb3Jlc6IGKQgCEAOiAQIBAZIDANIFGgoYCtejPAAAAAAAAAAAAAAAAAAAAAAK16M8Ch8KBG1lYW4SBnNjb3JlcxoEbWVhbsIHCAgB8gEA4AMBCicKDXByb2JhYmlsaXRpZXMSBG1lYW4aDXByb2JhYmlsaXRpZXP6CgCiBgsKA3JlZAoEYmx1ZcIMDXByb2JhYmlsaXRpZXM="

function ClassifierDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("The test image has red pixels on the left and blue pixels on the right.")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])

  async function classify(side: "left" | "right") {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setStatus("Running Vision.")
    const filename = FileManager.temporaryDirectory + "/vision-demo-" + UUID.string() + ".mlmodel"
    let model: CoreML.Model | undefined
    try {
      const bytes = Data.fromBase64String(modelBase64)
      if (!bytes) throw new Error("The example model data is invalid.")
      await FileManager.writeAsData(filename, bytes)
      model = await CoreML.Model.load(filename, { computeUnits: "cpuOnly" }, { signal: controller.signal })
      const pixels = new Uint8Array(4 * 2 * 4)
      for (let i = 0; i < 8; ++i) {
        pixels[i * 4 + (i % 4 < 2 ? 0 : 2)] = 255
        pixels[i * 4 + 3] = 255
      }
      const image = UIImage.fromRGBA(4, 2, pixels)
      const request = Vision.Request.coreML(model, {
        cropAndScale: "scaleFill",
        regionOfInterest: { x: side === "left" ? 0 : 0.5, y: 0, width: 0.5, height: 1 },
      })
      const [batch] = await Vision.perform(image, [request], { signal: controller.signal })
      const label = batch.kind === "coreML" && batch.observations.find(value => value.type === "classification")
      if (!label) throw new Error("The model returned no classification.")
      if (mounted.current) setStatus(`${side === "left" ? "Left" : "Right"} half: ${label.identifier}, ${Math.round(label.confidence * 100)} percent.`)
    } catch (error) {
      if (mounted.current) setStatus(controller.signal.aborted ? "Classification cancelled." : String(error))
    } finally {
      model?.dispose()
      try { await FileManager.remove(filename) } catch {}
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Vision model classification">
      <VStack spacing={12} padding>
        <Text>{status}</Text>
        <Button title="Classify left half" disabled={busy} action={() => { void classify("left") }} />
        <Button title="Classify right half" disabled={busy} action={() => { void classify("right") }} />
        {busy && <Button title="Cancel classification" action={() => active.current?.abort()} />}
        <Button title="Done" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <ClassifierDemo /> }) }
  finally { Script.exit() }
}

void run()
