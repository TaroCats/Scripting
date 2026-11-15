# Section

`Section` 用于将 `List` 中的行分组。通过 `header` 和 `footer` 在分组前后显示标题或说明。在支持折叠分组的列表中，使用 `isExpanded` 和 `onChanged` 控制展开状态。

```tsx
<Section header={<Text>设置</Text>}>
  <Text>通知</Text>
</Section>
```

让第一个子视图紧跟开始标签，或另起一行。开始标签与第一个子视图之间的同行空格和制表符会成为 JSX 文本子元素。如果编辑器标出这段空白，可以选择 **Remove inline whitespace** 快速修复，也可以将第一个子视图移到下一行。用 `Text` 视图显示文字。
