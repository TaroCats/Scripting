`MapReader` 提供第一个子 `Map` 的原生 MapKit 投影转换（iOS 17+）。`MapReader`、`Map` 和 UI 组件从 `"scripting"` 导入；`MapProxy`、`MapCoordinateSpace`、`MapCoordinate`、`Point` 类型也来自该包。`MapCameraPosition` 是自动注入的全局 API，无需导入。

## 可直接运行的示例

将以下内容放到 App 脚本的 `index.tsx`。点击地图，将手势的 global 点转换为经纬度，再转换为命名面板中的点。转换本身不需要定位权限或 VPN；旋转、缩放和倾斜均使用当前原生相机投影。

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

## 方法与坐标空间

```ts
import type { MapProxy, MapCoordinate, MapCoordinateSpace, Point } from "scripting"

// MapProxy 由 MapReader 的 children 回调提供，不自行构造。
// proxy.convertPoint(point: Point, from?: MapCoordinateSpace): MapCoordinate | null
// proxy.convertCoordinate(coordinate: MapCoordinate, to?: MapCoordinateSpace): Point | null
```

- `"local"`（默认）：地图的 SwiftUI 局部坐标，单位为逻辑点，不是屏幕物理像素。
- `"global"`：根视图的 SwiftUI 全局坐标。示例中手势使用 `coordinateSpace: "global"`，转换对应使用 `convertPoint(point, "global")`。
- `{ named: "mapPanel" }`：祖先视图通过 `coordinateSpace="mapPanel"` 声明的命名空间。注意手势参数接受**字符串**名称（`coordinateSpace: "mapPanel"`），proxy 参数接受**对象**（`{ named: "mapPanel" }`）。

正向、逆向转换应使用同一空间。其他视图的 local 手势点不能直接当作地图的 local 点。MapReader 无需声明 `coordinateSpaces`。建议每个 reader 只包含一个地图。

## null、参数与生命周期

两种方法同步返回，应在布局完成后的手势或事件回调中调用，避免在 render 中转换。必须处理 `null`：地图可能尚未布局、没有可用地图，或输入点不落在可投影的地面。缺失的命名空间遵循原生 SwiftUI 行为，请显式声明对应祖先。能转换出的点不代表它可见或能被点击。

经纬度必须为有限数值：`latitude` 在 `[-90,90]`，`longitude` 在 `[-180,180]`；点需要有限数值 `x`、`y`。字符串、布尔值、数组、无效空间或空名称会抛出 `TypeError`。省略空间表示 local；`null` 不是有效空间。

reader 挂载期间，已有 proxy 会跟随相机变化。reader 移除、脚本退出，或跨脚本 context 使用时返回 `null`。重新挂载会提供新 proxy；不要把旧页面的 proxy 缓存到新页面使用。

原生依据：[Apple MapReader](https://developer.apple.com/documentation/mapkit/mapreader)、[Apple MapProxy](https://developer.apple.com/documentation/mapkit/mapproxy)。
