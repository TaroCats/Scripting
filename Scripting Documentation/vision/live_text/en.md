# Live Text

Use `LiveText.analyze()` to read all text in a still image. Use `LiveTextView` to let people select text directly in the image with the system Live Text controls. Both work in foreground Scripting app scripts (`index` and `home_screen`) on supported iPhone and iPad models with iOS or iPadOS 17 or later.

## Read text from an image

`LiveText` is global. The example assumes `image` is a `UIImage`, such as one obtained from `UIImage.fromFile()` or `UIImage.fromData()`.

```ts
if (typeof LiveText !== 'undefined' && LiveText.isSupported()) {
  const text = await LiveText.analyze(image)
  console.log(text)
}
```

- `isSupported()` checks the current script environment and device. `getSupportedTextRecognitionLanguages()` lists available language identifiers, or returns an empty array when Live Text is unavailable.
- Pass `{ locales: [...] }` with identifiers from that list in priority order. Omit `locales` or pass `[]` to use the system default.
- `analyze()` returns a string in the system’s reading order. A result of `""` means no text was found. Use `Vision.recognizeText()` when you need candidates, confidence scores, or text bounds.
- Pass `{ signal }` from a Scripting `AbortController` to cancel. On failure, inspect `error.code`, for example `cancelled`, `unsupported`, `invalidArgument`, `resourceLimit`, or `nativeFailure`. If you reach the resource limit, try a smaller image or wait for other analyses to finish.

## Let people select text

```tsx
import { LiveTextView } from 'scripting'

<LiveTextView
  image={image}
  frame={{ height: 260 }}
  accessibilityLabel="Receipt"
  onSelectionChange={text => console.log(text)}
  onError={code => console.log(code)}
/>
```

The view centers the image and preserves its aspect ratio. It accepts common view modifiers and the same `locales` option. The default `interaction="textSelection"` enables the system text menu. Choose `interaction="textAndDataDetectors"` to also offer system actions for items such as links, phone numbers, and QR codes.

`onSelectionChange` receives the current selected text. Clearing the selection on the same image sends `""`. Reset any selection stored in your script when you change the image. `onError` receives an error code and the image remains visible. When text is found, **View Recognized Text** provides a separate way to read or copy all recognized text.
