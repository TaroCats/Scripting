This example demonstrates how to use the `List` component to present structured data using custom row layouts. Each row displays a person's name and phone number in a clean and readable format, using stack-based layout components inspired by SwiftUI.

## Overview

You will learn how to:

* Define a custom row component (`PersonRowView`)
* Use `List` to display a collection of items
* Apply text styling and system icons
* Structure layouts using `VStack` and `HStack`

---

## Example Code

### 1. Import Dependencies and Define Data

```tsx
import { HStack, Label, List, Navigation, NavigationStack, Script, Text, VStack } from "scripting"

type Person = {
  name: string
  phoneNumber: string
}
```

### 2. Create a Row Component

The `PersonRowView` component renders the content of a single list row. It uses a vertical stack to separate the name and phone number, with appropriate font styles and colors.

```tsx
function PersonRowView({
  person
}: {
  person: Person
}) {
  return <VStack
    alignment={"leading"}
    spacing={3}
  >
    <Text
      foregroundStyle={"label"}
      font={"headline"}
    >{person.name}</Text>
    <HStack
      spacing={3}
      foregroundStyle={"secondaryLabel"}
      font={"subheadline"}
    >
      <Label
        title={person.phoneNumber}
        systemImage={"phone"}
      />
    </HStack>
  </VStack>
}
```

### 3. Display the List in a Navigation Stack

Use `NavigationStack` and `List` to display all rows. The navigation title is set to describe the purpose of the view.

```tsx
function Example() {
  const staff: Person[] = [
    {
      name: "Juan Chavez",
      phoneNumber: "(408) 555-4301",
    },
    {
      name: "Mei Chen",
      phoneNumber: "(919) 555-2481"
    }
  ]

  return <NavigationStack>
    <List
      navigationTitle={"Display data inside a row"}
      navigationBarTitleDisplayMode={"inline"}
    >
      {staff.map(person =>
        <PersonRowView
          person={person}
        />
      )}
    </List>
  </NavigationStack>
}
```

### 4. Present the View

Use `Navigation.present` to show the view, then exit the script after dismissal:

```tsx
async function run() {
  await Navigation.present({
    element: <Example />
  })

  Script.exit()
}

run()
```

---

## Independent buttons in one row

For several actions in the same row, give each `Button` an explicit `buttonStyle="borderless"` so SwiftUI's automatic row style does not combine their actions. Use `plain` when you also want minimal decoration. Keep a clear title or accessibility label for each action.

```tsx
import { Button, HStack, List } from "scripting"

function RowActions() {
  return <List>
    <HStack>
      <Button title="Start" buttonStyle="borderless" action={() => console.log("start")} />
      <Button title="Stop" buttonStyle="borderless" action={() => console.log("stop")} />
    </HStack>
  </List>
}
```

`buttonStyle` is a shared JSX property from `CommonViewProps`, so it is valid even though `ButtonProps` does not repeat it. See [Button](scripting://doc?title=Button) and [buttonStyle](scripting://doc?title=buttonStyle). To style a row's content, see [shaped backgrounds](scripting://doc?title=foregroundStyle%20%26%20background) and [clipShape / rounded corners](scripting://doc?title=clipShape).

## Summary

This pattern shows how to **display data inside a row** by:

* Structuring UI with layout components (`VStack`, `HStack`)
* Defining reusable, typed row components
* Presenting data collections cleanly using `List`
* Integrating icons and labels for better visual clarity

It is ideal for rendering lists of structured objects such as contacts, messages, or any custom data rows.
