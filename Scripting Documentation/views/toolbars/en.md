The `toolbar` property allows you to populate the navigation bar, bottom toolbar, or keyboard accessory area with custom UI elements. This system is modeled after SwiftUI’s toolbar API and provides fine-grained placement control across various regions of the user interface.

This feature is useful for adding primary or contextual actions, organizing control groups, and enhancing keyboard interactions.

---

## Definition

```ts
toolbar?: ToolBarProps
```

### ToolBarProps

```ts
type ToolBarProps = {
  bottomBar?: VirtualNode | VirtualNode[]
  cancellationAction?: VirtualNode | VirtualNode[]
  confirmationAction?: VirtualNode | VirtualNode[]
  destructiveAction?: VirtualNode | VirtualNode[]
  keyboard?: VirtualNode | VirtualNode[]
  navigation?: VirtualNode | VirtualNode[]
  primaryAction?: VirtualNode | VirtualNode[]
  principal?: VirtualNode | VirtualNode[]
  topBarLeading?: VirtualNode | VirtualNode[]
  topBarTrailing?: VirtualNode | VirtualNode[]
}
```

---

## Placement Options

Each property of `ToolBarProps` determines where the specified items will be placed. You can use either a single `VirtualNode` or an array of nodes for each region.

* **`automatic`** *(implicit)*: Lets the system decide optimal placement based on context. Not explicitly defined as a prop.
* **`bottomBar`**: Adds items to the bottom toolbar.
* **`cancellationAction`**: Represents a cancellation action, typically used in modal contexts.
* **`confirmationAction`**: Represents a confirmation action, typically used in modal contexts.
* **`destructiveAction`**: Represents a destructive action, often styled with visual emphasis (e.g., red).
* **`keyboard`**: Displays the item in the keyboard accessory view when a text input is focused.
* **`navigation`**: Represents a navigation action (e.g., back or close).
* **`primaryAction`**: Marks an item as the primary action in the current context.
* **`principal`**: Positions the item in the center of the top navigation bar.
* **`topBarLeading`**: Places items on the leading edge (left in LTR languages) of the top navigation bar.
* **`topBarTrailing`**: Places items on the trailing edge (right in LTR languages) of the top navigation bar.

---

## Example

```tsx
<VStack
  navigationTitle={"Toolbars"}
  navigationBarTitleDisplayMode={"inline"}
  toolbar={{
    topBarTrailing: [
      <Button
        title={"Select"}
        action={() => {}}
      />,
      <ControlGroup
        label={
          <Button
            title={"Add"}
            systemImage={"plus"}
            action={() => {}}
          />
        }
        controlGroupStyle={"palette"}
      >
        <Button
          title={"New"}
          systemImage={"plus"}
          action={() => {}}
        />
        <Button
          title={"Import"}
          systemImage={"square.and.arrow.down"}
          action={() => {}}
        />
      </ControlGroup>
    ],
    bottomBar: [
      <Button
        title={"New Sub Category"}
        action={() => {}}
      />,
      <Button
        title={"Add category"}
        action={() => {}}
      />
    ],
    keyboard: <HStack padding>
      <Spacer />
      <Button
        title={"Done"}
        action={() => {
          Keyboard.hide()
        }}
      />
    </HStack>
  }}
>
  <TextField
    title={"TextField"}
    value={text}
    onChanged={setText}
    textFieldStyle={"roundedBorder"}
    prompt={"Focus to show the keyboard toolbar"}
  />
</VStack>
```

This example demonstrates:

* A **top bar** with a "Select" button and a **control group** offering "New" and "Import" options.
* A **bottom toolbar** with actions for creating categories.
* A **keyboard accessory view** with a “Done” button aligned to the right, which hides the keyboard when pressed.

---

## Notes

* All toolbar items support dynamic updates—changes in state will automatically reflect in the toolbar UI.
* Items placed in the `keyboard` section will only be visible when a text input field is focused.
* `ControlGroup` components are useful for grouping related toolbar buttons visually and functionally.

---

## iOS 27 additions

The following options require iOS 27.0+ and are ignored on earlier systems unless a fallback is listed.

### Toolbar items

`ToolbarItem`, `ToolbarItemGroup`, `DefaultToolbarItem`, and `ToolbarSpacer` accept:

* `visibilityPriority`: `"automatic"`, `"low"`, or `"high"`. Higher priority items remain visible longer as toolbar space shrinks.
* `contentMarginsRemoved`: a boolean that removes the item's content margins. It defaults to `false` and is independent of `sharedBackgroundVisibility`.

`placement="topBarPinnedTrailing"` pins an item to the trailing edge of the top bar. Earlier systems use `topBarTrailing`.

```tsx
<ToolbarItem placement="topBarPinnedTrailing" visibilityPriority="high" contentMarginsRemoved>
  <Button title="Done" action={dismiss} />
</ToolbarItem>
```

### Toolbar view modifiers

* `toolbarOverflowMenu`: a view containing actions for the toolbar's overflow menu, for example a `Group` of buttons.
* `toolbarMinimizationBehavior`: `"automatic"`, `"never"`, `"onScrollDown"`, `"onScrollUp"`, or `{ behavior, bars? }`.
* `toolbarMinimizationRestoration`: `"automatic"`, `"atScrollEdge"`, or `{ restoration, bars? }`. `atScrollEdge` is currently honored only for `navigationBar` with `onScrollDown`.
* `toolbarMinimizationSafeAreaAdjustment`: `"automatic"`, `"enabled"`, `"disabled"`, or `{ adjustment, bars? }`.
* `toolbarVisibility`: a `Visibility` value or `{ visibility, bars? }`. This modifier itself supports iOS 18.0+; `bars: ["statusBar"]` requires iOS 27.0+.

The `bars` field accepts `"automatic"`, `"navigationBar"`, `"bottomBar"`, `"tabBar"`, and `"statusBar"`. Omitting it uses the system's automatic placement. `toolbarColorScheme` also accepts `statusBar` in its `bars` array on iOS 27. These modifiers operate on bars managed by SwiftUI.

```tsx
<ScrollView
  toolbarMinimizationBehavior={{ behavior: "onScrollDown", bars: ["navigationBar"] }}
  toolbarMinimizationRestoration={{ restoration: "atScrollEdge", bars: ["navigationBar"] }}
  toolbarVisibility={{ visibility: "hidden", bars: ["statusBar"] }}
  toolbarOverflowMenu={<Group><Button title="Archive" action={archive} /></Group>}
>
  {/* content */}
</ScrollView>
```

All toolbar view modifiers also support `modifiers().toolbarOverflowMenu(...)`, `modifiers().toolbarVisibility(...)`, and the corresponding minimization methods. Item options belong on the toolbar item itself.

---

## Vertical toolbars (iOS 27.1+)

- `toolbarVerticalBehavior?: "automatic" | "disabled"`: allow the system to choose the toolbar orientation, or opt out of vertical bars in favor of horizontal top/bottom bars. It does not hide toolbars. Treat it as a stable layout choice, rather than toggling it frequently as users navigate; use toolbarVisibility to hide bars.
- `toolbarVerticalCompressionBehavior?: "automatic" | "prefersTabBar" | "prefersToolbarItems"`: choose which content should be preserved when vertical space is limited.
- `axisBehavior?: "automatic" | "horizontalOnly" | "verticalPreferred"`: a property of ToolbarItem, ToolbarItemGroup, DefaultToolbarItem and ToolbarSpacer, rather than a general view modifier. It sets an item's placement preference when vertical bars are available.

The two view modifiers also support fluent modifiers. Earlier systems ignore these options. They express preferences; they do not force a vertical toolbar on every device. EnvironmentValuesReader can read `toolbarVerticalEdge` as leading/trailing or null when no vertical bar is present. Preserve meaningful labels for toolbar actions as the layout changes.

```tsx
<NavigationStack toolbarVerticalBehavior="automatic" toolbarVerticalCompressionBehavior="prefersToolbarItems">
  <Text toolbar={<Toolbar>
    <ToolbarItem placement="topBarTrailing" axisBehavior="verticalPreferred">
      <Button title="Compose" action={compose} />
    </ToolbarItem>
  </Toolbar>}>Content</Text>
</NavigationStack>
```
