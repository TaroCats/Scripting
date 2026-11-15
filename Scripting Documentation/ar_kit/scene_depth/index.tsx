import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function DepthDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<ARKit.WorldTrackingSession | null>(null)
  const mounted = useRef(true)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Start, then face the rear camera toward a surface.")
  const [raw, setRaw] = useState("")
  const [smoothed, setSmoothed] = useState("")

  function describe(depth: ARKit.WorldSceneDepth | null, error: string | null) {
    if (!depth) return error ?? "waiting for a sample"
    const x = Math.floor(depth.width / 2)
    const y = Math.floor(depth.height / 2)
    const index = y * depth.width + x
    const meters = depth.distances[index]
    const level = depth.confidence?.[index]
    const quality = level === 2 ? "high" : level === 1 ? "medium" : level === 0 ? "low" : "unavailable"
    return Number.isFinite(meters) && meters > 0
      ? `${meters.toFixed(2)} m, confidence ${quality}, ${depth.width} × ${depth.height}`
      : "no valid distance at the center"
  }

  function stop() {
    const session = active.current
    active.current = null
    session?.close()
    if (mounted.current) {
      setRunning(false)
      setStatus("Tracking stopped.")
      setRaw("")
      setSmoothed("")
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
      const support = ARKit.getWorldTrackingCapabilities().sceneDepth
      const mode = support.both ? "both" : support.raw ? "raw" : support.smoothed ? "smoothed" : null
      if (!mode) {
        setStatus("This device does not support ARKit LiDAR depth.")
        return
      }
      session = ARKit.createWorldTrackingSession({ sceneDepth: mode, detectHorizontalPlanes: false, detectVerticalPlanes: false })
      active.current = session
      setRunning(true)
      setStatus("Starting the rear camera.")
      await session.start()
      while (mounted.current && active.current === session) {
        const frame = await session.nextFrame()
        if (!mounted.current || active.current !== session) break
        setStatus(`Tracking: ${frame.camera.tracking.state}`)
        setRaw(mode === "smoothed" ? "Raw: not enabled" : "Raw: " + describe(frame.sceneDepth, frame.sceneDepthError))
        setSmoothed(mode === "raw" ? "Smoothed: not enabled" : "Smoothed: " + describe(frame.smoothedSceneDepth, frame.smoothedSceneDepthError))
        await new Promise<void>(resolve => { setTimeout(resolve, 300) })
      }
    } catch (error) {
      if (mounted.current && (!session || active.current === session)) setStatus(String(error))
    } finally {
      session?.close()
      if (active.current === session) {
        active.current = null
        if (mounted.current) setRunning(false)
      }
    }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="ARKit Scene Depth">
    <Text>{status}</Text>
    {raw ? <Text>{raw}</Text> : null}
    {smoothed ? <Text>{smoothed}</Text> : null}
    <Button title="Start measuring" disabled={running} action={() => { void start() }} />
    <Button title="Stop measuring" disabled={!running} action={stop} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <DepthDemo /> }) }
  finally { Script.exit() }
}

void main()
