import {
  Button, CaptureVideoPreviewView, Image, List, Navigation, NavigationStack,
  Path, Script, Section, Text, VStack, VideoPlayer, useEffect, useRef, useState,
} from "scripting"
import type { CameraControlAsset, CameraControlParameter } from "scripting"

let alive = true
let closing = false
let incoming: CameraControlParameter | null = Script.cameraControlParameter
// A null resume restores the capture experience without replaying a file batch.
let captureRequested = !incoming && Script.env === "camera_control"
let receive: (batch: CameraControlParameter | null) => void = batch => {
  if (batch) incoming = batch
  else captureRequested = Script.env === "camera_control"
}
const unsubscribe = Script.onResume(event => {
  if (!closing && (event.cameraControlParameter || Script.env === "camera_control")) receive(event.cameraControlParameter)
})
let ownedSession: AVCaptureSession | null = null
let ownedPlayer: AVPlayer | null = null

let stopping: Promise<void> = Promise.resolve()
async function stopCamera() {
  const session = ownedSession
  ownedSession = null
  const previous = stopping
  const current = session
    ? session.stopRunning().finally(() => session.dispose()) : Promise.resolve()
  // A resource handoff can cancel a start while its permission request is open.
  // A later start must also await that earlier stop before acquiring the camera.
  stopping = Promise.all([previous, current]).then(() => {}, () => {})
  await Promise.all([previous, current])
}

function Demo() {
  const dismiss = Navigation.useDismiss()
  const [batch, setBatch] = useState(incoming)
  const [message, setMessage] = useState("Ready")
  const [image, setImage] = useState<UIImage | null>(null)
  const [video, setVideo] = useState<AVPlayer | null>(null)
  const [selected, setSelected] = useState<CameraControlAsset | null>(null)
  const [camera, setCamera] = useState<{ session: AVCaptureSession; device: AVCaptureDevice; photo: AVCapturePhotoOutput } | null>(null)
  const [busy, setBusy] = useState(false)
  const [captureMode, setCaptureMode] = useState(captureRequested)
  const pendingCamera = useRef(false)
  const revision = useRef(0)
  const working = useRef(false)
  const currentCamera = useRef(camera)
  currentCamera.current = camera
  const report = (value: string) => { if (alive) setMessage(value) }

  async function run(action: () => Promise<void>) {
    if (!alive || closing || working.current) return
    const startedAt = revision.current
    working.current = true; setBusy(true)
    try { await action() } catch (error) { if (revision.current === startedAt) report(String(error)) }
    finally {
      working.current = false
      if (alive) {
        setBusy(false)
        // Do not lose an entry request that arrived while another action awaited.
        if (pendingCamera.current) void run(startCamera)
      }
    }
  }

  async function closeCamera() {
    if (closing) return
    closing = true
    // Reject new native file deliveries while this instance is closing.
    unsubscribe()
    revision.current += 1
    pendingCamera.current = false
    setBusy(true)
    report("Closing camera…")
    // Keep the preview mounted until native stop finishes. Dismissing first
    // can make preview teardown wait synchronously for the running camera.
    try { await stopCamera() }
    catch (error) { report(String(error)) }
    finally { dismiss() }
  }

  async function startCamera() {
    pendingCamera.current = false
    const startedAt = revision.current
    const existing = currentCamera.current
    if (existing && ownedSession === existing.session && existing.session.isRunning) return
    currentCamera.current = null; setCamera(null)
    await stopCamera()
    if (!alive || closing || revision.current !== startedAt) return
    if (ownedPlayer) { ownedPlayer.dispose(); ownedPlayer = null; setVideo(null) }
    const device = AVCaptureDevice.default("video")
    if (!device) throw new Error("No camera is available. Simulator can still test the page and file handoff.")
    const session = new AVCaptureSession()
    const photo = new AVCapturePhotoOutput()
    ownedSession = session
    try {
      const input = new AVCaptureDeviceInput(device)
      session.configure(() => {
        if (!session.canAddInput(input)) throw new Error("Cannot add the camera input")
        session.addInput(input)
        if (!session.canAddOutput(photo)) throw new Error("Cannot add photo output")
        session.addOutput(photo)
        if (session.supportsControls) {
          const zoom = new AVCaptureSystemZoomSlider(device)
          if (session.canAddControl(zoom)) session.addControl(zoom)
          session.setControlsDelegate({ didBecomeActive() {}, willEnterFullscreenAppearance() {},
            willExitFullscreenAppearance() {}, didBecomeInactive() {} })
        }
      })
      await session.startRunning()
      if (!alive || closing || revision.current !== startedAt || ownedSession !== session) {
        session.dispose(); if (ownedSession === session) ownedSession = null
        return
      }
      currentCamera.current = { session, device, photo }
      setCamera(currentCamera.current); setImage(null); setSelected(null)
      report("Camera ready. Touch Capture or use a physical capture button.")
    } catch (error) { session.dispose(); if (ownedSession === session) ownedSession = null; throw error }
  }

  async function capture() {
    const startedAt = revision.current
    const current = currentCamera.current
    if (!current || ownedSession !== current.session) return
    const folder = Path.join(FileManager.documentsDirectory, "Camera Control Demo")
    await FileManager.createDirectory(folder, true)
    const filePath = Path.join(folder, `photo-${Date.now()}.jpg`)
    const result = await current.photo.capturePhoto({ codec: "jpeg", photoFile: filePath })
    if (!alive || closing || revision.current !== startedAt) return
    setImage(result.image)
    setSelected({ id: filePath, type: "photo", filePath, typeIdentifier: "public.jpeg", capturedAt: Date.now() })
    report(`Photo saved: ${filePath}`)
  }

  async function preview(asset: CameraControlAsset) {
    const startedAt = revision.current
    // Keep the visible viewfinder alive in a Camera Control capture experience.
    if (!captureRequested) { await stopCamera(); currentCamera.current = null; if (alive) setCamera(null) }
    if (!alive || closing || revision.current !== startedAt) return
    setSelected(asset); setImage(null)
    ownedPlayer?.dispose(); ownedPlayer = null; setVideo(null)
    if (asset.type === "photo") {
      const decoded = UIImage.fromFile(asset.filePath)
      if (!decoded) throw new Error("Could not decode the photo")
      setImage(decoded)
    } else {
      const player = new AVPlayer()
      if (!player.setSource(asset.filePath)) { player.dispose(); throw new Error("Could not open the video") }
      ownedPlayer = player; setVideo(player)
    }
    report(`${asset.type}: ${asset.filePath}`)
  }

  useEffect(() => {
    receive = next => {
      if (!alive || closing) return
      if (!next) {
        captureRequested = true; setCaptureMode(true)
        pendingCamera.current = true
        if (!working.current) void run(startCamera)
        return
      }
      incoming = next
      revision.current += 1
      setBatch(next); setSelected(null); setImage(null)
      ownedPlayer?.dispose(); ownedPlayer = null; setVideo(null)
      report(`Received ${next.assets.length} files · ${next.captureId}`)
      if (captureRequested && currentCamera.current?.session === ownedSession && ownedSession?.isRunning) {
        // A batch update must not tear down a live, visible capture experience.
        return
      }
      currentCamera.current = null; setCamera(null)
      void stopCamera().catch(error => report(String(error)))
      if (captureRequested) {
        pendingCamera.current = true
        if (!working.current) void run(startCamera)
      }
    }
    // File handoff alone never starts capture or repeats file processing.
    if (captureRequested) void run(startCamera)
    return () => { receive = () => {}; currentCamera.current = null }
  }, [])

  return <NavigationStack onCameraCaptureEvent={{
    // Keep system capture interaction available while processing a photo.
    // run() ignores duplicate actions until the current operation finishes.
    isEnabled: !!camera,
    primaryAction: event => { if (event.phase === "ended") void run(capture) },
  }}><VStack spacing={0}>
    {camera ? <CaptureVideoPreviewView session={camera.session} videoDevice={camera.device}
      frame={{ height: 240 }} accessibilityLabel="Camera preview" /> : null}
    <List navigationTitle="Camera Control Demo"
    toolbar={{ cancellationAction: <Button title="Close" action={() => { void closeCamera() }} disabled={closing} /> }}>
    <Section header={<Text>Entry</Text>}>
      <Text>{`Environment: ${Script.env}`}</Text>
      <Text>{message}</Text>
      <Text>{batch ? `Capture batch: ${batch.captureId}` : "No handed-off batch"}</Text>
    </Section>
    {batch ? <Section header={<Text>Captured files</Text>}>
      {batch.assets.map(asset => <Button key={asset.id}
        title={`${asset.type} · ${Path.basename(asset.filePath)}`}
        action={() => { void run(() => preview(asset)) }} disabled={busy} />)}
    </Section> : null}
    <Section header={<Text>Script camera</Text>}>
      <Button title="Start Camera" action={() => { void run(startCamera) }} disabled={busy || !!camera} />
      <Button title="Capture" action={() => { void run(capture) }} disabled={busy || !camera} />
      {captureMode ? <Text>Keep this viewfinder open while using Camera Control. Use Close to finish.</Text>
        : <Button title="Stop Camera" action={() => { void run(async () => {
          await stopCamera(); currentCamera.current = null; if (alive) setCamera(null)
        }) }} disabled={busy || !camera} />}
    </Section>
    {image ? <Image image={image} resizable scaleToFit accessibilityLabel="Captured photo" /> : null}
    {video ? <VideoPlayer player={video} frame={{ height: 300 }} /> : null}
    {selected ? <Button title="Save Selected to Photos" disabled={busy} action={() => {
      void run(async () => {
        const success = selected.type === "photo"
          ? await Photos.savePhoto(selected.filePath, { shouldMoveFile: false })
          : await Photos.saveVideo(selected.filePath, { shouldMoveFile: false })
        report(success ? "Saved to Photos" : "The file was not saved to Photos")
      })
    }} /> : null}
  </List></VStack></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <Demo />, modalPresentationStyle: "fullScreen" }) }
  finally {
    closing = true; alive = false; unsubscribe()
    ownedPlayer?.dispose(); ownedPlayer = null
    try { await stopCamera() } finally { Script.exit() }
  }
}
void main()
