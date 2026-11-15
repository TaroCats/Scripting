import { Button, Canvas, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function MeshDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<ARKit.WorldTrackingSession | null>(null)
  const mounted = useRef(true)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Start, then scan the floor and walls with the rear camera.")
  const [mesh, setMesh] = useState<ARKit.WorldSceneMesh | null>(null)

  function stop() {
    const session = active.current
    active.current = null
    session?.close()
    if (mounted.current) {
      setMesh(null)
      setRunning(false)
      setStatus("Scanning stopped.")
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
      const modes = ARKit.getWorldTrackingCapabilities().sceneReconstruction
      const mode = modes.meshWithClassification ? "meshWithClassification" : modes.mesh ? "mesh" : null
      if (!mode) { setStatus("This device does not support LiDAR scene reconstruction."); return }
      session = ARKit.createWorldTrackingSession({ sceneReconstruction: mode, planeGeometry: false })
      active.current = session
      setRunning(true)
      setStatus("Starting the rear camera.")
      await session.start()
      let cached: ARKit.WorldSceneMesh | null = null
      while (mounted.current && active.current === session) {
        await session.nextFrame()
        if (!mounted.current || active.current !== session) break
        const snapshot = session.getSceneMeshAnchors()
        const candidate = snapshot.anchors.find(anchor => anchor.triangleCount > 0 && !anchor.geometryError)
        if (candidate && (cached?.id !== candidate.id || cached.revision !== candidate.revision)) {
          try { cached = session.copySceneMesh({ id: candidate.id, revision: candidate.revision }) }
          catch (error) {
            if ((error as { code?: string }).code !== "staleRevision") throw error
          }
        } else if (!candidate) cached = null
        setMesh(cached)
        setStatus(`${snapshot.anchors.length} mesh anchors${snapshot.complete ? "" : " (partial list)"}. Showing ${cached?.triangleCount ?? 0} triangles from one anchor.`)
        await new Promise<void>(resolve => { setTimeout(resolve, 350) })
      }
    } catch (error) {
      if (mounted.current && (!session || active.current === session)) setStatus(String(error))
    } finally {
      session?.close()
      if (active.current === session) {
        active.current = null
        if (mounted.current) {
          setMesh(null)
          setRunning(false)
        }
      }
    }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="ARKit Scene Mesh">
    <Text>{status}</Text>
    <Canvas frame={{ height: 240 }} opaque={false} accessibilityHidden draw={(ctx, size) => {
      if (!mesh?.geometry) return
      const { vertices, triangleIndices } = mesh.geometry
      // An isometric local view, scaled to fit one mesh anchor.
      const points = new Float32Array(vertices.length / 3 * 2)
      let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity
      for (let i = 0, j = 0; i < vertices.length; i += 3, j += 2) {
        const x = vertices[i] + vertices[i + 2] * 0.55
        const y = -vertices[i + 1] + vertices[i + 2] * 0.5
        points[j] = x
        points[j + 1] = y
        loX = Math.min(loX, x); hiX = Math.max(hiX, x)
        loY = Math.min(loY, y); hiY = Math.max(hiY, y)
      }
      const scale = Math.min(size.width / Math.max(0.001, hiX-loX), size.height / Math.max(0.001, hiY-loY)) * 0.82
      if (!Number.isFinite(scale)) return
      const x = (i: number) => size.width / 2 + (points[i * 2] - (hiX + loX) / 2) * scale
      const y = (i: number) => size.height / 2 + (points[i * 2 + 1] - (hiY + loY) / 2) * scale
      const step = Math.max(1, Math.ceil(triangleIndices.length / 3 / 2500)) * 3
      ctx.beginPath()
      ctx.strokeStyle = "systemTeal"
      ctx.lineWidth = 0.75
      for (let i = 0; i < triangleIndices.length; i += step) {
        const a = triangleIndices[i], b = triangleIndices[i + 1], c = triangleIndices[i + 2]
        ctx.moveTo(x(a), y(a)); ctx.lineTo(x(b), y(b)); ctx.lineTo(x(c), y(c)); ctx.lineTo(x(a), y(a))
      }
      ctx.stroke()
    }} />
    <Button title="Start scanning" disabled={running} action={() => { void start() }} />
    <Button title="Stop scanning" disabled={!running} action={stop} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <MeshDemo /> }) }
  finally { Script.exit() }
}

void main()
