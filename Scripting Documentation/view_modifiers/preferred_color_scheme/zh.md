设置最近的弹窗或窗口的首选外观，取值为浅色或深色。`Navigation.present` 会同步该弹窗控制器的外观，无需同时设置 `environments.colorScheme`。省略属性后恢复继承系统或父宿主外观。

```ts
preferredColorScheme?: "light" | "dark"
```

```tsx
<NavigationStack preferredColorScheme="dark">
  <List>
    <Text>深色弹窗</Text>
  </List>
</NavigationStack>
```

外层明确设置的偏好优先于其子视图；同级偏好冲突时深色优先。Sheet、popover、fullScreenCover 与另一个 `Navigation.present` 属于独立呈递，不改变后面的父弹窗。

若只需改变局部子树，请使用 `environments={{ colorScheme: "dark" }}`。通过 `EnvironmentValuesReader` 读取局部环境；`useColorScheme()` 订阅脚本根视图的主题事件，不表示某个子树的局部覆盖。
