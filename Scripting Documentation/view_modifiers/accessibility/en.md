# Accessibility Modifiers

A set of modifiers that describe your views to assistive technologies such as VoiceOver, mirroring the SwiftUI accessibility modifiers.

## Modifiers

### `accessibilityLabel?: string`
A short label that identifies the view (for example `"Play"` for a play button).

### `accessibilityHint?: string`
Describes what happens when the user performs the view's action (for example `"Plays the current track"`).

### `accessibilityValue?: string`
A textual description of the view's current value (for example `"70%"` for a slider).

### `accessibilityHidden?: boolean`
Hides the view from assistive technologies when `true`.

### `accessibilityIdentifier?: string`
A stable identifier used for UI testing. Not spoken by VoiceOver.

### `accessibilitySortPriority?: number`
The order in which this element is read relative to siblings. Higher numbers are read first.

### `accessibilityAddTraits?: AccessibilityTrait | AccessibilityTrait[]`
Adds one or more traits describing how the element behaves. One or more of:
`isButton`, `isHeader`, `isSelected`, `isLink`, `isSearchField`, `isImage`, `playsSound`, `isKeyboardKey`, `isStaticText`, `isSummaryElement`, `updatesFrequently`, `startsMediaSession`, `allowsDirectInteraction`, `causesPageTurn`, `isModal`, `isToggle` (iOS 17+).

### `accessibilityRemoveTraits?: AccessibilityTrait | AccessibilityTrait[]`
Removes the given traits from the element.

### `accessibilityHeading?: AccessibilityHeadingLevel`
Marks the view as a heading at a level: `unspecified`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`.

### `accessibilityElement?: boolean | AccessibilityChildBehavior`
Combines the view into a single accessibility element and controls how its children are exposed:
`ignore` (default), `contain`, or `combine`. Pass `true` as a shortcut for `ignore`.

## Example

```tsx
<Image
  systemName="play.fill"
  accessibilityLabel="Play"
  accessibilityHint="Plays the current track"
  accessibilityAddTraits="isButton"
/>

<HStack accessibilityElement="combine">
  <Text>Battery</Text>
  <Text>70%</Text>
</HStack>

<Text accessibilityHeading="h1">Chapter One</Text>
```

## Default activation and named actions

These APIs require a Scripting build that includes this update; Scripting 3.3.0 (27) and earlier do not implement them. They apply to a live foreground script UI, including Home UI with a live script context. Static Widget and Intent snapshots, background execution, and individual chart marks are not interactive callback surfaces for these APIs.

### `accessibilityAction?: () => void`
Handles default accessibility activation, such as VoiceOver double-tap. When supplied, this replaces the view's default accessibility activation; call the same operation as the touch control unless a different result is intentional. Adding `isButton` alone does not install an action.

### `accessibilityActions?: AccessibilityAction[]`
Adds named actions that VoiceOver users can choose from the element's actions. Each entry is `{ name: string; action: () => void }`. Names are user-facing strings supplied and localized by your script. Leading/trailing whitespace is removed; empty names, duplicate names, and non-function callbacks are ignored with a console warning. The first valid entry for a name wins, and valid actions retain their array order. An empty array removes the named actions supplied by this modifier.

Both APIs support JSX props and `modifiers()` chains. Callback return values do not determine native action success. Async callbacks may update script state when complete; thrown errors and rejected promises are reported to the script console. Do not retain or invoke bridge callback IDs: callbacks from a previous component build or an unmounted component are invalidated.

### Grouping and touch access

Use `ignore` only when the parent provides all necessary labels, state, and equivalent child actions. Use `combine` to group descriptive content, or `contain` to keep independent child controls accessible. Named actions do not automatically make a decorative view focusable; choose the appropriate element and role. Keep the same operation available to touch users.

The following complete script demonstrates a grouped counter with default activation and an additional named action, plus the fluent form:

```tsx
import { HStack, Navigation, Script, Text, VStack, modifiers, useState } from "scripting"

async function main() {
  function Counter() {
    const [count, setCount] = useState(0)
    const increment = () => setCount(value => value + 1)
    const reset = () => setCount(0)

    return <VStack spacing={20}>
      <HStack
        onTapGesture={increment}
        accessibilityElement="ignore"
        accessibilityLabel="Counter"
        accessibilityValue={String(count)}
        accessibilityHint="Adds one"
        accessibilityAddTraits="isButton"
        accessibilityAction={increment}
        accessibilityActions={[
          { name: "Add one", action: increment },
          { name: "Reset", action: reset }
        ]}
      >
        <Text>Counter</Text>
        <Text>{String(count)}</Text>
      </HStack>
      <Text modifiers={modifiers()
        .onTapGesture(reset)
        .accessibilityElement(true)
        .accessibilityLabel("Reset counter")
        .accessibilityAddTraits("isButton")
        .accessibilityAction(reset)
        .accessibilityActions([{ name: "Add one", action: increment }])
      }>Reset counter</Text>
    </VStack>
  }

  await Navigation.present(<Counter />)
  Script.exit()
}

void main()
```

## Custom navigation rotors

A rotor is a VoiceOver navigation category, such as “Favorites” or “Errors”. Select the category with the VoiceOver rotor gesture, then swipe up or down to navigate between its destinations. Named actions perform an operation on the current element; navigation rotors help users find another element. These APIs require a build containing this update and a live foreground script UI; Scripting 3.3.0 (27) and earlier do not implement them. Static Widget/Intent snapshots and background scripts are not supported navigation surfaces.

### `accessibilityRotor?: AccessibilityRotor`

Attach a custom category to a container:

```ts
interface AccessibilityRotor {
  label: string
  namespace: NamespaceID
  entries: AccessibilityRotorEntry[]
}
interface AccessibilityRotorEntry {
  id: string
  label: string
  prepare?: () => void
}
```

Obtain `namespace` from `NamespaceReader`. Entry order follows the array. Labels are user-facing strings localized by your script; leading/trailing whitespace is removed. IDs must be nonempty, stable strings and are preserved exactly: `"a"` and `" a "` are different destinations. Empty labels, whitespace-only IDs, malformed entries, and non-function preparation callbacks are ignored with console warnings. For duplicate IDs, the first valid entry wins. An empty entries array removes this modifier's category.

### `accessibilityRotorEntry?: AccessibilityRotorTarget`

Tag each destination with `{ id: string; namespace: NamespaceID }`. Its ID and namespace must match the category entry. Reuse the same namespace instance from the reader; separate namespaces isolate identical IDs. This tag preserves view identity and does not make a view accessible automatically. Tag the actual accessible element; a parent using `accessibilityElement="ignore"` can hide child destinations. Avoid duplicate destination tags within a namespace.

### Preparation, updates, and multiple categories

The optional `prepare` callback runs synchronously before native navigation. Use it to reveal or scroll to the destination; it does not activate the destination. Return values are ignored, promises are not awaited, and errors are reported to the script console. Do not rely on asynchronous loading or assume that a destination not yet created can be reached. In a lazy scroll view, pair `ScrollViewReader.scrollTo` with a matching row `key`. A successful preparation callback alone does not prove that VoiceOver moved focus.

Update the entries and tagged views together when data changes. Keep IDs stable through reordering, remove deleted destinations from the entries, and rebuild labels when names change. Old build/unmounted component callbacks are invalidated; never retain bridge event IDs. Text-range navigation and replacement of system rotor categories are outside these APIs.

JSX provides one category per prop. To add several categories to the same container, use repeated fluent calls, each with its own entries and label:

```ts
// favorites and errors are AccessibilityRotor values using the reader's namespace.
modifiers().accessibilityRotor(favorites).accessibilityRotor(errors)
```

This complete script supports lazy scrolling, reordering, and deletion. Enable VoiceOver, enter the list, select “Favorites” in its rotor, and swipe up/down to navigate. Test actual focus and speech on your device, including after using both buttons.

```tsx
import { Button, LazyVStack, NamespaceReader, Navigation, Script, ScrollView, ScrollViewReader, Text, VStack, useState } from "scripting"

async function main() {
  function ReadingList() {
    const [rows, setRows] = useState(() => Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`, title: `Article ${i + 1}`, favorite: i % 10 === 0
    })))

    return <NamespaceReader>{namespace =>
      <ScrollViewReader>{proxy =>
        <VStack>
          <Button title="Reverse order" action={() => setRows(items => [...items].reverse())} />
          <Button title="Remove first favorite" action={() => setRows(items => {
            const first = items.find(item => item.favorite)
            return items.filter(item => item.id !== first?.id)
          })} />
          <ScrollView accessibilityRotor={{
            label: "Favorites", namespace,
            entries: rows.filter(row => row.favorite).map(row => ({
              id: row.id, label: row.title,
              prepare: () => proxy.scrollTo(row.id, "center")
            }))
          }}>
            <LazyVStack>{rows.map(row =>
              <Text key={row.id}
                accessibilityElement={true}
                accessibilityLabel={row.title}
                accessibilityRotorEntry={{ id: row.id, namespace }}
              >{row.title}</Text>
            )}</LazyVStack>
          </ScrollView>
        </VStack>
      }</ScrollViewReader>
    }</NamespaceReader>
  }

  await Navigation.present(<ReadingList />)
  Script.exit()
}

void main()
```
