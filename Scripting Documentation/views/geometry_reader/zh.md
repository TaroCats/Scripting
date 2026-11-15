`GeometryReader` 是 Scripting 中与 SwiftUI 等效的几何布局读取组件。
它能够在视图构建阶段提供当前容器的尺寸、边距、安全区域和角落内边距等信息，使开发者可以根据环境动态布局内容。

当你需要根据父容器的大小进行自适应布局（响应式布局）时，`GeometryReader` 是非常重要的工具。

---

## GeometryProxy

当 `GeometryReader` 构建其子内容时，会将一个 `GeometryProxy` 实例传递给 `children` 回调。开发者可以使用此对象访问与当前容器相关的布局信息。

```ts
interface GeometryProxy {
  frame(space: GeometryCoordinateSpace): Readonly<Rect>;
  readonly size: Size;
  readonly safeAreaInsets: {
      leading: number;
      top: number;
      trailing: number;
      bottom: number;
  };
  /**
   * Requires iOS 26.0+.
   */
  readonly containerCornerInsets: {
      bottomLeading: Size;
      bottomTrailing: Size;
      topLeading: Size;
      topTrailing: Size;
  } | null;
}
```

---

## GeometryProxy 属性说明

## 1. size

```ts
readonly size: Size
```

当前容器在布局时的实际尺寸。

### Size 结构

```ts
type Size = {
  width: number
  height: number
}
```

### 示例

```tsx
proxy.size.width
proxy.size.height
```

用于动态计算子视图布局，例如宽高比、自适应排版等。

---

## 2. safeAreaInsets

```ts
readonly safeAreaInsets: {
  leading: number
  top: number
  trailing: number
  bottom: number
}
```

当前视图所处环境中的安全区域内边距，包括顶部、底部、左右侧的避让区域。
通常用于避免内容被刘海、Home Indicator 等遮挡。

### 示例用途：

* 内容距离屏幕底部安全区域以上对齐
* 自定义导航栏、工具栏时避免被遮挡
* 实现与设备 UI 边界一致的响应式布局

---

## 3. containerCornerInsets（iOS 26.0+）

```ts
readonly containerCornerInsets: {
  bottomLeading: Size
  bottomTrailing: Size
  topLeading: Size
  topTrailing: Size
} | null
```

该属性仅在 **iOS 26+** 提供，并在设备或容器具有物理圆角偏移时报告每个角落的内边距。

### 用途

* 为圆角窗口、Stage Manager 或分屏环境适配布局
* 在容器圆角内做精确的 UI 对齐

如果平台不支持，则为 `null`。

---

## GeometryReader

```ts
type GeometryReaderProps = {
  coordinateSpaces?: readonly GeometryCoordinateSpace[];
  children: (proxy: GeometryProxy) => VirtualNode;
};
declare const GeometryReader: FunctionComponent<GeometryReaderProps>;
```

## Props 说明

| 属性名      | 类型                                      | 必须 | 说明                                     |
| -------- | --------------------------------------- | -- | -------------------------------------- |
| children | `(proxy: GeometryProxy) => VirtualNode` | 是  | 构建内容的回调函数，传入 `GeometryProxy` 用于读取布局信息。 |

---

## 工作机制

1. GeometryReader 占据父布局中的位置，并在布局阶段获取当前容器的尺寸与安全区域信息。
2. 将 `GeometryProxy` 注入给 `children(proxy)` 回调。
3. 回调返回的内容将根据读取的信息动态布局。

与 SwiftUI 一样，`GeometryReader` 默认会扩展到可用空间。

---

## 示例：居中布局

```tsx
import { GeometryReader, Text, VStack } from "scripting"

function View() {
  return <GeometryReader>
    {(proxy) => {
      return <VStack
        frame={{
          width: proxy.size.width,
          height: proxy.size.height,
          alignment: "center"
        }}
      >
        <Text>Hello Geometry</Text>
        <Text>
          width: {proxy.size.width}
        </Text>
        <Text>
          height: {proxy.size.height}
        </Text>
      </VStack>
    }}
  </GeometryReader>
}
```

---

## 示例：根据安全区域调整布局

```tsx
<GeometryReader>
  {(proxy) => {
    return <VStack
      padding={{
        top: proxy.safeAreaInsets.top,
        bottom: proxy.safeAreaInsets.bottom
      }}
    >
      <Text>Content inside safe area.</Text>
    </VStack>
  }}
</GeometryReader>
```

---

## 示例（iOS 26+）：读取 containerCornerInsets

```tsx
<GeometryReader>
  {(proxy) => {
    const corners = proxy.containerCornerInsets
    return <Text>
      {corners == null
        ? "Corner insets not available"
        : `Top Leading Corner: ${corners.topLeading.width}, ${corners.topLeading.height}`
      }
    </Text>
  }}
</GeometryReader>
```

---

## 使用建议

* 在需要响应容器尺寸时使用 GeometryReader，例如图片缩放、动态布局、等比布局。
* 避免将大量复杂布局放入 GeometryReader 内，可能影响性能（同 SwiftUI）。


---

## 同心圆角半径（iOS 27.0+）

`proxy.concentricCornerRadii` 返回 `{ topLeading, bottomLeading, bottomTrailing, topTrailing }`，单位是 point，表示当前几何布局适用的同心矩形圆角半径。旧系统或 SwiftUI 没有圆角信息时为 `null`。它是布局快照，随 `size` 和 `safeAreaInsets` 一起更新，不保留原生 GeometryProxy，也不提供任意 frame 查询。


## frame(space)：坐标空间矩形（iOS 17+）

`proxy.frame(space)` 对应 SwiftUI 的 `GeometryProxy.frame(in:)`，返回 `{x,y,width,height}`（point 单位）。测量的是 GeometryReader 容器在指定空间的矩形；global 遵循 SwiftUI 语义，不保证等于物理屏幕坐标。

local 始终可读。其他空间必须通过 `coordinateSpaces` 预先声明；省略或空数组只测量 local，减少位置变化重建。命名空间使用非空 `{named: "panel"}`，名称不会与内置 token 冲突。通过已有 `coordinateSpace="panel"` 给祖先命名，不要只给 reader 的子视图命名。

`"scrollView"` 选择最近的包含它的滚动容器；轴版本选择最近的允许指定轴滚动的容器。需要实际存在匹配祖先；缺失时保留原生行为，不伪造零矩形、不承诺检测祖先存在。

非法参数、空名称及未声明空间会报错。返回值只读；重复声明会去重。frame 是本次布局快照，保留旧 proxy 仍读取旧结果。位置变化时即使 size 不变也会重新构建 children，不保证每帧回调。变换可能使 frame 宽高与 size 不同。避免由 frame 反复改变自身布局形成反馈循环；滚动监听优先用专门的滚动 API。

运行 `index.tsx`，点击 Move / Reset 对比 size 不变时 local、panel 和 global 的 y。

```ts
type GeometryCoordinateSpace =
  | "local" | "global" | "scrollView"
  | Readonly<{ named: string }>
  | Readonly<{ scrollViewAxis: "horizontal" | "vertical" }>
```

```tsx
<VStack coordinateSpace="panel">
  <GeometryReader coordinateSpaces={["global", { named: "panel" }]}>
    {proxy => {
      const local = proxy.frame("local")
      const panel = proxy.frame({ named: "panel" })
      return <Text>{`local y=${local.y}, panel y=${panel.y}`}</Text>
    }}
  </GeometryReader>
</VStack>
```

---

## 预留区域（iOS 27.1+）

`proxy.reservedRegions(kind, options?)` 返回 `kind: "occlusion" | "division"` 的布局快照。每个 ReservedRegion 包含 kind、frame（`{ x, y, width, height }`）、margins（`{ top, bottom, leading, trailing }`）、isActive。frame 使用 GeometryReader 的本地坐标，单位为 point；旧系统返回空数组。

默认两个 kind 都查询当前活动区域，并使用镜像布局方向。非默认查询应先在 `GeometryReader.reservedRegionQueries` 中声明，再使用相同选项调用 reservedRegions。选项为 `includeInactive?: boolean` 和 `layoutDirectionBehavior?: "fixed" | "mirrors" | { mirrors: "leftToRight" | "rightToLeft" }`。调用未声明的非默认查询会抛错。区域和 frame 都是当前布局构建的快照，保留 proxy 不会得到持续更新的对象。

可据此避免将控件放在折痕或遮挡区域下，同时保留正确阅读顺序和常见任务的操作入口。支持此 API 的系统上也可能返回空数组。

```tsx
<GeometryReader reservedRegionQueries={[{ kind: "division", includeInactive: true }]}>
  {proxy => <Text>{proxy.reservedRegions("division", { includeInactive: true }).length} division regions</Text>}
</GeometryReader>
```
