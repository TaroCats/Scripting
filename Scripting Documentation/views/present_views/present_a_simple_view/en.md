This example demonstrates how to display a basic UI screen in the Scripting app using the `Navigation.present` API. It also shows how to set up navigation-related features such as the navigation stack and page title.

---

## Overview

You will learn how to:

* Present a custom view using `Navigation.present`
* Create a structured layout using `NavigationStack` and `VStack`
* Set the navigation bar title using `navigationTitle`

---

## Example Code

```tsx
import { Navigation, NavigationStack, Script, Text, VStack } from "scripting"

function View() {

  return <NavigationStack>
    <VStack
      navigationTitle={"Present a simple view"}
    >
      <Text>Hello Scripting!</Text>
    </VStack>
  </NavigationStack>
}

async function run() {
  await Navigation.present({
    element: <View />
  })

  Script.exit()
}

run()
```

---

## Key Components

### `Navigation.present(options)`

This function displays the given UI element modally. It defaults to a system sheet (`pageSheet`); use `modalPresentationStyle` to choose another style. It takes an `element` property that defines the root view to show.

```ts
await Navigation.present({
  element: <View />
})
```

### `NavigationStack`

This component provides a navigation container that supports title display, navigation bar buttons, and structured transitions. It must be the outermost wrapper for views that use navigation features.

### `VStack`

A vertical layout container that stacks children in a top-to-bottom arrangement. In this example, it holds a single `Text` component.

### `navigationTitle`

Set on `VStack`, this prop sets the title shown in the navigation bar.

---

## Output

This example displays a simple page with the title **"Present a simple view"** and a message reading **"Hello Scripting!"** in the center of the screen.

---

## Notes

* Always wrap your views in `NavigationStack` if you want navigation behavior like back buttons, titles, or toolbars.
* Don’t forget to call `Script.exit()` after `Navigation.present()` resolves to avoid memory leaks.


## Full-screen edge swipe

The object form of `Navigation.present` accepts `swipeBackBehavior`:

```ts
swipeBackBehavior?: "disabled" | "dismiss" | "minimize"
```

Swipe **right from the left edge** to move the page with your finger. Release far enough, or with enough rightward speed, to complete the action; otherwise the page returns to its original position. A cancelled swipe does not close or minimize anything, resolve the promise, or emit a minimization event.

| Value | Completed swipe |
| --- | --- |
| `"disabled"` (default) | No modal edge swipe. Existing scripts keep their behavior. |
| `"dismiss"` | Close this presented page. `present()` resolves with `undefined`, just like calling this page's `Navigation.useDismiss()()` without a result. This does not itself terminate the script. |
| `"minimize"` | Hide the entire script while keeping its UI and running state. `present()` stays pending. Emit `Script.onMinimize` once after completion; restoring the script reuses the page and emits `Script.onResume`. |

### Scope and navigation

- Supported only for `modalPresentationStyle: "fullScreen"` or `"overFullScreen"`. Other styles ignore this option and keep their system interactions. The default presentation style is `pageSheet`, so specify a supported full-screen style explicitly.
- A visible `NavigationStack` with a pushed destination handles back first. The modal action becomes available at the navigation root. A modal displayed above this page must be dismissed first.
- `interactiveDismissDisabled={true}` on the page blocks this swipe and its VoiceOver escape action. Set it back to `false` to allow them again. Programmatic dismissal remains available.
- `"minimize"` works only for the script's first presented page in an environment where `Script.supportsMinimization()` returns `true`. On a nested `Navigation.present` page, or in an unsupported environment such as a dedicated script window, the minimize gesture is **disabled**. It never falls back to closing the page. The option does not control window closing.
- `Script.enableMinimize()` continues to control the system sheet's swipe-down behavior. This full-screen option is independent: `"minimize"` needs no call to `enableMinimize()`, and `"dismiss"` always closes the page even when that setting is enabled.
- `Navigation.useDismiss()(result)` still closes the page and returns the supplied result, regardless of this option. `Script.exit()` still terminates the script. Programmatic `useDismiss` can also close a page while it is minimized.

### Example: close a page

```tsx
import { Button, Navigation, NavigationStack, Script, VStack } from "scripting"

function Page() {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack navigationTitle="Full-screen page">
      <Button title="Close" action={() => dismiss()} />
    </VStack>
  </NavigationStack>
}

async function run() {
  await Navigation.present({
    element: <Page />,
    modalPresentationStyle: "fullScreen",
    swipeBackBehavior: "dismiss",
  })
  Script.exit()
}
run()
```

### Example: minimize a script

```tsx
import { Button, Navigation, NavigationStack, Script, VStack } from "scripting"

function Page() {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack navigationTitle="Resumable script">
      {Script.supportsMinimization() && <Button title="Minimize" action={async () => { await Script.minimize() }} />}
      <Button title="Close" action={() => dismiss()} />
    </VStack>
  </NavigationStack>
}

async function run() {
  const canMinimize = Script.supportsMinimization()
  await Navigation.present({
    element: <Page />,
    modalPresentationStyle: "overFullScreen",
    swipeBackBehavior: canMinimize ? "minimize" : "disabled",
  })
  // Minimizing does not reach this line. Closing the page does.
  Script.exit()
}
run()
```

At the page root, VoiceOver's two-finger scrub (escape) performs the configured action when available. Keep a clearly labelled Close button, and a Minimize button where supported, so these tasks also remain available without edge gestures. The transition respects Reduce Motion.
