`Tagger` 用于给文本做词性、词元、语言/脚本、命名实体、情感、自定义标签（来自 Gazetteer）等标注。

---

## 构造

```ts
const tagger = new NaturalLanguage.Tagger([
  "lexicalClass",   // 词性
  "nameType",       // 人名 / 地名 / 机构名
  "lemma",
  "sentimentScore"
])
tagger.setText("Tim Cook visited Beijing yesterday. I love this city!")
```

只声明你实际需要的 scheme —— 它们决定 tagger 做哪些分析。

---

## Tag scheme

```ts
type TagScheme =
  | "tokenType"              // word / punctuation / whitespace / other
  | "lexicalClass"           // Noun, Verb, Adjective, ...
  | "nameType"               // PersonalName, PlaceName, OrganizationName
  | "nameTypeOrLexicalClass"
  | "lemma"
  | "language"
  | "script"
  | "sentimentScore"         // 数值字符串,[-1, 1]
```

---

## 方法

### `setText(text: string): void`
绑定要分析的文本。后续查询都基于它。

### `setLanguage(language: Language, range?: StringRange): void`
为整段文本或某个子区间覆盖语言提示。

### `tag(at, unit, scheme): { tag: string | null, range } | null`
查询单个 UTF-16 位置上的 tag。

### `tags(range, unit, scheme, options?): { tag: string | null, range }[]`
枚举一个区间内的所有 tag。`range` 传 `null` 表示扫描全文。

`options`（`TaggerOptions`）可以跳过你不关心的 token：
- `omitWords` / `omitPunctuation` / `omitWhitespace` / `omitOther`
- `joinNames`（把 `"John Smith"` 合并为单个 token）
- `joinContractions`（把 `"don't"` 合并为单个 token）

### `tagHypotheses(at, unit, scheme, maximumCount): { hypotheses, range }`
返回某个位置上 top-K 个候选 tag，形如 `{ "Noun": 0.7, "Verb": 0.2, ... }`。

### `enumerateNamedEntities(range?, options?): NamedEntityResult[]`
对 `tags(..., "word", "nameType", ...)` 的便捷封装：只返回人名 / 地名 / 机构名，并自动启用 `joinNames`，多词姓名合并成单个实体。

### `sentimentScore(range?): number | null`
返回情感打分（`[-1, 1]`，越正表示越积极）。要求构造时声明了 `"sentimentScore"`。打分从 `range.location` 开始，按段落粒度。

### `setGazetteers(gazetteers, scheme): void`
为某个 scheme 挂上一个或多个 `Gazetteer`。Gazetteer 命中会**覆盖**系统模型对该 scheme 的判断。详见 `Gazetteer`。

---

## 示例

### 命名实体识别

```ts
const tagger = new NaturalLanguage.Tagger(["nameType"])
tagger.setText("Tim Cook visited Beijing yesterday.")
console.log(tagger.enumerateNamedEntities())
// [
//   { entity: "personalName", text: "Tim Cook", range: { location: 0,  length: 8 } },
//   { entity: "placeName",    text: "Beijing",  range: { location: 17, length: 7 } }
// ]
```

### 词性标注

```ts
const tagger = new NaturalLanguage.Tagger(["lexicalClass"])
tagger.setText("Apple released new products.")
const tags = tagger.tags(null, "word", "lexicalClass", {
  omitWhitespace: true,
  omitPunctuation: true
})
// → [ { tag: "Noun", range }, { tag: "Verb", range }, { tag: "Adjective", range }, { tag: "Noun", range } ]
```

### 情感打分

```ts
const tagger = new NaturalLanguage.Tagger(["sentimentScore"])
tagger.setText("I love this beautiful sunny day!")
const score = tagger.sentimentScore()   // → ~0.9（正向）
```

### Top-K 候选

```ts
const r = tagger.tagHypotheses(0, "word", "lexicalClass", 3)
// {
//   hypotheses: { "Noun": 0.72, "ProperNoun": 0.18, "Adjective": 0.05 },
//   range: { location: 0, length: 5 }
// }
```


## 输入校验与模型能力

- `range` 省略或为 `null` 时代表全文。显式范围的 `location`、`length` 必须为非负安全整数，且落在文本的 UTF-16 边界内；错误类型抛 `TypeError`，无效数值或越界抛 `RangeError`，不会退回全文。`setLanguage` 遇到错误范围不会修改语言提示。
- `tag` / `tagHypotheses` 的 `at` 必须是有限安全整数，不能传 NaN、小数或布尔值。合法整数位置越界时，`tag` 返回 `null`，`tagHypotheses` 返回空候选和零范围；`text.length` 不属于可查询的字符位置。
- `maximumCount` 必须是正安全整数；候选对象的键顺序没有保证，需要排序时自行按置信度排序。
- 合法零长范围：`tags` / `enumerateNamedEntities` 返回空数组；`sentimentScore` 查询起点所在段落，起点为文本末尾时返回 `null`。情感的 `range.length` 不裁剪文本，也不计算多段平均值。
- 情感分数是模型预测的极性，不是置信度；中文等语言可能出现误判。`OtherWord` 表示没有细分词性标签，不应把它猜测成名词或动词。

### `Tagger.availableTagSchemes(unit, language): TagScheme[]`

查询当前设备对指定语言和粒度支持的 scheme，返回值使用与构造参数相同的名称；支持某个 scheme 不保证模型准确，也不保证输出细分标签。

```ts
const language = NaturalLanguage.dominantLanguage(text)
if (language) {
  console.log(NaturalLanguage.Tagger.availableTagSchemes("word", language))
  console.log(NaturalLanguage.Tagger.availableTagSchemes("paragraph", language))
}
```
