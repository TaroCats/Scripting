# ArrangementView (iOS 27.1+)

ArrangementView adapts primary and secondary content using the system's arrangement layout. Pass `primary: VirtualNode` and `secondary: VirtualNode`; additional props and fluent modifiers configure the container. On earlier systems both slots appear in a VStack, in primary-then-secondary order.

## Style

`arrangementViewStyle` accepts automatic, split, overlay, or `{ style: "split" | "overlay", axes?: "horizontal" | "vertical" | "all" }`. Omitted axes allow both. The automatic style follows the available device and window layout; do not assume both slots are always visible. Split places the two views beside one another, while overlay arranges overlapping content.

## Split sizing

Apply sizing modifiers to the primary or secondary content, not the outer ArrangementView:

- `splitArrangementLayoutRatio`: a number, or `{ minHorizontal?, idealHorizontal?, maxHorizontal?, minVertical?, idealVertical?, maxVertical? }`. Ratios express the view's share of the available layout. An empty object resets explicit ratio constraints.
- `splitArrangementLayoutSize`: `{ minWidth?, idealWidth?, maxWidth?, minHeight?, idealHeight?, maxHeight? }`, with sizes in points.
- `splitArrangementFixedLayoutSize`: true fixes both axes; false disables both; `{ horizontal?, vertical? }` defaults omitted axes to true.

The system resolves competing constraints and layoutPriority. Ratio and size preferences do not guarantee exact sizes when space is limited.

## Overlay placement

Apply `overlayArrangementEdge` to overlay content: top, bottom, leading, trailing, or automatic to clear the explicit edge preference. Set `environments={{ overlayArrangementZIndex: 1 }}` for its relative stacking order. These preferences do not replace standard accessibility grouping or focus management.

All arrangement view modifiers require iOS 27.1 and are ignored on earlier systems. All support direct props and fluent modifiers.

## Accessible layouts

Use native labeled controls and preserve a logical reading order in both slots. Keep common tasks accessible when content moves or is temporarily hidden. Test large Dynamic Type, RTL, Reduce Motion and VoiceOver after layout changes; avoid moving focus merely because the hinge angle changes.

```tsx
<ArrangementView
  primary={<VStack splitArrangementLayoutRatio={0.35}><Text>Conversation</Text></VStack>}
  secondary={<VStack splitArrangementLayoutSize={{ minWidth: 200 }}><Text>Details</Text></VStack>}
  arrangementViewStyle={{ style: "split", axes: "horizontal" }}
/>
```
