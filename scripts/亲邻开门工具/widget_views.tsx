/**
 * 各尺寸小组件视图。只做展示 + 交互入口，所有数据由 widget.tsx 在 present 前准备好。
 */
import { Button, HStack, Image, Spacer, Text, VStack } from "scripting"
import { OpenDoorIntent, SyncDoorsIntent } from "./app_intents"
import type { DoorKey } from "./core/protocol"
import type { Session } from "./core/session"
import type { LogEntry } from "./widget_shared"

export type WidgetData = {
  session: Session | null
  /** 已按 App 里的排序 + 收藏排好序（收藏在前） */
  doors: DoorKey[]
  /** 列表第一项：小尺寸 / 锁屏用 */
  selected: DoorKey | null
  favorites: string[]
  lastLog: LogEntry | null
}

/** 与主界面开门圆钮同色系，Widget 里不再用玻璃效果 */
const TINT = "rgba(92,143,188,0.92)"

function intentOf(door: DoorKey) {
  return OpenDoorIntent({
    doorControlId: door.doorControlId,
    doorControlName: door.doorControlName,
    macAddress: door.macAddress ?? "",
  })
}

function Header(props: { data: WidgetData; title?: string }) {
  return (
    <HStack spacing={4}>
      <Image systemName="door.left.hand.open" font="caption" foregroundStyle="secondaryLabel" />
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>
        {props.title ?? "亲邻开门"}
      </Text>
      <Spacer />
      <Image
        systemName={props.data.session ? "checkmark.shield.fill" : "exclamationmark.triangle.fill"}
        font="caption2"
        foregroundStyle={props.data.session ? "systemGreen" : "systemOrange"}
      />
    </HStack>
  )
}

/** 空状态：未登录 / 未同步门禁时提示用户回 App */
function EmptyHint({ data }: { data: WidgetData }) {
  return (
    <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>
      {data.session ? "还没有门禁，打开 App 同步一次" : "点按打开 App 登录"}
    </Text>
  )
}

function DoorRow(props: { door: DoorKey; showOnline?: boolean; fav?: boolean }) {
  const d = props.door
  return (
    <HStack spacing={10}>
      <Button intent={intentOf(d)} buttonStyle="plain">
        <Image
          systemName="lock.open.fill"
          font="footnote"
          foregroundStyle="white"
          frame={{ width: 28, height: 28 }}
          background={{ style: TINT, shape: "circle" }}
        />
      </Button>
      <VStack alignment="leading" spacing={1}>
        <HStack spacing={4}>
          {props.fav ? <Image systemName="star.fill" font="caption2" foregroundStyle="systemYellow" /> : null}
          <Text font="subheadline" bold lineLimit={1}>{d.doorControlName}</Text>
        </HStack>
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
          {d.online === "offline" ? "设备离线" : d.hasBluetoothModule === false ? "远程门禁" : "支持蓝牙"}
        </Text>
      </VStack>
      <Spacer />
      {props.showOnline && d.online ? (
        <Image
          systemName="circle.fill"
          font="caption2"
          foregroundStyle={d.online === "offline" ? "systemRed" : "systemGreen"}
        />
      ) : null}
    </HStack>
  )
}

export function SmallWidget({ data }: { data: WidgetData }) {
  const door = data.selected
  const ready = Boolean(door && data.session)
  const fav = Boolean(door && data.favorites.includes(door.doorControlId))
  return (
    <VStack alignment="leading" padding={12} spacing={6}>
      <Header data={data} />
      <HStack spacing={4}>
        {fav ? <Image systemName="star.fill" font="caption" foregroundStyle="systemYellow" /> : null}
        <Text font="title3" bold lineLimit={1}>
          {door?.doorControlName ?? "未设置门禁"}
        </Text>
      </HStack>
      <Spacer />
      {ready && door ? (
        <Button intent={intentOf(door)} buttonStyle="plain">
          <HStack
            spacing={5}
            padding={{ horizontal: 14, vertical: 7 }}
            background={{ style: TINT, shape: "capsule" }}
            foregroundStyle="white"
          >
            <Image systemName="key.fill" font="subheadline" />
            <Text font="subheadline" bold>开门</Text>
          </HStack>
        </Button>
      ) : (
        <EmptyHint data={data} />
      )}
    </VStack>
  )
}

export function MediumWidget({ data }: { data: WidgetData }) {
  const doors = data.doors.slice(0, 3)
  return (
    <VStack alignment="leading" padding={14} spacing={8}>
      <HStack spacing={4}>
        <Image systemName="door.left.hand.open" font="caption" foregroundStyle="secondaryLabel" />
        <Text font="caption" foregroundStyle="secondaryLabel">亲邻开门</Text>
        <Spacer />
        <Button intent={SyncDoorsIntent(undefined)} buttonStyle="plain">
          <Image systemName="arrow.clockwise" font="caption" foregroundStyle="secondaryLabel" />
        </Button>
      </HStack>
      {doors.length > 0 ? (
        doors.map(d => (
          <DoorRow
            key={d.doorControlId}
            door={d}
            showOnline
            fav={data.favorites.includes(d.doorControlId)}
          />
        ))
      ) : (
        <EmptyHint data={data} />
      )}
    </VStack>
  )
}

export function LargeWidget({ data }: { data: WidgetData }) {
  const doors = data.doors.slice(0, 5)
  return (
    <VStack alignment="leading" padding={16} spacing={10}>
      <HStack spacing={4}>
        <Image systemName="door.left.hand.open" font="subheadline" foregroundStyle="systemBlue" />
        <Text font="subheadline" bold>亲邻开门</Text>
        <Spacer />
        <Button intent={SyncDoorsIntent(undefined)} buttonStyle="plain">
          <Image systemName="arrow.clockwise" font="caption" foregroundStyle="secondaryLabel" />
        </Button>
      </HStack>
      {doors.length > 0 ? (
        <VStack alignment="leading" spacing={10} frame={{ maxWidth: "infinity" }}>
          {doors.map(d => (
            <DoorRow
              key={d.doorControlId}
              door={d}
              showOnline
              fav={data.favorites.includes(d.doorControlId)}
            />
          ))}
        </VStack>
      ) : (
        <EmptyHint data={data} />
      )}
      <Spacer />
      {data.lastLog ? (
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
          最近：{data.lastLog.text}
        </Text>
      ) : null}
    </VStack>
  )
}

export function RectangularWidget({ data }: { data: WidgetData }) {
  const door = data.selected
  return (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={4}>
        <Image systemName="door.left.hand.open" font="caption" />
        <Text font="headline" bold lineLimit={1}>
          {door?.doorControlName ?? "亲邻开门"}
        </Text>
      </HStack>
      <Text font="caption" lineLimit={1}>
        {data.session ? "点按打开 App · 小组件内可远程开门" : "点按打开 App 登录"}
      </Text>
    </VStack>
  )
}

export function CircularWidget({ data }: { data: WidgetData }) {
  return (
    <VStack alignment="center" spacing={1}>
      <Image systemName={data.session ? "lock.open.fill" : "lock.fill"} font="headline" />
      <Text font="caption2" bold lineLimit={1}>
        {data.selected?.doorControlName ?? "开门"}
      </Text>
    </VStack>
  )
}
