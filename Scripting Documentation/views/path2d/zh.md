`Path2D` 是一条按段构建的矢量路径,语义对齐 SwiftUI 的 `Path`。它是一个普通的值:用直线 / 曲线命令
构建它,查询它的几何信息,对它做变换,用 `<PathShape>` 视图渲染它,或把它当作裁剪 / 命中 / 容器形状。

> 之所以叫 `Path2D`,是因为 `Path` 这个名字已被文件路径工具占用。绘制 API 本身遵循 SwiftUI 的 `Path`。

---

## 约定

- 点用 `{ x, y }`,矩形用 `{ x, y, width, height }`。
- 角度单位是**弧度**。
- 构建方法**可链式调用**(返回路径本身)。
- 坐标是绝对坐标(在形状自己的坐标系内),与 SwiftUI 的 `Path` 一致。

---

## 构建路径

```tsx
// 命令式。
const p = new Path2D()
p.move({ x: 200, y: 100 })
p.addLine({ x: 100, y: 300 })
p.addLine({ x: 300, y: 300 })
p.closeSubpath()

// 或用构建闭包(对应 SwiftUI 的 `Path { ... }`)。
const heart = new Path2D(path => {
  path.move({ x: 150, y: 100 })
  path.addCurve({ x: 150, y: 300 }, { x: 0, y: 180 }, { x: 80, y: 320 })
  path.addCurve({ x: 150, y: 100 }, { x: 220, y: 320 }, { x: 300, y: 180 })
})
```

### 构建方法

| 方法 | 说明 |
| --- | --- |
| `move(to)` | 在某点开始一条新子路径。 |
| `addLine(to)` | 从当前点画一条直线。 |
| `addLines(points)` | 添加一串相连的线段,从第一个点开始。 |
| `addQuadCurve(to, control)` | 单控制点的二次贝塞尔曲线。 |
| `addCurve(to, control1, control2)` | 双控制点的三次贝塞尔曲线。 |
| `addArc({ center, radius, startAngle, endAngle, clockwise? })` | 圆弧,角度为弧度。 |
| `addRelativeArc({ center, radius, startAngle, delta })` | 由起始角与角度增量描述的圆弧。 |
| `addRect(rect)` | 矩形子路径。 |
| `addRoundedRect({ rect, cornerRadius? \| cornerSize?, style? })` | 圆角矩形。 |
| `addEllipse(rect)` | 内切于矩形的椭圆。 |
| `addPath(other)` | 追加另一条 `Path2D`。 |
| `closeSubpath()` | 闭合当前子路径。 |

> `clockwise` 遵循 SwiftUI 的约定,与 Web Canvas 的 `counterclockwise` 标志相反 —— 从 Canvas 迁移代码时请注意。

---

## 用 `<PathShape>` 渲染

`<PathShape>` 把 `Path2D` 渲染成 SwiftUI 形状,支持 `fill`、`stroke`、`trim` 以及全部 view modifier,
与 `Rectangle`、`Circle` 完全一致。传 `path`(预先构建好的值)**或** `draw`(尺寸响应式构建闭包,类似 `<Canvas>`),二选一。

```tsx
// 静态路径。
<PathShape path={heart} fill="systemPink" />

// 尺寸响应式:闭包每次布局时收到绘制尺寸。
<PathShape
  fill="orange"
  stroke={{ shapeStyle: "black", strokeStyle: { lineWidth: 2 } }}
  draw={(path, size) => {
    path.move({ x: size.width / 2, y: 0 })
    path.addLine({ x: 0, y: size.height })
    path.addLine({ x: size.width, y: size.height })
    path.closeSubpath()
  }}
/>
```

尺寸由 view modifier 控制(`frame`、`padding` 等)。使用 `draw` 时,实际绘制尺寸是第二个参数;不要在闭包里调用 `setState`。

---

## 几何查询

按需计算,立即返回。

```tsx
heart.boundingRect()                  // { x, y, width, height }
heart.contains({ x: 150, y: 200 })    // boolean
heart.contains({ x: 0, y: 0 }, true)  // 使用 even-odd 填充规则
heart.isEmpty()                       // boolean
heart.currentPoint()                  // { x, y } | null
```

---

## 变换

变换返回一条**新的** `Path2D`(原路径不变)。

```tsx
const moved = heart.offsetBy(40, 0)
const scaled = heart.applying({ a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 })
const half = heart.trimmedPath(0, 0.5)   // 路径长度的前半段
```

---

## 当作裁剪 / 命中 / 容器形状

在任何接受形状的地方传入 `Path2D`:

```tsx
<Image imageUrl={url} clipShape={heart} />
<Color color="black" contentShape={heart} />
```

要把路径当作**遮罩(mask)**,把它渲染成 `<PathShape>` 再传给 `mask`:

```tsx
<Image imageUrl={url} mask={<PathShape path={heart} fill="black" />} />
```


## CustomShape：让轮廓随参数动画

`CustomShape` 是原生 SwiftUI 自定义 Shape，支持一个可动画数值 `value`。
`path(value, rect)` 同步返回一个 `Path2D`；SwiftUI 插值 `value`，每次求路径时将当前插值值和
`{ x, y, width, height }` 绘制矩形传入回调。与 `PathShape` 一样支持 fill、stroke、trim 和 view modifier。

```tsx
const [bend, setBend] = useState(0)

<CustomShape
  value={bend}
  animation={{ animation: Animation.easeOut(0.8), value: bend }}
  fill="systemBlue"
  frame={{ width: 280, height: 160 }}
  path={(value, rect) => new Path2D(p => {
    const bottom = rect.y + rect.height
    p.move({ x: rect.x, y: bottom })
    p.addQuadCurve(
      { x: rect.x + rect.width, y: bottom },
      { x: rect.x + rect.width / 2, y: rect.y - value * rect.height },
    )
    p.closeSubpath()
  })}
/>
<Button title="变形" action={() => setBend(bend === 0 ? 1 : 0)} />
```

也可在 `withAnimation` 中更新 `value`。没有动画事务时，参数直接跳到目标值。
请使用回调第一个参数计算路径，不要捕获外层目标值 `bend`，否则会跳过插值。
回调可能每帧调用多次，必须同步返回 `Path2D`；不要在其中 setState、发请求或执行其他副作用。
抛错或返回错误类型时记录错误并渲染空路径。`value` 必须是有限数；弹簧动画可能超出起终点范围。
路径仍有每帧 JS 调用和指令解析开销，复杂路径需在设备上验证帧率；Widget 的系统快照不保证连续动画。
目前仅插值一个数值，不自动匹配两条任意路径的顶点，也不扩展静态 Path2D 裁剪形状的动画接口。
