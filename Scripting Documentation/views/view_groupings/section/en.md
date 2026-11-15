# Section

`Section` groups rows in a `List`. Pass views to `header` and `footer` for labels around the group. Use `isExpanded` and `onChanged` to control expansion in lists that support collapsible sections.

```tsx
<Section header={<Text>Settings</Text>}>
  <Text>Notifications</Text>
</Section>
```

Keep the first child directly against the opening tag or start it on a new line. Spaces or tabs between the opening tag and the first child on the same line become a JSX text child. If the editor highlights that whitespace, choose **Remove inline whitespace**, or move the first child to a new line. Put visible text in a `Text` view.
