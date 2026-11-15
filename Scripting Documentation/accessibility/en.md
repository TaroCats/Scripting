# Accessibility Announcements

`Accessibility` is a global API; no import is required. Use it to announce a short, important result through VoiceOver without moving the user's accessibility focus. It is separate from `Speech`, which provides general text-to-speech.

## `Accessibility.announce(message: string): Promise<boolean>`

- `message`: A nonempty string. Leading/trailing whitespace is trimmed. Other types and whitespace-only strings reject with `TypeError`.
- Resolves `true` when the announcement has been submitted to the system. This does **not** confirm that VoiceOver spoke the message or finished speaking.
- Resolves `false` when VoiceOver is off, Scripting is not active, or the calling script is not eligible. No announcement is saved for a later foreground session.
- Supported in the main App's live script entry, Home UI, and assistant-tool contexts. Minimized scripts, static snapshots, Widget/Intent contexts, and app extensions cannot announce through this API. The global is only registered in the main App.
- Eligibility is checked when called and again before submission. Exiting or disposing the script cancels pending work; no completion callback runs in a disposed context. **Await the call before exiting** if you need to submit a final result.

Requires a Scripting build that includes this update; 3.3.0 (27) and earlier do not implement this API.

## Example

```tsx
import { Button, Navigation, Script, Text, VStack, useState } from "scripting"

async function main() {
  function Example() {
    const [status, setStatus] = useState("Ready")

    async function complete() {
      const result = "Operation completed"
      setStatus(result)
      const submitted = await Accessibility.announce(result)
      console.log(submitted ? "Announcement submitted" : "Announcement skipped")
    }

    return <VStack spacing={16}>
      <Text>{status}</Text>
      <Button title="Complete operation" action={complete} />
    </VStack>
  }

  await Navigation.present(<Example />)
  Script.exit()
}

void main()
```

Always keep the result visible in the interface. Announcements supplement accessible text and controls; they do not replace them. Announce completion, errors, or a search result summary. Avoid announcing each token, progress increment, or repeated unchanged status. This API does not override system speech scheduling or force focus to a particular control.

For default activation and named actions on individual elements, see the Accessibility view modifiers.
