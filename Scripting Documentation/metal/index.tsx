import { Button, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from 'scripting'

const shader = `
#include <metal_stdlib>
using namespace metal;
kernel void add_vectors(device const uint *left [[buffer(0)]],
                        device const uint *right [[buffer(1)]],
                        device uint *result [[buffer(2)]],
                        constant uint &count [[buffer(3)]],
                        uint i [[thread_position_in_grid]]) {
  if (i < count) result[i] = left[i] + right[i];
}
`

function VectorAddition({ device }: { device: Metal.Device }) {
  const [status, setStatus] = useState('Run Metal to add the vectors.')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => {
    void addVectors()
    return () => {
      pending.current?.abort()
      pending.current = null
    }
  }, [])

  async function addVectors() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    const { signal } = controller
    const resources: Array<{ dispose(): void }> = []
    setBusy(true)
    setStatus('Compiling and running the Metal kernel.')
    try {
      const left = new Uint32Array([2, 7, 4, 9])
      const right = new Uint32Array([4, 3, 8, 2])
      const library = await device.compileLibrary(shader, { signal })
      resources.push(library)
      const pipeline = await library.makeComputePipeline('add_vectors', { signal })
      resources.push(pipeline)
      const a = await device.makeBuffer({ length: left.byteLength, data: left, signal })
      resources.push(a)
      const b = await device.makeBuffer({ length: right.byteLength, data: right, signal })
      resources.push(b)
      const result = await device.makeBuffer({ length: left.byteLength, storageMode: 'private', signal })
      resources.push(result)

      const secondResult = await device.makeBuffer({ length: left.byteLength, storageMode: 'private', signal })
      resources.push(secondResult)
      const command = {
        threadgroups: { width: 1 },
        threadsPerThreadgroup: { width: left.length },
        buffers: [{ index: 0, buffer: a }, { index: 1, buffer: b }, { index: 2, buffer: result }],
        bytes: [{ index: 3, data: new Uint32Array([left.length]) }],
      }
      await pipeline.dispatchBatch({ commands: [command, {
        ...command,
        buffers: [{ index: 0, buffer: result }, { index: 1, buffer: b }, { index: 2, buffer: secondResult }],
      }], signal })
      const bytes = await result.read({ signal })
      const secondBytes = await secondResult.read({ signal })
      const values = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT)
      const secondValues = new Uint32Array(secondBytes.buffer, secondBytes.byteOffset, secondBytes.byteLength / Uint32Array.BYTES_PER_ELEMENT)
      if (!signal.aborted) {
        const resultText = `Result: ${values.join(', ')}.`
        const combined = `${resultText} Add the second vector again: ${secondValues.join(', ')}.`
        setStatus(combined)
        console.log(combined)
      }
    } catch (error) {
      if (!signal.aborted) setStatus(String(error))
    } finally {
      for (const resource of resources.reverse()) resource.dispose()
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Metal vector addition">
      <VStack spacing={12} padding>
        <Text>First vector: 2, 7, 4, 9.</Text>
        <Text>Second vector: 4, 3, 8, 2.</Text>
        <Button title="Run both additions on the GPU" action={() => { void addVectors() }} disabled={busy} />
        <Text>{status}</Text>
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    const device = Metal.Device.getDefault()
    if (!device) {
      await Dialog.alert({ message: 'No Metal device is available.' })
      return
    }
    await Navigation.present({ element: <VectorAddition device={device} /> })
  } catch (error) {
    await Dialog.alert({ title: 'Metal vector addition', message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
