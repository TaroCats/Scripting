import { Button, GeometryReader, Navigation, NavigationStack, Script, Text, VStack, useState } from "scripting"

function Example() {
  const [shift, setShift] = useState(0)
  return <NavigationStack>
    <VStack navigationTitle="Geometry Frames" coordinateSpace="panel" spacing={16}>
      <Text>Move the reader without changing its size.</Text>
      <Button title="Move / Reset" action={() => setShift(shift === 0 ? 40 : 0)} />
      <VStack offset={{ x: 0, y: shift }} frame={{ height: 100 }}>
        <GeometryReader coordinateSpaces={["global", { named: "panel" }]}>
          {proxy => {
            const local = proxy.frame("local")
            const panel = proxy.frame({ named: "panel" })
            const global = proxy.frame("global")
            return <VStack alignment="leading">
              <Text>{`local y: ${local.y.toFixed(1)}`}</Text>
              <Text>{`panel y: ${panel.y.toFixed(1)}`}</Text>
              <Text>{`global y: ${global.y.toFixed(1)}`}</Text>
              <Text>{`size: ${proxy.size.width.toFixed(1)} × ${proxy.size.height.toFixed(1)}`}</Text>
            </VStack>
          }}
        </GeometryReader>
      </VStack>
    </VStack>
  </NavigationStack>
}

await Navigation.present({ element: <Example /> })
Script.exit()
