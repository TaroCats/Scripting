import { Button, HStack, Image, List, Markdown, Navigation, NavigationLink, NavigationStack, Script, Section, Text, Toggle, VStack, useEffect, useState } from "scripting"

type SymbolItem = {
  name: string
  keywords: string[]
}

const BUILTIN_SYMBOL_SECTIONS: { title: string; items: SymbolItem[] }[] = [
  {
    title: "常用",
    items: [
      { name: "house", keywords: ["home", "首页"] },
      { name: "magnifyingglass", keywords: ["search", "搜索"] },
      { name: "gearshape", keywords: ["settings", "设置"] },
      { name: "bell", keywords: ["notification", "通知"] },
      { name: "calendar", keywords: ["date", "日历"] },
      { name: "clock", keywords: ["time", "时间"] },
      { name: "paperplane", keywords: ["send", "发送"] },
      { name: "heart", keywords: ["like", "喜欢"] },
      { name: "star", keywords: ["favorite", "收藏"] },
      { name: "checkmark", keywords: ["ok", "确认"] },
      { name: "xmark", keywords: ["close", "关闭"] },
      { name: "square.and.arrow.up", keywords: ["share", "分享"] },
      { name: "trash", keywords: ["delete", "删除"] },
      { name: "pencil", keywords: ["edit", "编辑"] },
      { name: "plus", keywords: ["add", "新增"] },
      { name: "minus", keywords: ["remove", "移除"] },
    ],
  },
  {
    title: "天气",
    items: [
      { name: "sun.max", keywords: ["sun", "晴"] },
      { name: "moon", keywords: ["night", "夜"] },
      { name: "cloud", keywords: ["cloudy", "云"] },
      { name: "cloud.sun", keywords: ["partly", "多云"] },
      { name: "cloud.moon", keywords: ["night", "夜间"] },
      { name: "cloud.rain", keywords: ["rain", "雨"] },
      { name: "cloud.heavyrain", keywords: ["heavy", "大雨"] },
      { name: "cloud.drizzle", keywords: ["drizzle", "毛毛雨"] },
      { name: "cloud.snow", keywords: ["snow", "雪"] },
      { name: "wind", keywords: ["windy", "风"] },
      { name: "tornado", keywords: ["storm", "龙卷风"] },
      { name: "hurricane", keywords: ["hurricane", "飓风"] },
      { name: "thermometer", keywords: ["temp", "温度"] },
      { name: "humidity", keywords: ["humidity", "湿度"] },
    ],
  },
  {
    title: "设备与媒体",
    items: [
      { name: "iphone", keywords: ["phone", "手机"] },
      { name: "ipad", keywords: ["ipad"] },
      { name: "macbook", keywords: ["mac"] },
      { name: "airpods", keywords: ["audio", "耳机"] },
      { name: "camera", keywords: ["photo", "相机"] },
      { name: "video", keywords: ["video", "视频"] },
      { name: "mic", keywords: ["microphone", "麦克风"] },
      { name: "speaker.wave.2", keywords: ["volume", "音量"] },
      { name: "play.fill", keywords: ["play", "播放"] },
      { name: "pause.fill", keywords: ["pause", "暂停"] },
      { name: "stop.fill", keywords: ["stop", "停止"] },
    ],
  },
]

const BUILTIN_SYMBOLS = Array.from(
  new Map(
    BUILTIN_SYMBOL_SECTIONS.flatMap((section) =>
      section.items.map((item) => [item.name, item] as const),
    ),
  ).values(),
)

function includesKeyword(item: SymbolItem, query: string) {
  const q = query.toLowerCase()
  if (item.name.toLowerCase().includes(q)) return true
  return item.keywords.some((keyword) => keyword.toLowerCase().includes(q))
}

function SymbolDetail({
  name,
}: {
  name: string
}) {
  const [fill, setFill] = useState(false)
  const [message, setMessage] = useState("")
  const displayName = fill ? `${name}.fill` : name

  const copy = async () => {
    await Pasteboard.setString(displayName)
    setMessage(`已复制：${displayName}`)
  }

  const markdown = `<Markdown content={\`\\\`\\\`\\\`tsx
<Image systemName="${displayName}" />
\\\`\\\`\\\`\`} />`

  return (
    <List navigationTitle={displayName}>
      <Section title="预览">
        <VStack alignment="center" spacing={12} padding={16}>
          <Image
            systemName={displayName}
            resizable
            scaleToFit
            frame={{ width: 96, height: 96 }}
            foregroundStyle="systemBlue"
          />
          <Text font="footnote" foregroundStyle="secondaryLabel">
            {displayName}
          </Text>
        </VStack>
      </Section>

      <Section title="选项">
        <Toggle
          title="使用 .fill"
          value={fill}
          onChanged={setFill}
        />
      </Section>

      <Section title="操作">
        <Button title="复制名称" action={copy} />
        {message ? (
          <Text font="footnote" foregroundStyle="secondaryLabel">
            {message}
          </Text>
        ) : null}
      </Section>

      <Section title="用法">
        <Markdown content={markdown} theme="github" highlighterTheme="sunset" />
      </Section>
    </List>
  )
}

function SymbolRow({ item }: { item: SymbolItem }) {
  return (
    <NavigationLink
      destination={<SymbolDetail name={item.name} />}
    >
      <HStack alignment="center" spacing={12}>
        <Image
          systemName={item.name}
          resizable
          scaleToFit
          frame={{ width: 22, height: 22 }}
          foregroundStyle="systemBlue"
        />
        <VStack alignment="leading" spacing={2}>
          <Text>{item.name}</Text>
          <Text font="footnote" lineLimit={1}>
            {item.keywords.join(" · ")}
          </Text>
        </VStack>
      </HStack>
    </NavigationLink>
  )
}

function App() {
  const [query, setQuery] = useState("")
  const [presented, setPresented] = useState(false)
  const [queryValid, setQueryValid] = useState<boolean | null>(null)

  const normalizedQuery = query.trim()
  const filteredItems = normalizedQuery.length
    ? BUILTIN_SYMBOLS.filter((item) => includesKeyword(item, normalizedQuery))
    : []

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setQueryValid(null)
      return
    }

    let canceled = false
    const timer = setTimeout(() => {
      Promise.resolve(UIImage.fromSFSymbol(q))
        .then((image) => {
          if (!canceled) setQueryValid(Boolean(image))
        })
        .catch(() => {
          if (!canceled) setQueryValid(false)
        })
    }, 250)

    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [query])

  const pasteFromClipboard = async () => {
    const text = await Pasteboard.getString()
    if (text) {
      setQuery(text)
      setPresented(true)
    }
  }

  const doc = () => {
    const url = Script.createDocumentationURLScheme("Views")
    Safari.openURL(url)
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="SF Symbols"
        toolbar={{
          topBarTrailing: (
            <HStack spacing={12}>
              <Button title="粘贴" action={pasteFromClipboard} />
              <Button title="文档" action={doc} />
            </HStack>
          ),
        }}
        searchable={{
          placement: "automatic",
          prompt: "输入 SF Symbol 名称或关键词",
          presented: {
            value: presented,
            onChanged: setPresented,
          },
          value: query,
          onChanged: setQuery,
        }}
        searchSuggestions={
          <Section>
            <Text searchCompletion="cloud.sun">cloud.sun</Text>
            <Text searchCompletion="gearshape">gearshape</Text>
            <Text searchCompletion="calendar">calendar</Text>
            <Text searchCompletion="magnifyingglass">magnifyingglass</Text>
          </Section>
        }
      >
        {normalizedQuery.length ? (
          <>
            <Section title="输入预览">
              <NavigationLink destination={<SymbolDetail name={normalizedQuery} />}>
                <HStack alignment="center" spacing={12}>
                  <Image
                    systemName={normalizedQuery}
                    resizable
                    scaleToFit
                    frame={{ width: 22, height: 22 }}
                    foregroundStyle="systemBlue"
                  />
                  <VStack alignment="leading" spacing={2}>
                    <Text>{normalizedQuery}</Text>
                    <Text font="footnote" foregroundStyle="secondaryLabel">
                      {queryValid === null ? "正在验证…" : queryValid ? "可用" : "不可用/系统不支持"}
                    </Text>
                  </VStack>
                </HStack>
              </NavigationLink>
            </Section>
            <Section title="匹配结果">
              {filteredItems.length ? (
                filteredItems.map((item) => <SymbolRow key={item.name} item={item} />)
              ) : (
                <Text foregroundStyle="secondaryLabel">没有匹配到内置列表，可尝试直接使用上面的输入预览。</Text>
              )}
            </Section>
          </>
        ) : (
          BUILTIN_SYMBOL_SECTIONS.map((section) => (
            <Section key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SymbolRow key={item.name} item={item} />
              ))}
            </Section>
          ))
        )}
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present({
    element: <App />,
  })
  Script.exit()
}

run()
