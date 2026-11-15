import {
  Button, ImageRenderer, Navigation, NavigationStack, Script, ScrollView,
  Text, useEffect, useRef, useState, VStack,
} from "scripting"

function Example() {
  const dismiss = Navigation.useDismiss()
  const display = useRef<ExternalDisplayPresentation | null>(null)
  const alive = useRef(true)
  const working = useRef(false)
  const counter = useRef(0)
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<ExternalDisplayState | "idle">("idle")
  const [geometry, setGeometry] = useState("No external scene")
  const [message, setMessage] = useState("Tap Show image, then connect Screen Mirroring in Control Center.")

  useEffect(() => () => {
    alive.current = false
    const current = display.current
    display.current = null
    current?.dispose()
  }, [])

  function refresh(current: ExternalDisplayPresentation) {
    if (!alive.current || display.current !== current) return
    setState(current.state)
    const info = current.displayInfo
    setGeometry(info ? `${info.width} × ${info.height} pt, scale ${info.scale}` : "No external scene")
  }

  async function perform(action: () => Promise<void>) {
    // A ref guards rapid taps before the disabled button has re-rendered.
    if (working.current) return
    working.current = true
    setBusy(true)
    try {
      await action()
    } catch (error) {
      if (alive.current) setMessage(`Error: ${String(error)}`)
    } finally {
      working.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function showImage(nextCount: number) {
    let current = display.current
    if (!current) {
      current = await ExternalDisplay.createPresentation()
      // Closing the page during creation must not leave a late owner alive.
      if (!alive.current) { current.dispose(); return }
      display.current = current
      const owner = current
      owner.onStateChanged = () => refresh(owner)
    }
    refresh(current) // Subscribe first, then read the initial state.
    const image = await ImageRenderer.toUIImage(
      <VStack spacing={24} frame={{ width: 960, height: 540 }} background="#163858">
        <Text font="largeTitle" foregroundStyle="white">EXTERNAL IMAGE</Text>
        <Text font="largeTitle" foregroundStyle="yellow">{`COUNT ${nextCount}`}</Text>
        <Text foregroundStyle="white">Controlled by the buttons on your device</Text>
      </VStack>,
      { scale: 1, opaque: true },
    )
    if (!alive.current || display.current !== current) return
    await current.setImage(image, { contentMode: "fit", backgroundColor: "#000000" })
    if (!alive.current) return
    counter.current = nextCount
    setCount(nextCount)
    setMessage("Image accepted. Check the receiver separately; this is not a delivery receipt.")
    refresh(current)
  }

  function release() {
    const current = display.current
    display.current = null
    current?.dispose()
    setState("idle")
    setGeometry("No external scene")
    setMessage("Presentation released. This does not stop the system's Screen Mirroring connection.")
  }

  const hint = state === "waiting"
    ? "Disconnected or awaiting a foreground external scene. Keep this page open; the same image is retained for reconnection."
    : state === "suspended"
      ? "Output is suspended while the App/page is inactive or covered. Close Control Center and return to this page."
      : state === "presenting"
        ? "The system external scene is presenting. The device keeps the controls."
        : "No image presentation is owned by this demo."

  return <NavigationStack>
    <ScrollView>
      <VStack navigationTitle="External Image Demo" spacing={16} padding>
        <Text>{`Local count: ${count}`}</Text>
        <Text>{`Output: ${state}`}</Text>
        <Text>{geometry}</Text>
        <Text>{hint}</Text>
        <Text>{message}</Text>
        <Button title="Show image" disabled={busy} action={() => perform(() => showImage(counter.current))} />
        <Button title="Increment and update image" disabled={busy} action={() => perform(() => showImage(counter.current + 1))} />
        <Button title="Clear image (keep ownership)" disabled={busy} action={() => perform(async () => {
          const current = display.current
          if (!current) { setMessage("Show an image first."); return }
          await current.clear()
          if (alive.current) setMessage("Content cleared to black. The same presentation can show another image.")
        })} />
        <Button title="Release presentation" disabled={busy} action={release} />
        <Text>Reconnect test: show an image and increment. Stop Screen Mirroring, return here and keep the demo open. Reconnect through Control Center; the last image and local count should remain. No new handle is created just because output is waiting.</Text>
        <Button title="Close demo" action={() => dismiss()} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

try {
  await Navigation.present({ element: <Example /> })
} finally {
  Script.exit()
}
