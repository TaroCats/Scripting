The `LiveActivity` API enables you to display real-time, dynamic information from your script on the Lock Screen and, where supported, in the Dynamic Island on iOS devices. It provides a structured interface to start, update, and end Live Activities, and observe their state throughout their lifecycle.

This document provides a complete guide to using the **LiveActivity API** in the Scripting app, including:

- Core concepts and lifecycle
- How to register a Live Activity UI
- How to start, update, and end Live Activities
- UI layout for Dynamic Island and Lock Screen
- Full TypeScript/TSX examples
- Detailed descriptions of every type and option

The API wraps Apple’s ActivityKit and brings it into the Scripting environment with a React-style UI building approach.

---

## 1. Understanding Live Activities

A Live Activity can appear in the following regions:

- Lock Screen
- Dynamic Island (iPhone 14 Pro and later)
- Banner-style presentation on devices without Dynamic Island
- Apple Watch Smart Stack and CarPlay

Live Activities are used for time-based and progress-based information, such as:

- Timers
- Fitness progress
- Delivery tracking
- Countdowns and reminders
- Real-time status updates

In Scripting, each Live Activity consists of:

1. **contentState** (a JSON-serializable object that updates over time)
2. **UI Builder** (a function that produces TSX UI for each state)

---

## 2. Live Activity State Types

```ts
type LiveActivityState = "active" | "dismissed" | "ended" | "stale";
```

| State     | Description                                                                                 |
| --------- | ------------------------------------------------------------------------------------------- |
| active    | The Live Activity is visible and can receive content updates.                               |
| stale     | The Live Activity is out of date. The system expects an update.                             |
| ended     | The Live Activity ended but may remain visible for up to four hours or a user-defined time. |
| dismissed | The Live Activity is no longer visible.                                                     |

---

## 3. LiveActivityDetail Type

```ts
type LiveActivityDetail = {
  id: string;
  state: LiveActivityState;
};
```

Represents a summary of each active Live Activity.

---

## 4. Live Activity UI Types

## 4.1 LiveActivityUIProps

```ts
type LiveActivityUIProps = {
  keylineTint?: Color | null;
  dynamicIslandContentMargins?: Partial<Record<LiveActivityDynamicIslandMode, LiveActivityDynamicIslandMargins>>;
  content: VirtualNode;
  small?: VirtualNode;
  compactLeading: VirtualNode;
  compactTrailing: VirtualNode;
  minimal: VirtualNode;
  children: VirtualNode | VirtualNode[];
};
```

These regions correspond to ActivityKit’s UI areas:

| Property        | Region                                                |
| --------------- | ----------------------------------------------------- |
| content         | Lock Screen and non–Dynamic Island devices            |
| small           | Optional compact layout for Apple Watch Smart Stack and CarPlay |
| compactLeading  | Leading area of compact Dynamic Island                |
| compactTrailing | Trailing area of compact Dynamic Island               |
| minimal         | The smallest pill-style display                       |
| children        | The expanded Dynamic Island layout (multiple regions) |

When the system requests the small activity family, Scripting displays `small` if provided and uses `content` otherwise. Apple Watch Smart Stack requires watchOS 11 or later and a paired iPhone with iOS 18 or later. Keep the small layout short so the key information fits at larger text sizes.

For remote Live Activities, prepare a new template and use it to start a new activity after adding `small`. Existing activities continue to use their pinned template.

---

## 4.2 Static Rendering and Component Limitations

A Live Activity builds the UI returned by its builder into a static snapshot. JavaScript does not keep running to regenerate views while the activity is displayed.

- Components such as `GeometryReader`, `ScrollViewReader`, `NamespaceReader`, and `EnvironmentValuesReader` are unsupported because they need to pass layout or environment information back to JavaScript during display to generate child views. Using these components may leave the corresponding content empty.
- You can use components such as `HStack`, `VStack`, `Text`, and `Image`, as well as custom function components and conditional rendering based on `contentState`. Their content is determined when the snapshot is built.
- **Updating content through `activity.update(state)` is still supported.** The new state is passed to the registered builder to build a new UI snapshot; ActivityKit/WidgetKit controls when the display refreshes. Do not rely on timers, event callbacks, or `useState` inside the view to keep refreshing the UI.

---

## 5. Registering a Live Activity UI

Live Activities **must** be registered inside a standalone file such as `live_activity.tsx`.

```tsx
import { HStack, Image, Text, LiveActivity, LiveActivityUI,
  LiveActivityUIExpandedCenter, type LiveActivityUIBuilder } from "scripting";

export type State = {
  mins: number;
};

function ContentView(state: State) {
  return (
    <HStack activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      <Image systemName="waterbottle" foregroundStyle="systemBlue" />
      <Text>{state.mins} minutes left until the next drink</Text>
    </HStack>
  );
}

const builder: LiveActivityUIBuilder<State> = (state) => {
  return (
    <LiveActivityUI
      content={<ContentView {...state} />}
      small={<Text lineLimit={1}>{state.mins} min until next drink</Text>}
      compactLeading={
        <HStack>
          <Image systemName="clock" />
          <Text>{state.mins}m</Text>
        </HStack>
      }
      compactTrailing={<Image systemName="waterbottle" foregroundStyle="systemBlue" />}
      minimal={<Image systemName="clock" />}>
      <LiveActivityUIExpandedCenter>
        <ContentView {...state} />
      </LiveActivityUIExpandedCenter>
    </LiveActivityUI>
  );
};

export const MyLiveActivity = LiveActivity.register("MyLiveActivity", builder);
```

---

## 6. Using a Live Activity in Your Script

`BackgroundKeeper` is global and needs no import. Import the UI components, hooks, types and `Script` from `"scripting"`. Save this entry as `index.tsx`; the factory comes from `live_activity.tsx` above.

```tsx
import {
  Button,
  Text,
  VStack,
  Navigation,
  NavigationStack,
  useMemo,
  useState,
  LiveActivityState,
  Script,
} from "scripting";

import { MyLiveActivity } from "./live_activity";

function Example() {
  const dismiss = Navigation.useDismiss();
  const [state, setState] = useState<LiveActivityState>();

  const activity = useMemo(() => {
    const instance = MyLiveActivity();

    instance.addUpdateListener((s) => {
      setState(s);
      if (s === "dismissed") {
        void BackgroundKeeper.stopKeepAlive();
      }
    });

    return instance;
  }, []);

  return (
    <NavigationStack>
      <VStack
        navigationTitle="Live Activity Example"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="Done" action={dismiss} />,
        }}>
        <Text>Activity State: {state ?? "-"}</Text>

        <Button
          title="Start Live Activity"
          disabled={state != null}
          action={async () => {
            let count = 5;
            if (!await BackgroundKeeper.keepAlive()) return;
            if (!await activity.start({ mins: count })) {
              await BackgroundKeeper.stopKeepAlive();
              return;
            }

            function tick() {
              setTimeout(async () => {
                count -= 1;
                if (count === 0) {
                  await activity.end({ mins: 0 });
                  await BackgroundKeeper.stopKeepAlive();
                } else {
                  await activity.update({ mins: count });
                  tick();
                }
              }, 60000);
            }

            tick();
          }}
        />
      </VStack>
    </NavigationStack>
  );
}

async function run() {
  await Navigation.present(<Example />);
  Script.exit();
}

run();
```

---

## 7. LiveActivity Class API Reference

## 7.1 start(contentState, options?)

```ts
start(contentState: T, options?: LiveActivityOptions): Promise<boolean>
```

Starts a Live Activity.

### LiveActivityOptions

```ts
type LiveActivityOptions = {
  staleDate?: number | Date;
  relevanceScore?: number;
};
```

- **staleDate**: Timestamp(ms) or Date object at which the activity becomes stale
- **relevanceScore**: Determines which Live Activity is prioritized in the Dynamic Island

---

## 7.2 update(contentState, options?)

```ts
update(contentState: T, options?: LiveActivityUpdateOptions)
```

Pass a new JSON-serializable state to the builder to update the Live Activity's content. For example, `await activity.update({ mins: 5 })` builds a UI snapshot using the new `mins` value. Static rendering does not disable this update capability; see section 4.2 for component limitations.

### LiveActivityUpdateOptions

```ts
type LiveActivityUpdateOptions = {
  staleDate?: number | Date;
  relevanceScore?: number;
  alert?: {
    title: string;
    body: string;
  };
};
```

Alerts appear on Apple Watch when sending an update.

---

## 7.3 end(contentState, options?)

```ts
end(contentState: T, options?: LiveActivityEndOptions)
```

### LiveActivityEndOptions

```ts
type LiveActivityEndOptions = {
  staleDate?: number ｜ Date
  relevanceScore?: number
  dismissTimeInterval?: number
}
```

Rules for dismissal (seconds):

- Not provided: default system retention (up to 4 hours)
- \<= 0: remove immediately
- \> 0: remove after the specified interval

---

## 7.4 Reading Activity State

```ts
getActivityState(): Promise<LiveActivityState | null>
```

---

## 7.5 Listening for State Changes

```ts
addUpdateListener(listener);
removeUpdateListener(listener);
```

Triggered when the Live Activity transitions between:

- active → stale
- active → ended
- ended → dismissed

---

## 7.6 Static Methods

```ts
static areActivitiesEnabled(): Promise<boolean>
static getAllActivities(): Promise<LiveActivityDetail[]>
static getAllActivitiesIds(): Promise<string[]>
static getActivityState(activityId: string)
static from(activityId, name)
static endAllActivities(options?)
```

---

## 8. UI Components for Expanded Layout

| Component                      | Description                       |
| ------------------------------ | --------------------------------- |
| LiveActivityUI                 | Root layout container             |
| LiveActivityUIExpandedLeading  | Leading region of expanded layout |
| LiveActivityUIExpandedTrailing | Trailing region                   |
| LiveActivityUIExpandedCenter   | Center region                     |
| LiveActivityUIExpandedBottom   | Bottom region                     |

These components help structure the expanded Dynamic Island.

---

## 9. Best Practices

## 9.1 contentState must be JSON-serializable

The following are not allowed:

- Functions
- Date objects (must use timestamps)
- Class instances
- Non-serializable structures

## 9.2 Live Activity registration must be in a standalone file

This is required due to UI compilation and ActivityKit rules.

## 9.3 Live Activities survive script termination

If your script needs to keep running (e.g., timers), use:

```ts
BackgroundKeeper.keepAlive();
```

---

## 10. Minimal Example

```ts
const activity = MyLiveActivity();

await activity.start({ mins: 10 });

await activity.update({ mins: 5 });

await activity.end({ mins: 0 }, { dismissTimeInterval: 0 });
```

## 11. Notes

- Live Activity starts asynchronously. You need to wait for `start` to return `true` before calling `update` and `end`.
- Live Activity cannot access documents and iCloud directories. If you want to access files or render images, you must save them to `FileManager.appGroupDocumentsDirectory`. For example, to render an image, you save it to `FileManager.appGroupDocumentsDirectory`, then use `<Image filePath={Path.join(FileManager.appGroupDocumentsDirectory, 'example.png')} />` to render it.
- Live Activity can access the Storage data shared with the app.

## Dynamic Island keyline and content margins

LiveActivityUI supports WidgetKit's native `keylineTint` and per-mode `dynamicIslandContentMargins` (maps to WidgetKit's `DynamicIsland.contentMargins(_:_:for:)`, iOS 16.1+). These configure the entire Dynamic Island rather than a border or padding inside either compact region. The system controls the keyline geometry and style; this API does not set its thickness, draw through the camera area or guarantee the charging animation's exact appearance.

Omit keylineTint to preserve existing defaults. Ordinary Live Activities keep their system defaults; custom AlarmLiveActivity UI inherits the alarm tint. Explicit null passes native nil and does not inherit the alarm tint; nil does not promise an invisible border. Accepts existing Color strings, including supported alpha formats, not gradients. Invalid colors are reported by the native renderer.

Margins are finite nonnegative numbers in points; 0 is valid. Per-edge values override horizontal/vertical groups, which override all, independent of property order. Unspecified edges preserve native defaults. Empty objects are no-ops. Expanded means the entire expanded presentation, not an individual expanded region. Invalid modes, edges and values fail visibly. These settings do not affect the Lock Screen content or replace a child view's general contentMargins modifier. Reducing margins does not remove system clipping.

Return new appearance values from the builder when contentState updates. Rendering uses a static snapshot, without keeping JS callbacks alive. Refresh timing remains controlled by ActivityKit/WidgetKit. A Dynamic Island iPhone is needed to assess the actual keyline and compact layout.

See `appearance.tsx`: save the registration in your script's live_activity.tsx, then import the factory from index.tsx. Start/update/end calls in its header operate only on that demo instance. For alarms, use the same props in your registered alarm_live_activity.tsx builder; AlarmKit retains its iOS 26+ requirement.

```ts
type LiveActivityDynamicIslandMode =
  | "compactLeading" | "compactTrailing" | "minimal" | "expanded"
type LiveActivityDynamicIslandMargins = Partial<Record<
  "all" | "horizontal" | "vertical" | "top" | "leading" | "bottom" | "trailing", number
>>
// New LiveActivityUIProps:
// keylineTint?: Color | null
// dynamicIslandContentMargins?: Partial<Record<LiveActivityDynamicIslandMode, LiveActivityDynamicIslandMargins>>
```

```tsx
<LiveActivityUI
  keylineTint={state.tint}
  dynamicIslandContentMargins={{ compactLeading: { all: 0 }, compactTrailing: { all: 0 } }}
  content={<Text>Charging</Text>}
  compactLeading={<Image systemName="bolt.fill" />}
  compactTrailing={<Text>80%</Text>}
  minimal={<Image systemName="bolt.fill" />}
>
  <LiveActivityUIExpandedCenter><Text>Charging</Text></LiveActivityUIExpandedCenter>
</LiveActivityUI>
```

## Empty Dynamic Island regions

Import `EmptyView` from `scripting` and supply `<EmptyView />` for an intentionally empty slot. The current slots require view nodes; `null` and `undefined` are not supported replacements. This builder can be used with the LiveActivity creation example above.

```tsx
import { EmptyView, LiveActivityUI, LiveActivityUIExpandedCenter, Text,
  type LiveActivityUIBuilder } from "scripting"

type State = { label: string }
export const build: LiveActivityUIBuilder<State> = state => (
  <LiveActivityUI
    content={<Text>{state.label}</Text>}
    compactLeading={<EmptyView />}
    compactTrailing={<Text>{state.label}</Text>}
    minimal={<EmptyView />}
  >
    <LiveActivityUIExpandedCenter><Text>{state.label}</Text></LiveActivityUIExpandedCenter>
  </LiveActivityUI>
)
```

## Expanded region priority

All four LiveActivityUIExpanded components accept `priority?: number`. Higher priorities receive layout space first; default 0. Finite numbers, including zero and negative values, are accepted; invalid values fail the builder. This is a native region hint, independent of the general layoutPriority modifier. Custom AlarmLiveActivity uses the same components. Existing tint and margins remain unchanged.

```tsx
// live_activity.tsx
import { LiveActivity, LiveActivityUI, Text,
  LiveActivityUIExpandedLeading, LiveActivityUIExpandedTrailing,
  LiveActivityUIExpandedCenter, LiveActivityUIExpandedBottom } from "scripting"
export const PriorityDemo = LiveActivity.register("PriorityDemo", () => (
  <LiveActivityUI content={<Text>Priority demo</Text>}
    compactLeading={<Text>L</Text>} compactTrailing={<Text>R</Text>} minimal={<Text>P</Text>}>
    <LiveActivityUIExpandedLeading priority={2}>
      <Text accessibilityLabel="Main status">Long primary status</Text>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing priority={0}><Text>Secondary</Text></LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedCenter priority={1}><Text>Center</Text></LiveActivityUIExpandedCenter>
    <LiveActivityUIExpandedBottom priority={0}><Text>Details</Text></LiveActivityUIExpandedBottom>
  </LiveActivityUI>
))
```

```ts
// index.tsx
import { Script } from "scripting"
import { PriorityDemo } from "./live_activity"
async function main() {
  const activity = PriorityDemo()
  try {
    if (!await activity.start({})) throw new Error("Live Activity could not start")
  } finally {
    Script.exit()
  }
}

void main()
```

Verify expanded layout, long/localized text, large Dynamic Type and VoiceOver on a Dynamic Island iPhone. iPad can verify builder data and supported lock-screen presentation, not expanded-island appearance.
