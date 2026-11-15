import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function WorldTrackingDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<ARKit.WorldTrackingSession | null>(null)
  const latest = useRef<ARKit.WorldFrame | null>(null)
  const placed = useRef<string | null>(null)
  const mounted = useRef(true)
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState(false)
  const [placedAnchor, setPlacedAnchor] = useState(false)
  const [scan, setScan] = useState("Start, then slowly scan the floor and walls with the rear camera.")
  const [result, setResult] = useState("")

  function stop() {
    const session = active.current
    active.current = null
    latest.current = null
    placed.current = null
    session?.close()
    if (mounted.current) {
      setRunning(false)
      setReady(false)
      setPlacedAnchor(false)
      setResult("")
      setScan("Tracking stopped.")
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stop() }
  }, [])

  async function start() {
    if (active.current) return
    let session: ARKit.WorldTrackingSession | undefined
    try {
      if (!ARKit.getWorldTrackingCapabilities().supported) {
        setScan("This device does not support ARKit world tracking.")
        return
      }
      session = ARKit.createWorldTrackingSession({ planeGeometry: false })
      active.current = session
      latest.current = null
      setRunning(true)
      setReady(false)
      setResult("")
      setScan("Starting the rear camera.")
      await session.start()
      let last = -Infinity
      while (mounted.current && active.current === session) {
        const frame = await session.nextFrame()
        if (!mounted.current || active.current !== session) break
        latest.current = frame
        if (frame.timestampSeconds - last < 0.18) continue
        last = frame.timestampSeconds
        const planes = frame.anchors.flatMap(anchor => anchor.plane ? [anchor.plane] : [])
        setReady(frame.camera.tracking.state === "normal" && frame.camera.worldTransform !== null)
        setScan(`${planes.filter(plane => plane.alignment === "horizontal").length} horizontal planes; ${planes.filter(plane => plane.alignment === "vertical").length} vertical planes. Map: ${frame.worldMappingStatus}.`)
      }
    } catch (error) {
      if (mounted.current && (!session || active.current === session)) setScan(String(error))
    } finally {
      session?.close()
      if (session && active.current === session) {
        active.current = null
        latest.current = null
        placed.current = null
        if (mounted.current) {
          setRunning(false)
          setReady(false)
          setPlacedAnchor(false)
        }
      }
    }
  }

  function place() {
    const session = active.current
    const frame = latest.current
    const camera = frame?.camera.worldTransform
    if (!session || !camera || frame.camera.tracking.state !== "normal") return
    try {
      const [hit] = session.raycast({
        origin: camera.slice(12, 15),
        direction: new Float32Array([-camera[8], -camera[9], -camera[10]]),
      })
      if (!hit?.worldTransform) {
        setResult("No detected surface ahead. Tilt toward a scanned floor or wall and try again.")
        return
      }
      if (placed.current) session.removeAnchor(placed.current)
      placed.current = session.addAnchor({ name: "Demo marker", transform: hit.worldTransform })
      setPlacedAnchor(true)
      const [x, y, z] = hit.worldTransform.slice(12, 15)
      setResult(`Anchor placed at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} meters.`)
    } catch (error) { setResult(String(error)) }
  }

  function remove() {
    const session = active.current
    const id = placed.current
    if (!session || !id) return
    try {
      session.removeAnchor(id)
      placed.current = null
      setPlacedAnchor(false)
      setResult("Anchor removed.")
    } catch (error) { setResult(String(error)) }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="ARKit World Tracking">
    <Text>{scan}</Text>
    {result ? <Text>{result}</Text> : null}
    <Button title="Start scanning" disabled={running} action={() => { void start() }} />
    <Button title="Place anchor ahead" disabled={!ready} action={place} />
    <Button title="Remove demo anchor" disabled={!placedAnchor} action={remove} />
    <Button title="Stop scanning" disabled={!running} action={stop} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <WorldTrackingDemo /> }) }
  finally { Script.exit() }
}

void main()
