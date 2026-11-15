import { Button, Canvas, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

type MeshFrame = { face: ARKit.TrackedFace; projection: NonNullable<ARKit.FaceFrame["projection"]> }

function transform(matrix: Float32Array, [x, y, z, w]: number[]) {
  return [0, 1, 2, 3].map(row => matrix[row] * x + matrix[row + 4] * y + matrix[row + 8] * z + matrix[row + 12] * w)
}

function Example() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<ARKit.FaceTrackingSession | null>(null)
  const mounted = useRef(true)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Start, then face the front camera.")
  const [mesh, setMesh] = useState<MeshFrame | null>(null)

  function stop() {
    const session = active.current
    active.current = null
    session?.close()
    if (mounted.current) {
      setRunning(false)
      setStatus("Tracking stopped.")
      setMesh(null)
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stop()
    }
  }, [])

  async function start() {
    if (active.current) return
    let session: ARKit.FaceTrackingSession | undefined
    try {
      if (!ARKit.getFaceTrackingCapabilities().supported) {
        setStatus("This device does not support ARKit face tracking.")
        return
      }
      session = ARKit.createFaceTrackingSession({ viewport: { width: 320, height: 320 } })
      active.current = session
      setRunning(true)
      setStatus("Starting the front camera.")
      await session.start()
      let last = -Infinity
      while (mounted.current && active.current === session) {
        const frame = await session.nextFrame()
        if (!mounted.current || active.current !== session) break
        if (frame.timestampSeconds - last < 0.08) continue
        last = frame.timestampSeconds
        const face = frame.faces.find(anchor => anchor.tracked)
        setMesh(face && frame.projection ? { face, projection: frame.projection } : null)
        const jaw = face?.blendShapes.jawOpen
        const text = jaw === undefined ? "Jaw estimate unavailable." : `Jaw open ${Math.round(jaw * 100)}%.`
        setStatus(face ? `${frame.faces.filter(anchor => anchor.tracked).length} tracked. ${text}` : "Waiting for a face.")
      }
    } catch (error) {
      if (mounted.current && (!session || active.current === session)) setStatus(String(error))
    } finally {
      session?.close()
      if (active.current === session) {
        active.current = null
        if (mounted.current) {
          setRunning(false)
          setMesh(null)
        }
      }
    }
  }

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="ARKit Face Tracking">
      <Text>{status}</Text>
      <Canvas frame={{ height: 280 }} opaque={false} accessibilityHidden draw={(ctx, size) => {
        const anchor = mesh?.face.anchorTransform
        if (!mesh || !anchor) return
        const { viewMatrix, projectionMatrix } = mesh.projection
        const { vertices, triangleIndices } = mesh.face.geometry
        const span = Math.min(size.width, size.height)
        const left = (size.width - span) / 2
        const top = (size.height - span) / 2
        const points: ([number, number] | null)[] = []
        for (let i = 0; i < vertices.length; i += 3) {
          const world = transform(anchor, [vertices[i], vertices[i + 1], vertices[i + 2], 1])
          const [x, y, , w] = transform(projectionMatrix, transform(viewMatrix, world))
          points.push(w > 0 && Number.isFinite(x / w) && Number.isFinite(y / w)
            ? [left + (1 + x / w) * span / 2, top + (1 - y / w) * span / 2] : null)
        }
        ctx.beginPath()
        ctx.lineWidth = 0.7
        ctx.strokeStyle = "systemTeal"
        for (let i = 0; i < triangleIndices.length; i += 3) {
          const a = points[triangleIndices[i]]
          const b = points[triangleIndices[i + 1]]
          const c = points[triangleIndices[i + 2]]
          if (!a || !b || !c) continue
          ctx.moveTo(...a)
          ctx.lineTo(...b)
          ctx.lineTo(...c)
          ctx.lineTo(...a)
        }
        ctx.stroke()
      }} />
      <Button title="Start tracking" disabled={running} action={() => { void start() }} />
      <Button title="Stop tracking" disabled={!running} action={stop} />
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <Example /> }) }
  finally { Script.exit() }
}

void main()
