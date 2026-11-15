The `Translation` API enables text translation between different languages. It supports both individual and batch translation use cases and is available on **iOS 18.0 or later**.

## Overview

The API is exposed as a `Translation` class, which includes:

* A shared singleton instance for global use
* Methods for translating single or multiple strings
* Support for automatic language detection based on user preferences

---

## Class: `Translation`

### `Translation.shared: Translation`

Provides a shared singleton instance of the `Translation` class. This is useful in scripts that do not have a UI or need to reuse a common translation host.

#### Example

```ts
const translated = await Translation.shared.translate({
  text: "Hello, world!",
  source: "en",
  target: "es"
})

console.log(translated) // Output: "¡Hola, mundo!"
```

---

### Method: `translate(options): Promise<string>`

Translates a single string from a source language to a target language.

#### Parameters

* `options.text: string`
  The input string to be translated.

* `options.source?: string`
  The source language code (e.g., `"en"` for English). If omitted or `null`, the translation system will attempt to detect the source language automatically. If detection is ambiguous, the user may be prompted to clarify.

* `options.target?: string`
  The target language code (e.g., `"es"` for Spanish). If omitted or `null`, the system will choose an appropriate target language based on the device’s `Device.preferredLanguages` and the detected source language.

#### Returns

* `Promise<string>` — A promise that resolves to the translated string.

#### Throws

* An error if the translation fails (e.g., network issues, unsupported languages, etc.).

#### Example

```ts
const translated = await Translation.shared.translate({
  text: "Good morning",
  target: "fr"
})

console.log(translated) // Output: "Bonjour"
```

---

### Method: `translateBatch(options): Promise<string[]>`

Translates an array of strings from a source language to a target language.

#### Parameters

* `options.texts: string[]`
  An array of strings to translate. The order of translations in the result matches the input array.

* `options.source?: string`
  The source language code. Behaves the same as in the `translate` method.

* `options.target?: string`
  The target language code. Behaves the same as in the `translate` method.

#### Returns

* `Promise<string[]>` — A promise that resolves to an array of translated strings.

#### Throws

* An error if any part of the batch translation fails.

#### Example

```ts
const results = await Translation.shared.translateBatch({
  texts: ["Hello", "Good night", "Thank you"],
  source: "en",
  target: "ja"
})

console.log(results)
// Output: ["こんにちは", "おやすみなさい", "ありがとう"]
```

---

## Notes

* Language codes should follow [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) format (e.g., `"en"`, `"zh"`, `"de"`, `"fr"`).
* This API leverages system-level translation capabilities and may prompt for language disambiguation in certain cases.

* Use the `translationHost` view modifier in the following scenarios:

  * **Interactive Translations in UI Views**
    When your script presents a user interface (e.g., using `<VStack>`, `<List>`, etc.) and performs translations using a custom `Translation` instance (created via `new Translation()`), you **must** apply `translationHost` to the root view to allow the system to display permission dialogs, language download prompts, or source language selection alerts.

  * **Source Language Is `null`**
    If you omit the `source` field in your translation request and rely on the system to detect the language, `translationHost` ensures the system can prompt the user if detection fails.

  * **Languages May Need Downloading**
    If the device does not have the required source or target language installed, `translationHost` enables system prompts to download those languages interactively.

* You do **not** need to set `translationHost` when using the pre-bound `Translation.shared` instance in a headless or background script that does not render a user interface.


## No-UI translation — iOS/macOS 26+

`translateInstalled(options): Promise<string>` and `translateInstalledBatch(options): Promise<string[]>` translate using languages already installed on the device. They work on `Translation.shared` and `new Translation()` without `translationHost`, do not show download prompts.

- `text: string` for a single translation; `texts: string[]` for a batch.
- `source: string` is required. These methods do not automatically detect the source language.
- `target?: string` selects the target. If omitted, the system chooses it from preferred languages and the source language.
- Batch results preserve input order, including duplicate inputs; an empty batch returns `[]`.
- On systems before 26, or for unsupported/uninstalled languages, the Promise rejects. To prepare languages, use the existing host-backed translation methods in the App first.

```ts
const result = await Translation.shared.translateInstalled({
  text: "Hello", source: "en", target: "zh-Hans"
})
const results = await new Translation().translateInstalledBatch({
  texts: ["Hello", "Goodbye"], source: "en", target: "fr"
})
```

### Safari userscripts

Only the new no-UI methods are exposed through `Scripting.Translation`. Requires iOS/macOS 26+, installed languages and `@grant Scripting.Translation`; use the content world. Safari does not expose the host-backed `translate`/`translateBatch` methods or download UI. A request accepts at most 64 texts and 256 KiB of UTF-8 text. Native failure rejects; requests are not automatically retried.

```js
// @grant Scripting.Translation
// @inject-into content
const result = await Scripting.Translation.translateInstalled({
  text: "Hello", source: "en", target: "zh-Hans"
})
```

The installed-language initializer is documented by [Apple](https://developer.apple.com/documentation/translation/translationsession/init(installedsource:target:)).
