Scripting provides a Drag & Drop API closely aligned with the SwiftUI drag-and-drop interaction model. It enables views to act as drag sources, drop destinations, or both, supporting intra-app and cross-app drag-and-drop scenarios.

The API is composed of three core parts:

* **onDrag**: Declares a view as a drag source
* **onDrop**: Declares a view as a drop destination
* **DropInfo / ItemProvider / UTType**: Context objects describing drag content and state

Drag and drop is a system-controlled interaction. Certain APIs are only valid during specific callbacks. These constraints are explicitly documented below and must be respected.

---

## Core Types

### DropInfo

`DropInfo` represents the real-time state of a drag operation relative to a specific drop target view.
It is only valid within `onDrop` callbacks.

### Properties

#### location: Point

* The current drag location
* Expressed in the **local coordinate space of the drop view**
* Commonly used for:

  * Insertion indicators
  * Reordering logic
  * Position-based highlighting

### Methods

#### hasItemsConforming(types: UTType[]): boolean

* Indicates whether at least one dragged item conforms to any of the specified UTTypes
* Commonly used in:

  * `validateDrop`
  * `dropEntered`
  * `dropUpdated`
* This method performs capability checks only and does not load data

#### itemProviders(types: UTType[]): ItemProvider[]

* Returns all `ItemProvider` instances conforming to the specified UTTypes
* **Only valid inside the `performDrop` callback**
* After `performDrop` returns, access to the dragged data is revoked by the system

> Critical constraint
> You must **start loading the contents** of the returned `ItemProvider` instances **within the scope of `performDrop`**.
> Loading may complete later, but it must be initiated synchronously before `performDrop` returns.

---

## DropOperation

`DropOperation` describes the action a drop target intends to perform.

Available values:

* `"copy"`
  Copies the dragged data (default and most common)

* `"move"`
  Moves the data instead of copying it (typically internal to the app)

* `"cancel"`
  Cancels the drag operation and transfers no data

* `"forbidden"`
  Explicitly disallows the drop at the current location

`DropOperation` is usually returned from `dropUpdated` to dynamically control the drag behavior.

---

## DragDropProps

`DragDropProps` defines the optional drag-and-drop capabilities that a view may adopt.

---

## onDrag

### Purpose

Marks the view as a **drag source**, allowing the user to initiate a drag operation from it.

### Definition

```ts
onDrag?: {
  data: () => ItemProvider
  preview: VirtualNode
}
```

### Parameters

#### data

```ts
data: () => ItemProvider
```

* Returns an `ItemProvider` describing the dragged data
* Supports text, images, files, URLs, and custom types
* Invoked each time a drag begins

Recommended practice:
Create a new `ItemProvider` instance for each drag operation. Do not reuse instances.

#### preview

```ts
preview: VirtualNode
```

* A view used as the drag preview
* Rendered by the system as a floating representation during dragging
* Centered over the source view by default

---

## onDrop

### Purpose

Marks the view as a **drop destination** and provides fine-grained control over validation, interaction updates, and data handling.

### Definition

```ts
onDrop?: {
  types: UTType[]
  validateDrop?: (info: DropInfo) => boolean
  dropEntered?: (info: DropInfo) => void
  dropUpdated?: (info: DropInfo) => DropOperation | null
  dropExited?: (info: DropInfo) => void
  performDrop: (info: DropInfo) => boolean
}
```

---

### onDrop.types

```ts
types: UTType[]
```

* Declares the content types this view can accept
* If the dragged content does not conform to any listed type:

  * The drop target does not activate
  * `validateDrop` is not called
  * Visual feedback is not shown

---

### validateDrop

```ts
validateDrop?: (info: DropInfo) => boolean
```

* Determines whether the drop operation should be allowed to begin
* Returning `false` immediately rejects the drag
* Common use cases:

  * Checking item count
  * Enforcing application state constraints

Default behavior: always returns `true`

---

### dropEntered

```ts
dropEntered?: (info: DropInfo) => void
```

* Called when the drag enters the drop target area
* Typically used to:

  * Show highlight states
  * Display insertion placeholders
  * Trigger animations

---

### dropUpdated

```ts
dropUpdated?: (info: DropInfo) => DropOperation | null
```

* Called repeatedly as the drag moves within the drop target
* Used to dynamically specify the intended `DropOperation`

Return value behavior:

* Returning a `DropOperation` updates the active operation
* Returning `null`:

  * Reuses the last valid operation
  * Falls back to `"copy"` if none was previously returned

---

### dropExited

```ts
dropExited?: (info: DropInfo) => void
```

* Called when the drag leaves the drop target area
* Commonly used to clear highlight or placeholder UI

---

### performDrop

```ts
performDrop: (info: DropInfo) => boolean
```

* **The most critical callback**
* Indicates that the user has released the drag and data access is permitted
* Return value:

  * `true` if the drop was successfully handled
  * `false` if the drop failed

#### Mandatory constraints

* Within this method, you must:

  * Call `info.itemProviders(...)`
  * Immediately initiate data loading from the returned providers
* You must not:

  * Store `ItemProvider` references for later use
  * Defer loading to unrelated callbacks

These constraints are enforced by the operating system for security reasons.

---

## Typical Interaction Flow

1. The user initiates a drag from an `onDrag` view
2. The system checks compatibility using `onDrop.types`
3. `validateDrop` is invoked
4. The drag enters the drop target → `dropEntered`
5. The drag moves within the target → repeated `dropUpdated`
6. The drag leaves the target → `dropExited`
7. The user releases the drag → `performDrop`
8. Data is loaded and processed

---

## Design Guidelines and Best Practices

* Declare UTTypes as narrowly as possible
* Use `"forbidden"` in `dropUpdated` to explicitly block invalid drops
* Perform heavy parsing or processing only after `ItemProvider` loading completes
* Prefer system-standard UTTypes (text, image, file, URL) for cross-app drag-and-drop


---

## iOS 27.0 drag sessions and text clipboard

All APIs below accept direct props and chained `modifiers()` calls. They are ignored on earlier systems. Return-value callbacks are synchronous; do not return a Promise.

- `dragConfiguration: { allowMove?: boolean, allowCopyOutsideApp?: boolean }`: app-internal moves default to false; external copies default to true.
- `onDragSessionUpdated(session)` and `onDropSessionUpdated(session)`: receive plain snapshots. `id` is an opaque session token. Drag snapshots contain phase, operation (or null), location, draggedItemIndex, and string draggedItemIDs. Drop snapshots contain phase, operation, location, size, itemsCount, suggestedOperations, isLocal, string draggedItemIDs, and reorderDestination (or null). IDs are empty when the source does not expose string IDs.
- `dropConfiguration(session)`: return `"copy"`, `"move"`, `"cancel"`, or `"forbidden"`; invalid results fall back to forbidden. It selects an operation and does not consume or process the payload; retain your drop handler.
- `draggable: { containerItemID: string, containerNamespace?: NamespaceID }`, `dragContainer: { payload: (itemIDs: string[]) => string[], namespace?: NamespaceID }`, and `dragContainerSelection: { selection: string[], containerNamespace?: NamespaceID }`: string Transferable payloads. In this bridge the string payload value is also its identifier; return those IDs as the payload. Use NamespaceReader to isolate containers if needed. For custom or file payloads retain `onDrag`/`onDrop` with ItemProvider.
- `copyable: string[] | (() => string[])`, `cuttable: () => string[]`, and `pasteDestination: { action: (items: string[]) => void, validator?: (items: string[]) => string[] }`: text clipboard operations. Omitted paste validator accepts every item. Cut must update the source data in its callback. These configure SwiftUI command handling on the view; they do not create buttons or menus.

The 27.0 SDK still marks the surrounding extension for `onCopyCommand`, `onCutCommand`, and `onPasteCommand` unavailable on iOS, so these names are not exposed. Generic Swift Transferable types are not JavaScript payload types; the new wrappers intentionally support strings.

```tsx
<VStack
  dragContainer={{ payload: ids => ids }}
  dragContainerSelection={{ selection: selectedIDs }}
  dragConfiguration={{ allowMove: true, allowCopyOutsideApp: false }}
>
  <Text draggable={{ containerItemID: "apple" }}>Apple</Text>
</VStack>

<Text copyable={() => [selectedText]} pasteDestination={{
  validator: items => items.filter(text => text.length > 0),
  action: items => insertText(items.join("\n")),
}}>Clipboard target</Text>
```

### Session snapshot types

`operation` is populated in ending/ended phases and is otherwise null. `unknown` is reserved for future native phases. `reorderDestination` is null outside native reorder containers. Coordinates are in points; snapshots do not expose native session methods or payload loading.

```ts
type DropOperation = 'cancel' | 'copy' | 'forbidden' | 'move'

export type DragSession = {
  id: string
  phase: 'initial' | 'active' | 'ending' | 'ended' | 'dataTransferCompleted' | 'unknown'
  operation: DropOperation | null
  location: { x: number, y: number }
  draggedItemIndex: number
  draggedItemIDs: string[]
}
export type DropSession = {
  id: string
  phase: 'entering' | 'active' | 'exiting' | 'ended' | 'dataTransferCompleted' | 'unknown'
  operation: DropOperation | null
  location: { x: number, y: number }
  size: { width: number, height: number }
  /** Proposed native reorder destination, or null outside a reorderable container. */
  reorderDestination: ReorderDestination | null
  itemsCount: number
  suggestedOperations: DropOperation[]
  isLocal: boolean
  draggedItemIDs: string[]
}
export type ReorderDestination = ({ position: 'before', itemID: string } | { position: 'end' }) & { collectionID?: string }
export type ReorderDifference = {
  sources: string[]
  destination: ReorderDestination
}

```

### Cut example

Return the text and clear the source synchronously.

```tsx
<Text cuttable={() => {
  const text = selectedText.value
  selectedText.value = ""
  return [text]
}}>{selectedText.value}</Text>
```
