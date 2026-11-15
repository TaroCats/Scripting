import { Map, MapReader, Navigation, NavigationStack, Script, Text, useState, VStack } from "scripting"

function Example() {
  const [result, setResult] = useState("Tap the map")
  return <NavigationStack>
    <MapReader>
      {proxy => <VStack coordinateSpace="mapPanel" navigationTitle="Map Projection">
        <Map
          initialCameraPosition={MapCameraPosition.camera({
            centerCoordinate: { latitude: 37.3349, longitude: -122.0090 },
            distance: 2400, heading: 30, pitch: 45,
          })}
          frame={{ height: 360 }}
          onTapGesture={{
            coordinateSpace: "global",
            perform: point => {
              const coordinate = proxy.convertPoint(point, "global")
              if (coordinate === null) {
                setResult("Projection unavailable")
                return
              }
              const panelPoint = proxy.convertCoordinate(coordinate, { named: "mapPanel" })
              setResult(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
                + (panelPoint ? ` / panel: ${panelPoint.x.toFixed(1)}, ${panelPoint.y.toFixed(1)}` : ""))
            },
          }}
        />
        <Text>{result}</Text>
      </VStack>}
    </MapReader>
  </NavigationStack>
}

await Navigation.present({ element: <Example /> })
Script.exit()
