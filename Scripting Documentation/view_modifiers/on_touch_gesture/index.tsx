import { Navigation, NavigationStack, Script, Text, VStack, modifiers, useState,
  type TouchGestureEvent } from "scripting"

function Example() {
  const [status, setStatus] = useState("Touch either surface")
  function receive(event: TouchGestureEvent) {
    setStatus(`${event.phase} ${event.touchId.slice(-6)}\n` +
      `x=${event.location.x.toFixed(1)} y=${event.location.y.toFixed(1)}\n` +
      `native delivery=${(event.receivedAt - event.timestamp).toFixed(1)}ms`)
  }
  return <NavigationStack>
    <VStack navigationTitle="Native Touch" spacing={20} padding={16}>
      <Text>{status}</Text>
      <Text frame={{ width: 240, height: 100 }} background="blue"
        onTouchGesture={{ onEvent: receive }}>JSX touch surface</Text>
      <Text frame={{ width: 240, height: 100 }} background="green"
        modifiers={modifiers().onTouchGesture({ onEvent: receive })}>Chained touch surface</Text>
      <Text>iOS 18+. This example updates every event; use buffered sampling for performance tests.</Text>
    </VStack>
  </NavigationStack>
}

async function run() {
  await Navigation.present({ element: <Example /> })
  Script.exit()
}

run()