# ArrangementView（iOS 27.1+）

ArrangementView 使用系统 Arrangement 布局自适应排列主内容与次内容。提供 `primary: VirtualNode` 和 `secondary: VirtualNode`，其他 props 与链式 modifiers 配置外层容器。旧系统回退为 VStack，先显示 primary，再显示 secondary。

## 样式

`arrangementViewStyle` 支持 automatic、split、overlay，或 `{ style: "split" | "overlay", axes?: "horizontal" | "vertical" | "all" }`。省略 axes 时允许两个方向。automatic 根据设备与窗口环境选择布局，不应假设两个槽位始终同时可见；split 将两块内容并排放置，overlay 使用叠放布局。

## 分割布局尺寸

尺寸修饰符应放在 primary／secondary 内容上，而非最外层 ArrangementView：

- `splitArrangementLayoutRatio`：数值，或 `{ minHorizontal?, idealHorizontal?, maxHorizontal?, minVertical?, idealVertical?, maxVertical? }`。比例表示视图占可用布局的份额，空对象清除显式比例约束。
- `splitArrangementLayoutSize`：`{ minWidth?, idealWidth?, maxWidth?, minHeight?, idealHeight?, maxHeight? }`，单位为 point。
- `splitArrangementFixedLayoutSize`：true 固定两个方向，false 取消两个方向；对象形式 `{ horizontal?, vertical? }` 中省略的方向默认为 true。

系统会结合约束与 layoutPriority 决定实际尺寸。空间不足时，比例和尺寸偏好不保证精确尺寸。

## 叠放位置

在叠放内容上设置 `overlayArrangementEdge`：top、bottom、leading、trailing，automatic 清除显式边缘偏好。通过 `environments={{ overlayArrangementZIndex: 1 }}` 设置相对叠放层级。这些偏好不能替代正确的无障碍分组或焦点管理。

所有 Arrangement 视图修饰符均要求 iOS 27.1，旧系统忽略；直接 props 和链式 modifiers 均支持。

## 可访问布局

使用带明确标签的原生控件，在两个槽位中保留正确阅读顺序。内容移动或暂时隐藏时，常见任务仍应可访问。布局变化后需检查大字号、RTL、减少动态效果和 VoiceOver；不要仅因折叠角度变化就移动焦点。

```tsx
<ArrangementView
  primary={<VStack splitArrangementLayoutRatio={0.35}><Text>Conversation</Text></VStack>}
  secondary={<VStack splitArrangementLayoutSize={{ minWidth: 200 }}><Text>Details</Text></VStack>}
  arrangementViewStyle={{ style: "split", axes: "horizontal" }}
/>
```
