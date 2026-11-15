import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function kneeAngle(body: ARKit.Body3D): number | null {
  const jointNames = ["left_upLeg_joint", "left_leg_joint", "left_foot_joint"]
  const points = jointNames.map(name => {
    const index = body.definition.indexOfJoint(name)
    if (index < 0 || (body.jointFlags[index] & 5) !== 5) return null
    return body.modelTransforms.subarray(index * 16 + 12, index * 16 + 15)
  })
  const [hip, knee, ankle] = points
  if (!hip || !knee || !ankle) return null
  const upper = hip.map((position, axis) => position - knee[axis])
  const lower = ankle.map((position, axis) => position - knee[axis])
  const length = Math.hypot(...upper) * Math.hypot(...lower)
  if (length === 0) return null
  const dot = upper.reduce((value, position, axis) => value + position * lower[axis], 0)
  return Math.acos(Math.max(-1, Math.min(1, dot / length))) * 180 / Math.PI
}

function BodyTrackingDemo() {
  const dismiss = Navigation.useDismiss()
  const mounted = useRef(true)
  const active = useRef<ARKit.BodyTrackingSession | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Place one person fully in the rear camera's view.")
  const [repetitions, setRepetitions] = useState(0)

  function stop() {
    const session = active.current
    active.current = null
    session?.close()
    if (mounted.current) {
      setRunning(false)
      setStatus("Tracking stopped.")
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
    let session: ARKit.BodyTrackingSession | undefined
    try {
      if (!ARKit.getCapabilities().bodyTracking) {
        setStatus("This device does not support ARKit body tracking.")
        return
      }
      session = ARKit.createBodyTrackingSession({ detectBody2D: false })
      active.current = session
      setRunning(true)
      setRepetitions(0)
      setStatus("Starting the rear camera.")
      await session.start()
      let bent = false
      let lastUpdate = -Infinity
      while (active.current === session && mounted.current) {
        const frame = await session.nextFrame()
        if (active.current !== session || !mounted.current) break
        const body = frame.bodies.find(person => person.tracked)
        const angle = frame.camera.tracking.state === "normal" && body ? kneeAngle(body) : null
        if (angle === null) bent = false
        else if (angle < 105) bent = true
        else if (angle > 155 && bent) {
          bent = false
          setRepetitions(count => count + 1)
        }
        if (frame.timestampSeconds - lastUpdate >= 0.15) {
          lastUpdate = frame.timestampSeconds
          setStatus(angle === null ? "Waiting for the hip, knee, and ankle to be tracked." : `Left knee ${Math.round(angle)} degrees.`)
        }
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

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="ARKit Body Tracking">
      <Text>{status}</Text>
      <Text>{`Squats ${repetitions}`}</Text>
      <Button title="Start tracking" disabled={running} action={() => { void start() }} />
      <Button title="Stop tracking" disabled={!running} action={stop} />
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <BodyTrackingDemo /> }) }
  finally { Script.exit() }
}

void run()
