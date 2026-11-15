`Path2D` is a vector path you build segment by segment, mirroring SwiftUI's `Path`. It is a
plain value: build it with line and curve commands, query its geometry, transform it, render it
with the `<PathShape>` view, or use it as a clipping / hit-testing / container shape.

> The name `Path2D` is used because `Path` is already taken by the file-path utilities. The
> drawing API itself follows SwiftUI's `Path`.

---

## Conventions

- Points are `{ x, y }`, rectangles are `{ x, y, width, height }`.
- Angles are in **radians**.
- Build methods are **chainable** (they return the path).
- Coordinates are absolute (in the shape's own coordinate space), exactly like SwiftUI's `Path`.

---

## Building a path

```tsx
// Imperative.
const p = new Path2D()
p.move({ x: 200, y: 100 })
p.addLine({ x: 100, y: 300 })
p.addLine({ x: 300, y: 300 })
p.closeSubpath()

// Or with a builder closure (mirrors SwiftUI's `Path { ... }`).
const heart = new Path2D(path => {
  path.move({ x: 150, y: 100 })
  path.addCurve({ x: 150, y: 300 }, { x: 0, y: 180 }, { x: 80, y: 320 })
  path.addCurve({ x: 150, y: 100 }, { x: 220, y: 320 }, { x: 300, y: 180 })
})
```

### Build methods

| Method | Description |
| --- | --- |
| `move(to)` | Begin a new subpath at a point. |
| `addLine(to)` | Add a straight line from the current point. |
| `addLines(points)` | Add connected line segments, starting at the first point. |
| `addQuadCurve(to, control)` | Quadratic Bézier curve with one control point. |
| `addCurve(to, control1, control2)` | Cubic Bézier curve with two control points. |
| `addArc({ center, radius, startAngle, endAngle, clockwise? })` | Circular arc. Angles in radians. |
| `addRelativeArc({ center, radius, startAngle, delta })` | Arc described by a start angle and an angular delta. |
| `addRect(rect)` | A rectangular subpath. |
| `addRoundedRect({ rect, cornerRadius? \| cornerSize?, style? })` | A rounded rectangle. |
| `addEllipse(rect)` | An ellipse inscribed in a rectangle. |
| `addPath(other)` | Append another `Path2D`. |
| `closeSubpath()` | Close the current subpath. |

> `clockwise` follows SwiftUI's convention. This is the opposite of the Web Canvas
> `counterclockwise` flag — keep that in mind when porting Canvas code.

---

## Rendering with `<PathShape>`

`<PathShape>` renders a `Path2D` as a SwiftUI shape. It accepts `fill`, `stroke`, `trim` and all
view modifiers, exactly like `Rectangle` or `Circle`. Provide **either** `path` (a prebuilt value)
**or** `draw` (a size-responsive builder, like `<Canvas>`).

```tsx
// Static path.
<PathShape path={heart} fill="systemPink" />

// Size-responsive: the closure receives the draw size on every layout.
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

Sizing is controlled by view modifiers (`frame`, `padding`, ...). With `draw`, the actual draw size
is the second argument; do not call `setState` inside the closure.

---

## Geometry queries

These are computed on demand and return immediately.

```tsx
heart.boundingRect()                  // { x, y, width, height }
heart.contains({ x: 150, y: 200 })    // boolean
heart.contains({ x: 0, y: 0 }, true)  // even-odd fill rule
heart.isEmpty()                       // boolean
heart.currentPoint()                  // { x, y } | null
```

---

## Transforming

Transforms return a **new** `Path2D` (the original is unchanged).

```tsx
const moved = heart.offsetBy(40, 0)
const scaled = heart.applying({ a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 })
const half = heart.trimmedPath(0, 0.5)   // first half of the path's length
```

---

## As a clip / content / container shape

Pass a `Path2D` anywhere a shape is accepted:

```tsx
<Image imageUrl={url} clipShape={heart} />
<Color color="black" contentShape={heart} />
```

To use a path as a **mask**, render it as a `<PathShape>` and pass that view to `mask`:

```tsx
<Image imageUrl={url} mask={<PathShape path={heart} fill="black" />} />
```


## CustomShape: animate a custom outline

`CustomShape` is a native SwiftUI shape with one animatable numeric `value`.
Its synchronous `path(value, rect)` builder returns a `Path2D`. SwiftUI interpolates the value and
passes the current presentation value plus `{ x, y, width, height }` to each path evaluation.
It supports the same fill, stroke, trim, and view modifiers as `PathShape`.

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
<Button title="Morph" action={() => setBend(bend === 0 ? 1 : 0)} />
```

You can also update `value` inside `withAnimation`. Without an animation transaction it jumps to the target.
Use the builder's first argument, not a captured target state, to compute the path.
The builder may run multiple times per frame. Return a `Path2D` synchronously and avoid state changes,
network requests, and other side effects. Errors or invalid returns log an error and render an empty path.
The target value must be finite; spring animations may overshoot their endpoints.
Each evaluation still calls JS and parses path commands, so measure complex paths on device.
System-rendered widget snapshots do not guarantee continuous animation.
This API interpolates one number; it does not automatically match arbitrary path vertices or animate static Path2D clip shapes.
