import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

const archivePath = Script.directory + "/world-map-demo.bin"
const markerName = "World map demo marker"

function MapDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<ARKit.WorldTrackingSession | null>(null)
  const revision = useRef(0)
  const mounted = useRef(true)
  const marker = useRef<string | null>(null)
  const [activeMode, setActiveMode] = useState<"scan" | "load" | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("Start a new scan, or reopen this demo's previously saved map.")
  const [storageStatus, setStorageStatus] = useState("")

  function stop() {
    revision.current++
    const previous = active.current
    active.current = null
    previous?.close()
    marker.current = null
    if (mounted.current) {
      setActiveMode(null)
      setReady(false)
      setSaving(false)
      setStatus("Tracking stopped.")
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stop() }
  }, [])

  async function start(load: boolean) {
    const ticket = ++revision.current
    const current = () => mounted.current && revision.current === ticket
    let session: ARKit.WorldTrackingSession | undefined
    try {
      if (!ARKit.getWorldTrackingCapabilities().supported) {
        setStatus("This device does not support ARKit world tracking.")
        return
      }
      const previous = active.current
      active.current = null
      previous?.close()
      marker.current = null
      setActiveMode(load ? "load" : "scan")
      setReady(false)
      setSaving(false)
      setStatus(load ? "Reading the saved map." : "Starting a clean scan.")
      const initialWorldMap = load ? await FileManager.readAsData(archivePath) : undefined
      if (!current()) return
      session = ARKit.createWorldTrackingSession({ initialWorldMap, planeGeometry: false })
      active.current = session
      await session.start()
      let last = -Infinity
      while (current() && active.current === session) {
        const frame = await session.nextFrame()
        if (!current()) break
        const normal = frame.camera.tracking.state === "normal"
        const location = frame.camera.worldTransform
        if (!load && !marker.current && normal && location) {
          const transform = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,location[12],location[13],location[14],1])
          marker.current = session.addAnchor({ name: markerName, transform })
        }
        if (frame.timestampSeconds - last < 0.25) continue
        last = frame.timestampSeconds
        const found = frame.anchors.some(anchor => anchor.name === markerName)
        setReady(!load && normal && found && (frame.worldMappingStatus === "mapped" || frame.worldMappingStatus === "extending"))
        setStatus(load
          ? (normal && found ? "Relocalized. The saved marker is present." : "Finding this room. Slowly scan the same area.")
          : `Tracking: ${frame.camera.tracking.state}. Map: ${frame.worldMappingStatus}. Marker ${found ? "present" : "pending"}.`)
      }
    } catch (error) {
      if (current()) setStatus(String(error))
    } finally {
      session?.close()
      if (current()) {
        active.current = null
        setActiveMode(null)
        setReady(false)
      }
    }
  }

  async function save() {
    const session = active.current
    const ticket = revision.current
    if (!session || !ready || saving) return
    const current = () => mounted.current && revision.current === ticket && active.current === session
    setSaving(true)
    try {
      const data = await session.captureWorldMap()
      if (!current()) return
      await FileManager.writeAsData(archivePath, data)
      if (current()) setStorageStatus("Saved to world-map-demo.bin in this script folder.")
    } catch (error) {
      if (current()) setStorageStatus(String(error))
    } finally {
      if (current()) setSaving(false)
    }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="ARKit World Maps">
    <Text>{status}</Text>
    {storageStatus ? <Text>{storageStatus}</Text> : null}
    <Button title="Start a fresh scan" disabled={saving} action={() => { void start(false) }} />
    <Button title="Save map" disabled={!ready || saving} action={() => { void save() }} />
    <Button title="Reopen saved map" disabled={saving} action={() => { void start(true) }} />
    <Button title="Stop camera" disabled={activeMode === null} action={stop} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <MapDemo /> }) }
  finally { Script.exit() }
}

void main()
