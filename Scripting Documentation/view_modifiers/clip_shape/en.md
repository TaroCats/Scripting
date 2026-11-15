`clipShape` clips a view's rendered content to a shape. It is a shared `CommonViewProps` property, available on `Text`, `VStack`, `Image`, `Button`, and other JSX views.

### Rounded corners

Use `clipShape={{ type: "rect", cornerRadius: 12 }}` to round a view. `cornerRadius` belongs to the shape descriptor; it is not a separate property on `Text` or `VStack`. Apply padding and the background before clipping the result.

```tsx
import { Image, Text, VStack } from "scripting"

function RoundedContent() {
  return <VStack spacing={12}>
    <Text padding={12} background="systemBlue" clipShape={{ type: "rect", cornerRadius: 12 }}>
      Rounded label
    </Text>
    <Image filePath="path/to/photo.jpg" clipShape="circle" />
    <Image filePath="path/to/photo.jpg" clipShape={{ type: "rect", cornerRadius: 12 }} />
  </VStack>
}
```

Shape names such as `"circle"` and `"capsule"` are lowercase. Object descriptors need double JSX braces, as in `clipShape={{ type: "rect", cornerRadius: 12 }}`.

### Clipping or a shaped background

`clipShape` clips the content and its background. To round only the background, use `background={{ style: "systemBlue", shape: { type: "rect", cornerRadius: 12 } }}`. See [foregroundStyle and background](scripting://doc?title=foregroundStyle%20%26%20background) for filled shapes and custom background views.

Clipping does not by itself define a custom hit-testing shape. See [contentShape](scripting://doc?title=contentShape) when the tappable area should follow a shape, and [Button](scripting://doc?title=Button) for button styles and independent actions in List rows.
