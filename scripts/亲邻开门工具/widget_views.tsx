/**
 * 各尺寸小组件视图。只做展示 + 交互入口，所有数据由 widget.tsx 在 present 前准备好。
 *
 * 两条点击规则（踩过坑）：
 *   1. 开门按钮用 `Button intent={...}`，交给 AppIntent 执行；
 *   2. 打开 App 只能用 `Link url={...}`，**不能**在根容器挂 widgetURL ——
 *      根级 widgetURL 会把整块区域变成打开 App 的热区，把 Button 的 intent 抢掉。
 */
import { Button, HStack, Image, Link, Spacer, Text, VStack } from "scripting"
import { OpenDoorIntent, SyncDoorsIntent } from "./app_intents"
import type { DoorKey } from "./core/protocol"
import type { SnapshotResult } from "./core/snapshot"
import type { Session } from "./core/session"
import type { LogEntry } from "./widget_shared"

export type WidgetData = {
  session: Session | null
  /** 已按 App 里的排序 + 收藏排好序（收藏在前） */
  doors: DoorKey[]
  /** 列表第一项：小尺寸 / 锁屏用 */
  selected: DoorKey | null
  favorites: string[]
  /** 本地日志（App 与小组件同进程时才有内容） */
  lastLog: LogEntry | null
  /** App Group 快照里记下的最后一次开门结果，跨进程唯一可靠的反馈来源 */
  lastResult: SnapshotResult | null
  /** 打开 App 的 scripting:// 链接（替代根级 widgetURL） */
  appURL: string
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

/** 14:32 */
function hhmm(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 把 [小组件] ✅ 开门成功 · A座大堂 压缩成 ✅ 开门成功 · A座大堂 14:32 */
function lastResult(data: WidgetData): string | null {
  // 快照里的结果是跨进程唯一可靠的（扩展读不到 App 的日志）
  if (data.lastResult) {
    const r = data.lastResult
    return `${r.ok ? "✅" : "❌"} ${r.text} · ${hhmm(r.ts)}`
  }
  if (!data.lastLog) return null
  const body = data.lastLog.text.replace(/^\[小组件\]\s*/, "")
  return `${body} · ${hhmm(data.lastLog.ts)}`
}

/** 最近一次操作的时间戳（毫秒），没有就 null */
function lastResultTs(data: WidgetData): number | null {
  return data.lastResult?.ts ?? data.lastLog?.ts ?? null
}

/** 最近一次操作的时间（分钟），用于判断要不要在小尺寸里显示反馈 */
function minutesSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 60000)
}

function Header(props: { data: WidgetData; title?: string; prominent?: boolean }) {
  const text = (
    <Text
      font={props.prominent ? "subheadline" : "caption"}
      bold={props.prominent}
      foregroundStyle={props.prominent ? undefined : "secondaryLabel"}
      lineLimit={1}
    >
      {props.title ?? "亲邻开门"}
    </Text>
  )
  return (
    <HStack spacing={4}>
      <Image
        systemName="door.left.hand.open"
        font={props.prominent ? "subheadline" : "caption"}
        foregroundStyle={props.prominent ? "systemBlue" : "secondaryLabel"}
      />
      <Link url={props.data.appURL}>{text}</Link>
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
    <Link url={data.appURL}>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>
        {data.session ? "还没有门禁，点按打开 App 同步一次" : "点按打开 App 登录"}
      </Text>
    </Link>
  )
}

/**
 * 一行门禁：左侧圆钮开门（AppIntent），名字区域打开 App（Link）。
 * 两个热区互不干扰，且不需要根级 widgetURL。
 */
function DoorRow(props: { door: DoorKey; appURL: string; showOnline?: boolean; fav?: boolean }) {
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
      <Link url={props.appURL}>
        <HStack spacing={4} frame={{ maxWidth: "infinity" }}>
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
      </Link>
    </HStack>
  )
}

export function SmallWidget({ data }: { data: WidgetData }) {
  const door = data.selected
  const ready = Boolean(door && data.session)
  const fav = Boolean(door && data.favorites.includes(door.doorControlId))
  const result = lastResult(data)
  const ts = lastResultTs(data)
  // 只在刚点过（30 分钟内）时显示结果，避免长期占位
  const fresh = ts != null && minutesSince(ts) <= 30
  return (
    <VStack alignment="leading" padding={12} spacing={6}>
      <Header data={data} />
      <Link url={data.appURL}>
        <HStack spacing={4}>
          {fav ? <Image systemName="star.fill" font="caption" foregroundStyle="systemYellow" /> : null}
          <Text font="title3" bold lineLimit={1}>
            {door?.doorControlName ?? "未设置门禁"}
          </Text>
        </HStack>
      </Link>
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
      {ready && fresh && result ? (
        <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
          {result}
        </Text>
      ) : null}
    </VStack>
  )
}

export function MediumWidget({ data }: { data: WidgetData }) {
  const doors = data.doors.slice(0, 3)
  const result = lastResult(data)
  return (
    <VStack alignment="leading" padding={14} spacing={8}>
      <HStack spacing={4}>
        <Image systemName="door.left.hand.open" font="caption" foregroundStyle="secondaryLabel" />
        <Link url={data.appURL}>
          <Text font="caption" foregroundStyle="secondaryLabel">亲邻开门</Text>
        </Link>
        <Spacer />
        {/* 没有根级 widgetURL 了，这里放一条最近结果，点完按钮能立刻看出成功与否 */}
        {result ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
            {result}
          </Text>
        ) : null}
        <Button intent={SyncDoorsIntent(undefined)} buttonStyle="plain">
          <Image systemName="arrow.clockwise" font="caption" foregroundStyle="secondaryLabel" />
        </Button>
      </HStack>
      {doors.length > 0 ? (
        doors.map(d => (
          <DoorRow
            key={d.doorControlId}
            door={d}
            appURL={data.appURL}
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
  const result = lastResult(data)
  return (
    <VStack alignment="leading" padding={16} spacing={10}>
      <Header data={data} prominent />
      {doors.length > 0 ? (
        <VStack alignment="leading" spacing={10} frame={{ maxWidth: "infinity" }}>
          {doors.map(d => (
            <DoorRow
              key={d.doorControlId}
              door={d}
              appURL={data.appURL}
              showOnline
              fav={data.favorites.includes(d.doorControlId)}
            />
          ))}
        </VStack>
      ) : (
        <EmptyHint data={data} />
      )}
      <Spacer />
      <HStack spacing={4}>
        {/* 同步按钮挂在大尺寸底部，避免和标题行挤在一起 */}
        <Button intent={SyncDoorsIntent(undefined)} buttonStyle="plain">
          <HStack spacing={3} foregroundStyle="tertiaryLabel">
            <Image systemName="arrow.clockwise" font="caption2" />
            <Text font="caption2">同步</Text>
          </HStack>
        </Button>
        <Spacer />
        {result ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
            {result}
          </Text>
        ) : null}
      </HStack>
    </VStack>
  )
}

export function RectangularWidget({ data }: { data: WidgetData }) {
  const door = data.selected
  const result = lastResult(data)
  return (
    <Link url={data.appURL}>
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
        <HStack spacing={4}>
          <Image systemName="door.left.hand.open" font="caption" />
          <Text font="headline" bold lineLimit={1}>
            {door?.doorControlName ?? "亲邻开门"}
          </Text>
        </HStack>
        <Text font="caption" lineLimit={1}>
          {result ?? (data.session ? "点按打开 App · 小组件内可远程开门" : "点按打开 App 登录")}
        </Text>
      </VStack>
    </Link>
  )
}

export function CircularWidget({ data }: { data: WidgetData }) {
  return (
    <Link url={data.appURL}>
      <VStack alignment="center" spacing={1}>
        <Image systemName={data.session ? "lock.open.fill" : "lock.fill"} font="headline" />
        <Text font="caption2" bold lineLimit={1}>
          {data.selected?.doorControlName ?? "开门"}
        </Text>
      </VStack>
    </Link>
  )
}
