import { formatRemainingText, loadFreeGames } from "./shared"
import { type FreeGame } from "./types"

import {
  Navigation,
  Script,
  NavigationStack,
  List,
  Section,
  Text,
  VStack,
  HStack,
  Spacer,
  Image,
  Button,
  NavigationLink,
  useEffect,
  useMemo,
  useState,
} from "scripting"

type SourceFilter = "all" | "steam" | "epic"

function SourcePill({ source }: { source: FreeGame["source"] }) {
  const label = source === "steam" ? "Steam" : "Epic"
  const icon = source === "steam" ? "steamlogo" : "gamecontroller.fill"
  const color = source === "steam" ? "systemBlue" : "systemOrange"

  return (
    <HStack spacing={6} alignment="center">
      <Image systemName={icon} font={12} foregroundStyle={color} />
      <Text font={12} foregroundStyle={color} bold>
        {label}
      </Text>
    </HStack>
  )
}

function GameRow({ game }: { game: FreeGame }) {
  return (
    <HStack spacing={12} alignment="center">
      {game.imageUrl ? (
        <Image
          imageUrl={game.imageUrl}
          resizable
          scaleToFill
          frame={{ width: 48, height: 32 }}
        />
      ) : (
        <Image systemName="gift.fill" font={20} foregroundStyle="systemPink" frame={{ width: 48, height: 32 }} />
      )}
      <VStack alignment="leading" spacing={4}>
        <Text lineLimit={1} bold>
          {game.title}
        </Text>
        <HStack spacing={8} alignment="center">
          <SourcePill source={game.source} />
          <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={1}>
            {formatRemainingText(game.endDate)}
          </Text>
        </HStack>
      </VStack>
      <Spacer />
      <Image systemName="chevron.right" font={12} foregroundStyle="tertiaryLabel" />
    </HStack>
  )
}

function GameDetail({ game }: { game: FreeGame }) {
  const openClaim = () => {
    Safari.openURL(game.url)
  }

  return (
    <List navigationTitle="详情">
      <Section>
        <VStack alignment="leading" spacing={10}>
          <HStack spacing={10} alignment="center">
            <SourcePill source={game.source} />
            <Text font="footnote" foregroundStyle="secondaryLabel">
              {formatRemainingText(game.endDate)}
            </Text>
          </HStack>
          <Text font={20} bold>
            {game.title}
          </Text>
          {game.imageUrl ? (
            <Image imageUrl={game.imageUrl} resizable scaleToFit />
          ) : null}
          {game.description ? <Text font="footnote">{game.description}</Text> : null}
          <Button title="领取/打开商店页面" action={openClaim} />
          <Text font={12} foregroundStyle="secondaryLabel">
            需要在 Steam/Epic 登录后手动点击“添加到库/获取”完成领取。
          </Text>
        </VStack>
      </Section>
    </List>
  )
}

function Root() {
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all" as SourceFilter)
  const [games, setGames] = useState([] as FreeGame[])
  const [warnings, setWarnings] = useState([] as string[])

  const load = async (noCache: boolean) => {
    setLoading(true)
    try {
      const res = await loadFreeGames({ noCache })
      setGames(res.games)
      setWarnings(res.warnings)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
  }, [])

  const filtered = useMemo(() => {
    if (filter === "all") return games
    return games.filter((g: FreeGame) => g.source === filter)
  }, [games, filter])

  const filterTitle = filter === "all" ? "全部" : filter === "steam" ? "Steam" : "Epic"

  return (
    <NavigationStack>
      <List
        navigationTitle={`Game Push · ${filterTitle}`}
        toolbar={{
          topBarTrailing: (
            <HStack spacing={10}>
              <Button
                title={filter === "all" ? "Steam" : filter === "steam" ? "Epic" : "全部"}
                action={() => {
                  setFilter((prev: SourceFilter) => {
                    if (prev === "all") return "steam"
                    if (prev === "steam") return "epic"
                    return "all"
                  })
                }}
              />
              <Button title="刷新" action={() => load(true)} />
            </HStack>
          ),
        }}
      >
        {warnings.length ? (
          <Section title="提示">
            {warnings.map((w: string, i: number) => (
              <Text key={i} font="footnote" foregroundStyle="secondaryLabel">
                {w}
              </Text>
            ))}
          </Section>
        ) : null}

        <Section title={loading ? "加载中…" : filtered.length ? "最新限免" : "暂无限免"}>
          {filtered.map((game: FreeGame) => (
            <NavigationLink key={game.id} destination={<GameDetail game={game} />}>
              <GameRow game={game} />
            </NavigationLink>
          ))}
          {!loading && filtered.length === 0 ? (
            <Text font="footnote" foregroundStyle="secondaryLabel">
              可能是网络波动或地区接口返回为空，可点右上角刷新重试。
            </Text>
          ) : null}
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<Root />)
  Script.exit()
}

run()
