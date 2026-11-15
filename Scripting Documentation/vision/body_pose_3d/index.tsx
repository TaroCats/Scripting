import { Button, Canvas, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from 'scripting'

function BodyPosePreview() {
  const [status, setStatus] = useState('Choose a photo showing one person from head to feet.')
  const [result, setResult] = useState<{ image: UIImage; pose: Vision.BodyPose3DObservation } | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  async function pickAndAnalyze() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setResult(null)
    setStatus('Choose a full-body photo.')
    try {
      const [image] = await Photos.pickPhotos(1)
      if (controller.signal.aborted) return
      if (!image) {
        setStatus('No photo was selected.')
        return
      }
      setStatus('Analyzing the photo.')
      const [pose] = await Vision.detectBodyPose3D(image, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!pose) {
        setStatus('No full-body pose was detected. Try a photo with both arms and legs visible.')
        return
      }
      setResult({ image, pose })
      const count = Object.keys(pose.joints).length
      const projectedCount = Object.values(pose.joints).filter(joint => joint?.imagePoint).length
      const provenance = pose.heightEstimation === 'reference' ? 'reference height' :
        pose.heightEstimation === 'measured' ? 'depth-based estimate' : 'height source unavailable'
      setStatus(`${count} joints detected. ${projectedCount} image projections. ${pose.bodyHeight.toFixed(2)} meters, ${provenance}.`)
    } catch (error) {
      if (!controller.signal.aborted) setStatus(String(error))
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="3D body pose">
      <VStack spacing={12} padding>
        <Text>{status}</Text>
        <Button title="Choose full-body photo" disabled={busy} action={() => { void pickAndAnalyze() }} />
        {result && <Canvas frame={{ height: 280 }} opaque={false} accessibilityHidden draw={(ctx, viewSize) => {
          const { image, pose } = result
          const imageSize = { width: image.width, height: image.height }
          if (imageSize.width <= 0 || imageSize.height <= 0 || viewSize.width <= 0 || viewSize.height <= 0) return
          const scale = Math.min(viewSize.width / imageSize.width, viewSize.height / imageSize.height)
          const width = imageSize.width * scale, height = imageSize.height * scale
          const left = (viewSize.width - width) / 2, top = (viewSize.height - height) / 2
          ctx.drawImage({ image }, left, top, width, height)
          const project = ({ x, y }: Vision.Point) => ({ x: left + x * width, y: top + (1 - y) * height })
          ctx.lineWidth = 3
          ctx.strokeStyle = 'white'
          ctx.fillStyle = 'systemTeal'
          ctx.beginPath()
          for (const joint of Object.values(pose.joints)) {
            const parent = joint?.parentJoint ? pose.joints[joint.parentJoint] : undefined
            if (!joint?.imagePoint || !parent?.imagePoint) continue
            const a = project(parent.imagePoint), b = project(joint.imagePoint)
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
          }
          ctx.stroke()
          for (const joint of Object.values(pose.joints)) {
            if (!joint?.imagePoint) continue
            const point = project(joint.imagePoint)
            ctx.beginPath()
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
            ctx.fill()
          }
        }} />}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!Vision.getCapabilities().requests.bodyPose3D?.supported) {
      await Dialog.alert({ message: '3D body pose analysis is unavailable in this script context.' })
      return
    }
    await Navigation.present({ element: <BodyPosePreview /> })
  } catch (error) {
    await Dialog.alert({ title: '3D body pose', message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
