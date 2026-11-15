`clipShape` 将视图绘制的内容裁剪为指定形状。它是 `CommonViewProps` 中的通用属性，可用于 `Text`、`VStack`、`Image`、`Button` 等 JSX 视图。

### 圆角

使用 `clipShape={{ type: "rect", cornerRadius: 12 }}` 设置圆角。`cornerRadius` 属于形状描述，不是 `Text` 或 `VStack` 上的独立属性。先设置内边距和背景，再裁剪整体结果。

```tsx
import { Image, Text, VStack } from "scripting"

function RoundedContent() {
  return <VStack spacing={12}>
    <Text padding={12} background="systemBlue" clipShape={{ type: "rect", cornerRadius: 12 }}>
      圆角标签
    </Text>
    <Image filePath="path/to/photo.jpg" clipShape="circle" />
    <Image filePath="path/to/photo.jpg" clipShape={{ type: "rect", cornerRadius: 12 }} />
  </VStack>
}
```

`"circle"`、`"capsule"` 等形状名称使用小写。对象描述需要双层 JSX 花括号，例如 `clipShape={{ type: "rect", cornerRadius: 12 }}`。

### 裁剪与形状背景

`clipShape` 会裁剪内容及其背景。如果只希望背景带圆角，可使用 `background={{ style: "systemBlue", shape: { type: "rect", cornerRadius: 12 } }}`。形状填充和自定义背景视图参阅[前景和背景样式](scripting://doc?title=foregroundStyle%20%26%20background)。

裁剪本身不会定义自定义的点击区域。需要让点击区域跟随形状时，参阅 [contentShape](scripting://doc?title=contentShape)；按钮样式和 List 行内独立操作参阅[按钮](scripting://doc?title=Button)。
