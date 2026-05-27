import { buildWidgetReloadDate, formatRemainingText, loadFreeGames, rotateWidgetIndexIfNeeded } from "./shared"
import { NextGameIntent, RefreshWidgetIntent } from "./app_intents"
import { type FreeGame } from "./types"

import {
  Widget,
  ZStack,
  VStack,
  HStack,
  Spacer,
  Text,
  Image,
  Button,
  AccessoryWidgetBackground,
} from "scripting"



function SourceIcon({ source }: { source: FreeGame["source"] }) {
  const icon = source === "steam" ? "steamlogo" : "gamecontroller.fill"
  const color = source === "steam" ? "systemBlue" : "systemOrange"
  return <Image systemName={icon} font={12} foregroundStyle={color} />
}

function EmptyView() {
  return (
    <VStack alignment="leading" spacing={6}>
      <HStack spacing={6} alignment="center">
        <Image systemName="gift.fill" font={14} foregroundStyle="systemPink" />
        <Text font={12} bold>
          Game Push
        </Text>
      </HStack>
      <Text font={12} foregroundStyle="secondaryLabel" lineLimit={2}>
        暂无限免内容
      </Text>
    </VStack>
  )
}

function GameCard({ game, total }: { game: FreeGame; total: number }) {
  const showCover = Widget.family !== "accessoryCircular"
  const showActions = Widget.family === "systemMedium" || Widget.family === "systemLarge" || Widget.family === "accessoryRectangular"

  return (
    <VStack alignment="leading" spacing={8}>
      <HStack spacing={8} alignment="center">
        <SourceIcon source={game.source} />
        <Text font={12} bold lineLimit={1}>
          {game.title}
        </Text>
        <Spacer />
        <Text font={10} foregroundStyle="secondaryLabel" lineLimit={1}>
          {formatRemainingText(game.endDate)}
        </Text>
      </HStack>

      {showCover && game.imageUrl ? (
        <Image imageUrl={game.imageUrl} resizable scaleToFill frame={{ height: Widget.family === "systemSmall" ? 44 : 64 }} />
      ) : null}

      {showActions && total > 1 ? (
        <HStack spacing={10} alignment="center">
          <Button intent={NextGameIntent({ total })} buttonStyle="plain">
            <HStack spacing={6} alignment="center">
              <Image systemName="chevron.right.circle" font={12} foregroundStyle="systemBlue" />
              <Text font={12} foregroundStyle="systemBlue">
                下一条
              </Text>
            </HStack>
          </Button>
          <Spacer />
          <Button intent={RefreshWidgetIntent({})} buttonStyle="plain">
            <Image systemName="arrow.clockwise.circle" font={12} foregroundStyle="systemGray" />
          </Button>
        </HStack>
      ) : showActions ? (
        <HStack spacing={10} alignment="center">
          <Button intent={RefreshWidgetIntent({})} buttonStyle="plain">
            <HStack spacing={6} alignment="center">
              <Image systemName="arrow.clockwise.circle" font={12} foregroundStyle="systemGray" />
              <Text font={12} foregroundStyle="systemGray">
                刷新
              </Text>
            </HStack>
          </Button>
          <Spacer />
        </HStack>
      ) : null}
    </VStack>
  )
}

function Root({ game, total }: { game: FreeGame | null; total: number }) {
  return (
    <ZStack>
      <AccessoryWidgetBackground />
      {game ? <GameCard game={game} total={total} /> : <EmptyView />}
    </ZStack>
  )
}

async function runWidget() {
  const reloadDate = buildWidgetReloadDate()
  const res = await loadFreeGames({ noCache: false })
  const games = res.games

  if (!games.length) {
    Widget.present(<Root game={null} total={0} />, { policy: "after", date: reloadDate })
    return
  }

  const index = await rotateWidgetIndexIfNeeded(games.length)
  const game = games[index % games.length] ?? games[0]

  Widget.present(<Root game={game} total={games.length} />, { policy: "after", date: reloadDate })
}

runWidget()
