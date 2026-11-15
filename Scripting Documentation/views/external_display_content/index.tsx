import {
  Button, ExternalDisplayContent, Navigation, NavigationStack, Script,
  ScrollView, Text, useState, VStack,
} from "scripting"

function Example() {
  const dismiss = Navigation.useDismiss()
  const [count, setCount] = useState(0)
  const [blue, setBlue] = useState(true)
  const [mounted, setMounted] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [state, setState] = useState<ExternalDisplayState | "mounting" | "released" | "error">("mounting")
  const [error, setError] = useState("")

  const hint = state === "waiting"
    ? "No foreground external scene. Keep the subtree mounted; reconnect through Control Center to show the latest shared state."
    : state === "suspended"
      ? "Output is paused, or the App/page is inactive or covered. Enable output and return from Control Center. This does not necessarily mean disconnection."
      : state === "presenting"
        ? "The external scene is presenting. Verify the remote count and color on the receiver."
        : state === "error"
          ? "Another script or image handle may own the display. Release this subtree, then mount again after the display is free."
          : "Mounting claims output; releasing frees ownership. Local count and color remain."

  return <NavigationStack>
    <ScrollView>
      <VStack navigationTitle="External JSX Demo" spacing={16} padding>
        {/* Keep equivalent status and every control on the device. */}
        <Text>{`Local count: ${count}`}</Text>
        <Text>{`Color: ${blue ? "blue" : "red"}`}</Text>
        <Text>{`Output: ${state}; ${enabled ? "enabled" : "paused"}; ${mounted ? "mounted" : "released"}`}</Text>
        <Text>{hint}</Text>
        {error ? <Text>{`Error: ${error}`}</Text> : null}
        <Button title="Increment shared count" action={() => setCount(value => value + 1)} />
        <Button title="Reset shared count" action={() => setCount(0)} />
        <Button title="Change shared color" action={() => setBlue(value => !value)} />
        <Button title={enabled ? "Pause output (keep ownership)" : "Resume output"} disabled={!mounted} action={() => setEnabled(value => !value)} />
        <Button title={mounted ? "Release external subtree" : "Mount external subtree"} action={() => {
          setError("")
          setState(mounted ? "released" : "mounting")
          if (!mounted) setEnabled(true)
          setMounted(value => !value)
        }} />
        <Text>Connect Screen Mirroring through Control Center, then return to this page. The receiver shows EXTERNAL JSX and the shared count/color; this device keeps the buttons.</Text>
        <Text>Reconnect test: increment, stop Screen Mirroring, close Control Center and increment again while disconnected. Reconnect and return here: the receiver should show the latest count and color. Do not release/remount the subtree just because state becomes waiting.</Text>
        <Button title="Close demo" action={() => dismiss()} />
        {mounted ? <ExternalDisplayContent
          enabled={enabled}
          onStateChanged={next => {
            // Disconnection changes native scene state, not our shared count or subtree.
            setState(next)
          }}
          onError={message => { setError(message); setState("error") }}
        >
          <VStack
            spacing={24}
            frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
            background={blue ? "#163858" : "#601C28"}
          >
            <Text font="largeTitle" foregroundStyle="white">EXTERNAL JSX</Text>
            <Text font="largeTitle" foregroundStyle="yellow">{`COUNT ${count}`}</Text>
            <Text foregroundStyle="white">{`Shared color: ${blue ? "blue" : "red"}`}</Text>
          </VStack>
        </ExternalDisplayContent> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

try {
  await Navigation.present({ element: <Example /> })
} finally {
  // Closing the page unmounts the native external host and releases its ownership.
  Script.exit()
}
