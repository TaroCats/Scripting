`MapReader` exposes native MapKit projection for the first contained `Map` (iOS 17+). Import `MapReader`, `Map` and UI components from `"scripting"`. `MapProxy`, `MapCoordinateSpace`, `MapCoordinate` and `Point` are types from that same package. `MapCameraPosition` is an injected global: it needs no import.

## Complete example

Paste this into an App script's `index.tsx`. Tap the map to convert its global gesture location into latitude/longitude, then into a point in the named panel. Conversion itself needs no location permission or VPN. Rotating, zooming and pitching use the current native camera projection.

```tsx
import { Map, MapReader, Navigation, NavigationStack, Script, Text, useState, VStack } from "scripting"

async function main() {
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
}

void main()
```

## API and coordinate spaces

```ts
import type { MapProxy, MapCoordinate, MapCoordinateSpace, Point } from "scripting"

// MapProxy is supplied by MapReader's child callback; do not construct it.
// proxy.convertPoint(point: Point, from?: MapCoordinateSpace): MapCoordinate | null
// proxy.convertCoordinate(coordinate: MapCoordinate, to?: MapCoordinateSpace): Point | null
```

- `"local"` (default) uses the map's local SwiftUI coordinate space; points are logical points, not physical screen pixels.
- `"global"` uses the root view's global SwiftUI space. Match the gesture's `coordinateSpace: "global"` with `convertPoint(point, "global")` as above.
- `{ named: "mapPanel" }` uses an ancestor with `coordinateSpace="mapPanel"`. The gesture modifier takes a **string** name (`coordinateSpace: "mapPanel"`); the proxy takes the **object** form (`{ named: "mapPanel" }`).

Use the same space for a conversion and its inverse. Do not pass an unrelated view's local gesture location as a map-local point. No `coordinateSpaces` declaration is required on MapReader. Prefer one map per reader.

## Null, invalid inputs and lifetime

Both methods are synchronous. Call them from gestures or other callbacks after layout, rather than during rendering. Handle `null`: MapKit may have no projection yet, no map, or a point outside the projected ground. A missing named space follows native SwiftUI behavior; declare the intended ancestor explicitly. A projected point is not a visibility or hit-test guarantee.

Coordinates must contain finite numeric `latitude` in `[-90,90]` and `longitude` in `[-180,180]`; points need finite numeric `x` and `y`. Strings, booleans, arrays, invalid spaces and empty names throw `TypeError`. Omit a space to use local; `null` is not a valid space.

A proxy follows camera changes while its reader is mounted. After removal, script exit, or use from another script context it returns `null`. A remounted reader supplies a new proxy; keep callbacks tied to the current reader rather than saving proxies across screens.

Native behavior: [Apple MapReader](https://developer.apple.com/documentation/mapkit/mapreader), [Apple MapProxy](https://developer.apple.com/documentation/mapkit/mapproxy).
