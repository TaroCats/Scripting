`Tagger` annotates text with part-of-speech, lemma, language/script, named entities, sentiment, and custom labels from gazetteers.

---

## Construction

```ts
const tagger = new NaturalLanguage.Tagger([
  "lexicalClass",   // part of speech
  "nameType",       // person / place / organization
  "lemma",
  "sentimentScore"
])
tagger.setText("Tim Cook visited Beijing yesterday. I love this city!")
```

Pass only the schemes you actually need — they control which analyses the tagger performs.

---

## Tag schemes

```ts
type TagScheme =
  | "tokenType"              // word / punctuation / whitespace / other
  | "lexicalClass"           // Noun, Verb, Adjective, ...
  | "nameType"               // PersonalName, PlaceName, OrganizationName
  | "nameTypeOrLexicalClass"
  | "lemma"
  | "language"
  | "script"
  | "sentimentScore"         // numeric string in [-1, 1]
```

---

## Methods

### `setText(text: string): void`
Attach text. All subsequent queries operate on it.

### `setLanguage(language: Language, range?: StringRange): void`
Override the language hint for the whole text or a sub-range.

### `tag(at, unit, scheme): { tag: string | null, range } | null`
Look up the tag at a single UTF-16 offset.

### `tags(range, unit, scheme, options?): { tag: string | null, range }[]`
Enumerate all tags in a range. Pass `null` as `range` to scan the whole text.

`options` (`TaggerOptions`) lets you skip tokens you don't care about:
- `omitWords` / `omitPunctuation` / `omitWhitespace` / `omitOther`
- `joinNames` (treat `"John Smith"` as a single token)
- `joinContractions` (treat `"don't"` as a single token)

### `tagHypotheses(at, unit, scheme, maximumCount): { hypotheses, range }`
Top-K candidate tags at a position, as `{ "Noun": 0.7, "Verb": 0.2, ... }`.

### `enumerateNamedEntities(range?, options?): NamedEntityResult[]`
Convenience over `tags(..., "word", "nameType", ...)`: returns person / place / organization mentions only, with `joinNames` enabled so multi-token names appear as one entity.

### `sentimentScore(range?): number | null`
Score sentiment in the range `[-1, 1]` (more negative → more positive). Requires the tagger to have been constructed with `"sentimentScore"`. Scoring starts from `range.location` at paragraph granularity.

### `setGazetteers(gazetteers, scheme): void`
Attach one or more `Gazetteer` to a scheme. Gazetteer hits take precedence over the system model for that scheme. See `Gazetteer`.

---

## Examples

### Named entities

```ts
const tagger = new NaturalLanguage.Tagger(["nameType"])
tagger.setText("Tim Cook visited Beijing yesterday.")
console.log(tagger.enumerateNamedEntities())
// [
//   { entity: "personalName", text: "Tim Cook", range: { location: 0,  length: 8 } },
//   { entity: "placeName",    text: "Beijing",  range: { location: 17, length: 7 } }
// ]
```

### Part-of-speech

```ts
const tagger = new NaturalLanguage.Tagger(["lexicalClass"])
tagger.setText("Apple released new products.")
const tags = tagger.tags(null, "word", "lexicalClass", {
  omitWhitespace: true,
  omitPunctuation: true
})
// → [ { tag: "Noun", range }, { tag: "Verb", range }, { tag: "Adjective", range }, { tag: "Noun", range } ]
```

### Sentiment

```ts
const tagger = new NaturalLanguage.Tagger(["sentimentScore"])
tagger.setText("I love this beautiful sunny day!")
const score = tagger.sentimentScore()   // → ~0.9 (positive)
```

### Tag hypotheses

```ts
const r = tagger.tagHypotheses(0, "word", "lexicalClass", 3)
// {
//   hypotheses: { "Noun": 0.72, "ProperNoun": 0.18, "Adjective": 0.05 },
//   range: { location: 0, length: 5 }
// }
```


## Input validation and model capabilities

- Omitted or `null` ranges mean the whole text. Explicit `location` and `length` must be nonnegative safe integers within the text's UTF-16 bounds. Wrong types throw `TypeError`; invalid numbers or bounds throw `RangeError`. Invalid ranges never fall back to the whole text. Invalid `setLanguage` ranges leave the language hint unchanged.
- `at` in `tag` / `tagHypotheses` must be a finite safe integer, not NaN, a fraction or a boolean. Out-of-text integer positions return `null` for `tag`, or empty hypotheses with a zero range. `text.length` is not a character position.
- `maximumCount` must be a positive safe integer. Candidate object key order is unspecified; sort by confidence yourself when needed.
- Valid zero-length ranges return empty arrays for `tags` / `enumerateNamedEntities`. `sentimentScore` queries the paragraph at the start position, or returns `null` at text end. The range length does not crop scoring text or average multiple paragraphs.
- Sentiment measures predicted polarity, not confidence. Models may misclassify text, including Chinese. `OtherWord` means no specific part-of-speech label was produced; it should not be guessed into a noun or verb.

### `Tagger.availableTagSchemes(unit, language): TagScheme[]`

Query supported schemes for this unit and language on the current device. Names match constructor schemes. Availability does not guarantee accuracy or detailed labels.

```ts
const language = NaturalLanguage.dominantLanguage(text)
if (language) {
  console.log(NaturalLanguage.Tagger.availableTagSchemes("word", language))
  console.log(NaturalLanguage.Tagger.availableTagSchemes("paragraph", language))
}
```
