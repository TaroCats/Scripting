import {
  AppEvents,
  Button,
  Circle,
  EditButton,
  ForEach,
  HStack,
  Image,
  List,
  Menu,
  Navigation,
  NavigationStack,
  Picker,
  Script,
  type ScenePhase,
  Section,
  Spacer,
  type ShapeStyle,
  Tab,
  TabView,
  Text,
  TextField,
  VStack,
  Widget,
  type WidgetFamily,
  ZStack,
  useEffect,
  useObservable,
  useRef,
  useState,
} from "scripting"
import {
  fetchUserDoors,
  loginBySmsCode,
  loginByUserId,
  SessionExpiredError,
} from "./core/api"
import { openDoor } from "./core/opendoor"
import {
  BUILD_TAG,
  DEFAULT_BLE_SETTINGS,
  DEFAULT_CONFIG,
  K,
  type ApiConfig,
  type BleSettings,
  type DoorKey,
  type WidgetDiag,
} from "./core/protocol"
import {
  arrangeDoors,
  healPrefs,
  loadDoorPrefs,
  normalizePrefs,
  saveDoorPrefs,
  toggleFavorite,
  type DoorPrefs,
} from "./core/door_prefs"
import { clearSession, isExpiringSoon, loadSession, saveSession, type Session } from "./core/session"

/** 深拷贝 —— Storage.get 返回的对象可能被运行时冻结，写入前必须复制 */
function safeClone<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") return obj
  return JSON.parse(JSON.stringify(obj)) as T
}

function loadConfig(): ApiConfig {
  const saved = Storage.get<ApiConfig>(K.config) as ApiConfig | null
  return { ...safeClone(DEFAULT_CONFIG), ...safeClone(saved ?? {}) }
}
function loadBle(): BleSettings {
  const saved = Storage.get<BleSettings>(K.ble) as BleSettings | null
  return saved ? safeClone(saved) : safeClone(DEFAULT_BLE_SETTINGS)
}
function loadDoors(): DoorKey[] {
  const saved = Storage.get<DoorKey[]>(K.doors) as DoorKey[] | null
  return saved ? safeClone(saved) : []
}

function fmtTime(ts: number): string {
  if (!ts) return "—"
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function remainText(s: Session): string {
  if (!s.expiresAt) return "长期"
  const ms = s.expiresAt - Date.now()
  if (ms <= 0) return "已过期（下次自动续期）"
  const min = Math.floor(ms / 60000)
  return min >= 1 ? `${min} 分钟` : "不到 1 分钟"
}

function SectionTitle(props: { icon: string; title: string; tint?: ShapeStyle }) {
  return (
    <HStack spacing={6}>
      <Image systemName={props.icon} foregroundStyle={props.tint ?? "secondaryLabel"} />
      <Text font="subheadline" foregroundStyle="secondaryLabel">{props.title}</Text>
    </HStack>
  )
}

/** 日志条目 */
type LogEntry = { ts: number; text: string }

const LOG_KEY = "ql_logs"
const LOG_MAX = 200
const LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天
/** 当前 Tab 落盘，避免任何意外重挂载把用户丢回「开门」页 */
const TAB_KEY = "ql_tab"

/**
 * 排序/收藏/门禁列表改过、但还没推给小组件的标记。
 *
 * 为什么不在改动瞬间就 Widget.reloadAll()：
 * 拖动排序时立刻刷会让列表在拖拽过程中被打断（还可能是"跳回开门页"的诱因）。
 * 改到 App 退到后台时统一刷一次 —— 那时用户正好要去看主屏幕小组件，时序刚好。
 */
let widgetDirty = false

/**
 * 门禁列表「此刻屏幕上的顺序」，由 DoorListTab 每次渲染写入。
 *
 * 系统拖拽是直接改 Observable 数组的，`subscribe` 理应会触发；但为了不赌框架行为，
 * 退到后台 / 点刷新时再兜底落盘一次 —— 反正那时顺序已经定格，写进去不会误伤。
 */
let liveOrder: string[] | null = null
let liveFavorites: string[] | null = null

/** 把屏幕上的顺序落盘；真的写入了返回 true */
function flushLiveOrder(): boolean {
  const order = liveOrder
  if (!order || order.length === 0) return false
  const cur = loadDoorPrefs()
  const same =
    cur.order.length === order.length &&
    cur.order.every((id, i) => id === order[i])
  if (same) return false
  saveDoorPrefs({ order, favorites: liveFavorites ?? cur.favorites })
  return true
}

function loadLogs(): LogEntry[] {
  const saved = Storage.get<LogEntry[]>(LOG_KEY) as LogEntry[] | null
  if (!saved || !Array.isArray(saved)) return []
  const cutoff = Date.now() - LOG_TTL_MS
  return saved.filter(e => e && typeof e.ts === "number" && e.ts > cutoff).slice(0, LOG_MAX)
}

function persistLogs(entries: LogEntry[]) {
  Storage.set(LOG_KEY, entries)
}

function fmtLogTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 列表行：id 供 ForEach 做 diff，door 供渲染，fav/selected 是展示态 */
type DoorListRow = {
  id: string
  door: DoorKey
  fav: boolean
  selected: boolean
}

/**
 * 门禁排序 / 收藏页。
 *
 * 两个关键约束（都踩过）：
 *   1. `ForEach` 只能用 `data: Observable<T[]>`，`count` 模式已废弃，运行时会报 ERROR；
 *      `editActions="move"` 让系统拖拽直接改 Observable 数组，所以这里订阅变更回写 Storage。
 *   2. prefs 不能放在 App 里，否则每次拖动都重渲染 TabView，会跳回「开门」页。
 *      这里自己读 Storage，改动只影响这个子树。
 */
function DoorListTab(props: {
  doors: DoorKey[]
  loading: boolean
  selectedDoorId: string
  onSync: () => void
  onRefreshWidget: () => void
}) {
  // 写完 Storage 后靠它触发一次重渲染，让下面两个 Observable 重建
  const [, setVer] = useState(0)
  // 每次渲染都从 Storage 重读，避免同步后被 normalizePrefs 改过的偏好读不到
  const prefs: DoorPrefs = loadDoorPrefs()
  const toastVisible = useObservable(false)
  const [toastMsg, setToastMsg] = useState("")

  const arranged = arrangeDoors(props.doors, prefs)
  const favSet = new Set(prefs.favorites)
  const favList = arranged.filter(d => favSet.has(d.doorControlId))
  const otherList = arranged.filter(d => !favSet.has(d.doorControlId))

  const makeRow = (d: DoorKey): DoorListRow => ({
    id: d.doorControlId,
    door: d,
    fav: favSet.has(d.doorControlId),
    selected: props.selectedDoorId === d.doorControlId,
  })

  const favRows = useObservable<DoorListRow[]>(() => favList.map(makeRow))
  const otherRows = useObservable<DoorListRow[]>(() => otherList.map(makeRow))

  // 供退后台/刷新小组件时兜底落盘（见文件顶部 flushLiveOrder）
  liveOrder = [...favRows.value, ...otherRows.value].map(r => r.id)
  liveFavorites = favRows.value.map(r => r.id)

  /** 期望状态签名：用于判断要不要把 Observable 重建一遍 */
  const targetSig =
    favList.map(d => d.doorControlId).join(",") + "|" +
    otherList.map(d => d.doorControlId).join(",") + "|" +
    props.selectedDoorId
  const lastSig = useRef<string | null>(null)

  // 外部变化（收藏开关 / 同步门禁 / 选中项）→ 重建两个 Observable
  useEffect(() => {
    if (lastSig.current === targetSig) return
    lastSig.current = targetSig
    favRows.setValue(favList.map(makeRow))
    otherRows.setValue(otherList.map(makeRow))
  }, [targetSig])

  // 系统拖动改了数组 → 回写顺序。顺序没变就跳过，避免自己写自己。
  useEffect(() => {
    const persist = () => {
      const favIds = favRows.value.map(r => r.id)
      const otherIds = otherRows.value.map(r => r.id)
      const order = [...favIds, ...otherIds]
      if (order.length === 0) return
      const cur = loadDoorPrefs()
      const same =
        cur.order.length === order.length &&
        cur.order.every((id, i) => id === order[i]) &&
        cur.favorites.length === favIds.length &&
        cur.favorites.every((id, i) => id === favIds[i])
      if (same) return
      saveDoorPrefs({ order, favorites: favIds })
      widgetDirty = true
      // 提前记下签名，免得上面那个 effect 再刷一遍
      lastSig.current = [favIds.join(","), otherIds.join(","), props.selectedDoorId].join("|")
    }
    favRows.subscribe(persist)
    otherRows.subscribe(persist)
    return () => {
      favRows.unsubscribe(persist)
      otherRows.unsubscribe(persist)
    }
  }, [])

  function commit(next: DoorPrefs, message?: string) {
    saveDoorPrefs(next)
    widgetDirty = true
    lastSig.current = null
    setVer(v => v + 1)
    if (message) {
      setToastMsg(message)
      toastVisible.setValue(true)
    }
  }

  function onToggle(id: string) {
    const nowFav = !prefs.favorites.includes(id)
    commit(toggleFavorite(prefs, arranged.map(d => d.doorControlId), id), nowFav ? "已收藏并置顶" : "已取消收藏")
  }

  function onReset() {
    commit(
      { order: props.doors.map(d => d.doorControlId), favorites: prefs.favorites },
      "已按服务端顺序重排（收藏保留）"
    )
  }

  /** 一行：左侧 ☆/★ 切收藏，右侧在线状态；当前开门页选中的门带勾 */
  function rowView(r: DoorListRow) {
    const d = r.door
    return (
      <HStack key={r.id} spacing={10}>
        <Button buttonStyle="plain" action={() => onToggle(r.id)}>
          <Image
            systemName={r.fav ? "star.fill" : "star"}
            font="body"
            foregroundStyle={r.fav ? "systemYellow" : "tertiaryLabel"}
            frame={{ width: 32, height: 32 }}
          />
        </Button>
        <VStack alignment="leading" spacing={2}>
          <Text font="body" lineLimit={1}>{d.doorControlName}</Text>
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1}>
            {`${d.doorControlId} · ${d.online === "offline" ? "离线" : "在线"}${d.hasBluetoothModule === false ? " · 远程" : " · 蓝牙"}`}
          </Text>
        </VStack>
        <Spacer />
        {r.selected ? (
          <Image systemName="checkmark.circle.fill" font="caption" foregroundStyle="systemBlue" />
        ) : null}
        <Image
          systemName="circle.fill"
          font="caption2"
          foregroundStyle={d.online === "offline" ? "systemRed" : "systemGreen"}
        />
      </HStack>
    )
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="门禁列表"
        navigationBarTitleDisplayMode="large"
        toast={{
          message: toastMsg,
          isPresented: toastVisible,
          duration: 2,
          position: "bottom",
        }}
        toolbar={{
          topBarTrailing: [<EditButton key="edit" />],
        }}
      >
        <Section
          header={<SectionTitle icon="star.fill" title="收藏（置顶）" tint="systemYellow" />}
          footer={
            <Text font="caption" foregroundStyle="tertiaryLabel">
              {favList.length > 0
                ? `收藏 ${favList.length} 项，按顺序排在最前；小尺寸小组件显示第一项。`
                : "点左侧 ☆ 收藏常用门禁，收藏后自动置顶，并优先出现在小组件里。"}
            </Text>
          }
        >
          {favList.length > 0 ? (
            <ForEach data={favRows} editActions="move" builder={r => rowView(r)} />
          ) : (
            <Text font="caption" foregroundStyle="secondaryLabel">（暂无收藏）</Text>
          )}
        </Section>

        <Section
          header={<SectionTitle icon="door.left.hand.open" title="其他门禁" />}
          footer={
            <Text font="caption" foregroundStyle="tertiaryLabel">
              点右上角「编辑」后拖动排序。顺序与收藏只存本机，同步门禁不会覆盖；新增的门禁追加到本组末尾。
            </Text>
          }
        >
          {otherList.length > 0 ? (
            <ForEach data={otherRows} editActions="move" builder={r => rowView(r)} />
          ) : (
            <Text font="caption" foregroundStyle="secondaryLabel">
              {arranged.length > 0 ? "（全部门禁都已收藏）" : "（暂无门禁，先同步一次）"}
            </Text>
          )}
        </Section>

        <Section
          footer={
            <Text font="caption" foregroundStyle="tertiaryLabel">
              小组件（中/大尺寸）按「收藏 → 其他」的顺序依次展示；小尺寸与锁屏显示列表第一项。
              改完顺序退到桌面会自动刷新，也可以点下面的按钮立刻刷。
            </Text>
          }
        >
          <Button
            title={props.loading ? "同步中…" : "同步门禁列表"}
            systemImage="arrow.clockwise"
            action={props.onSync}
          />
          <Button title="刷新小组件" systemImage="square.grid.2x2" action={props.onRefreshWidget} />
          <Button title="恢复默认顺序" role="destructive" action={onReset} />
        </Section>
      </List>
    </NavigationStack>
  )
}

function App(props: { initialLog: string }) {
  const [cfg, setCfg] = useState<ApiConfig>(loadConfig())
  const [ble, setBle] = useState<BleSettings>(loadBle())
  const [session, setSession] = useState<Session | null>(loadSession())
  const [doors, setDoors] = useState<DoorKey[]>(loadDoors())
  /**
   * 排序/收藏不做成 App 的 state：它由「门禁」Tab 内部的组件自己持有。
   * 这样拖动一行、点个收藏不会重渲染 TabView（那正是"拖完自动跳回开门页"的诱因）。
   * App 每次渲染时按需从 Storage 读一次，够用且不会读到旧值。
   */
  const prefs = loadDoorPrefs()
  /** 展示用顺序：收藏在前，组内按用户拖动的顺序 */
  const arrangedDoors = arrangeDoors(doors, prefs)
  const [selectedDoorId, setSelectedDoorId] = useState<string>(
    (Storage.get<string>("ql_selected_door") as string) ?? ""
  )
  const [phone, setPhone] = useState<string>((Storage.get<string>(K.phone) as string) ?? "")
  const [code, setCode] = useState("")
  const [manualSid, setManualSid] = useState("")
  const [tab, setTab] = useState<number>(() => {
    // 从小组件点进来（scripting://run/...?from=widget）时直接落在开门页
    const qp = Script.queryParameters as Record<string, unknown> | undefined
    if (qp && String(qp.from ?? "") === "widget") return 0
    const v = Number(Storage.get<number>(TAB_KEY) as number)
    return Number.isFinite(v) && v >= 0 && v <= 3 ? v : 0
  })
  const [userId, setUserId] = useState<string>((Storage.get<string>("ql_user_id") as string) ?? "")
  const [communityId, setCommunityId] = useState<string>(cfg.communityId ?? "")
  const [busy, setBusy] = useState(false)
  const [loadingDoors, setLoadingDoors] = useState(false)
  // 「我的 → 数据快照」的刷新计数器
  const [, setDiagTick] = useState(0)
  /** 小组件上一次渲染时读到的数据（widget.tsx 写入） */
  const diag = Storage.get<WidgetDiag>(K.widgetDiag) as WidgetDiag | null
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = loadLogs()
    if (props.initialLog) {
      return [{ ts: Date.now(), text: props.initialLog }, ...saved]
    }
    return saved
  })

  const toastVisible = useObservable(false)
  const [toastMsg, setToastMsg] = useState("")

  function addLog(text: string) {
    const entry: LogEntry = { ts: Date.now(), text }
    setLogs(prev => {
      const next = [entry, ...prev].slice(0, LOG_MAX)
      persistLogs(next)
      return next
    })
  }

  /** 当前操作：toast 提示 + 记入日志 */
  function say(line: string) {
    addLog(line)
    setToastMsg(line)
    toastVisible.setValue(true)
  }
  /** 细节步骤：只记日志，不打扰用户 */
  function log(line: string) {
    addLog(line)
  }

  function onClearLogs() {
    setLogs([])
    persistLogs([])
    say("日志已清空")
  }

  async function onCopyLine(text: string) {
    await Pasteboard.setString(text)
  }

  async function onCopyAllLogs() {
    if (logs.length === 0) return
    const all = logs.map(e => `${fmtLogTime(e.ts)}  ${e.text}`).join("\n")
    await Pasteboard.setString(all)
  }

  function persistCfg(next: ApiConfig) {
    setCfg(next)
    Storage.set(K.config, next)
  }
  function persistDoors(next: DoorKey[]) {
    setDoors(next)
    Storage.set(K.doors, next)
    // 同步会覆盖服务端顺序，这里把用户排序/收藏套回去（新增的门禁落到未收藏组末尾）
    const np = normalizePrefs(next.map(d => d.doorControlId), prefs)
    saveDoorPrefs(np)
    widgetDirty = true
    const first = arrangeDoors(next, np)[0]
    if (first && !next.some(d => d.doorControlId === selectedDoorId)) {
      setSelectedDoorId(first.doorControlId)
      Storage.set("ql_selected_door", first.doorControlId)
    }
  }

  /** 把最新的门禁/顺序推给小组件 */
  function reloadWidgets() {
    if (flushLiveOrder()) widgetDirty = true
    widgetDirty = false
    // 三种刷新都打一遍：reloadAll 之外，用户小组件 / 测试小组件各有独立 kind，
    // 只调 reloadAll 时遇到过"桌面那个就是不更新"的情况，全打一遍最省事。
    try { Widget.reloadAll() } catch { /* 预览等场景下不可用，忽略 */ }
    try { Widget.reloadUserWidgets() } catch { /* ignore */ }
    try { Widget.reloadTestWidgets() } catch { /* ignore */ }
  }

  // 退到后台就刷一次小组件；回到前台则重读一次本地门禁
  useEffect(() => {
    const onPhase = (phase: ScenePhase) => {
      if (phase === "active") {
        // 小组件里的「同步」也会写 ql_doors。不重读的话 App 会一直显示自己那份旧列表，
        // 看起来就像"两边数据不一致"，实际上只是 App 没刷新内存。
        setDoors(loadDoors())
        return
      }
      if (phase !== "background") return
      // 先把屏幕上定格的顺序落盘（兜底，不依赖 ForEach 的 Observable 回调）
      if (flushLiveOrder()) widgetDirty = true
      if (!widgetDirty) return
      widgetDirty = false
      try { Widget.reloadAll() } catch { /* ignore */ }
      try { Widget.reloadUserWidgets() } catch { /* ignore */ }
      try { Widget.reloadTestWidgets() } catch { /* ignore */ }
    }
    AppEvents.scenePhase.addListener(onPhase)
    return () => AppEvents.scenePhase.removeListener(onPhase)
  }, [])

  /**
   * 启动时自愈一次偏好：早期版本只把「操作过的门禁」写进 order，
   * 遗留的半截 order 会让没被记录的门禁排名垫底，表现就是列表/小组件前几项跑没了、顺序乱。
   */
  useEffect(() => {
    const ds = loadDoors()
    if (ds.length === 0) return
    const before = JSON.stringify(loadDoorPrefs())
    const healed = healPrefs(ds.map(d => d.doorControlId), loadDoorPrefs())
    if (JSON.stringify(healed) !== before) {
      saveDoorPrefs(healed)
      widgetDirty = true
    }
  }, [])

  const selectedDoor = arrangedDoors.find(d => d.doorControlId === selectedDoorId) ?? arrangedDoors[0]

  function phoneValid(): boolean {
    return /^1\d{10}$/.test(phone)
  }
  function saveCommunityId(v: string) {
    const cleaned = v.replace(/\D/g, "")
    setCommunityId(cleaned)
    persistCfg({ ...cfg, communityId: cleaned })
  }

  // ── 登录 ──

  function onSendCode() {
    if (!phoneValid()) {
      say("请先填写 11 位手机号")
      return
    }
    say("请到原「亲邻开门」App 获取验证码，收到后回来填 6 位数字")
  }

  async function onLogin() {
    if (busy) return
    if (!phoneValid()) { say("请输入11位手机号"); return }
    if (code.trim().length < 4) { say("验证码有误"); return }
    if (!communityId.trim()) { say("请先填小区 ID"); return }
    setBusy(true)
    try {
      const { sessionId } = await loginBySmsCode(phone, code.trim(), { cfg })
      setSession(saveSession({ token: sessionId, sessionId, phone }))
      setCode("")
      say("登录成功")
      await refreshDoors()
    } catch (e) {
      say(`登录失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onLoginByUserId() {
    if (busy) return
    const uid = userId.trim()
    if (!uid) { say("请填写 userId"); return }
    if (!communityId.trim()) { say("请先填小区 ID"); return }
    setBusy(true)
    try {
      const r = await loginByUserId(uid, { cfg })
      const s = saveSession({
        token: r.sessionId, sessionId: r.sessionId,
        phone: phone || "userId 登录", userId: uid, ttlSec: r.expires,
      })
      setSession(s)
      setManualSid("")
      say(`登录成功（${Math.round(r.expires / 60)} 分钟）`)
      await refreshDoors(s)
    } catch (e) {
      say(`登录失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onUseManualSid() {
    if (busy) return
    const sid = manualSid.trim()
    if (sid.length < 8) { say("sessionId 不完整"); return }
    if (!communityId.trim()) { say("请先填小区 ID"); return }
    const s = saveSession({
      token: sid, sessionId: sid,
      phone: phone || "手动录入", userId: userId.trim() || undefined, ttlSec: 1800,
    })
    setSession(s)
    say("会话已保存")
    await refreshDoors(s)
  }

  function onLogout() {
    if (busy) return
    clearSession()
    setSession(null)
    say("已登出")
  }

  // ── 会话 / 门禁 ──

  async function ensureSession(cur: Session | null): Promise<Session | null> {
    if (!cur) return null
    if (!isExpiringSoon(cur)) return cur
    if (!cur.userId) { log("会话将过期且无 userId，无法续期"); return cur }
    try {
      const r = await loginByUserId(cur.userId, { cfg })
      const s = saveSession({
        token: r.sessionId, sessionId: r.sessionId,
        phone: cur.phone, userId: cur.userId, ttlSec: r.expires,
      })
      setSession(s)
      log("会话已自动续期")
      return s
    } catch (e) {
      log(`续期失败：${e instanceof Error ? e.message : String(e)}`)
      return cur
    }
  }

  async function refreshDoors(override?: Session) {
    if (loadingDoors) return
    let sess = override ?? session
    if (!sess) { say("未登录"); return }
    setLoadingDoors(true)
    try {
      sess = (await ensureSession(sess)) ?? sess
      const list = await fetchUserDoors({ cfg, session: sess })
      persistDoors(
        list.map(d => ({
          doorControlId: d.doorControlId,
          doorControlName: d.doorControlName,
          macAddress: d.macAddress,
          hasBluetoothModule: d.hasBluetoothModule,
          online: d.online,
        }))
      )
      say(`已同步 ${list.length} 个门禁`)
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession(); setSession(null)
        say("会话失效，请重新登录")
      } else {
        say(`同步失败：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setLoadingDoors(false)
    }
  }

  async function onCheckLogin() {
    if (busy || !session) return
    setBusy(true)
    try {
      const list = await fetchUserDoors({ cfg, session })
      say(`会话有效（${list.length} 个门禁）`)
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession(); setSession(null)
        say("会话失效，请重新登录")
      } else {
        say(`校验失败：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  /** 应用内近似预览（真实布局、裁剪仍需主屏幕验证） */
  async function onPreviewWidget(family: WidgetFamily) {
    try {
      await Widget.preview({ family })
    } catch (e) {
      say(`预览失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function onOpen() {
    if (busy) return
    if (!selectedDoor) { say("请先选择门禁"); return }
    if (!session) { say("未登录"); return }
    setBusy(true)
    try {
      const sess = (await ensureSession(session)) ?? session
      const r = await openDoor(selectedDoor, { cfg, session: sess }, ble, {
        onStep: (stage, detail) => log(`· ${stage}${detail ? ` ${detail}` : ""}`),
      })
      say(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`)
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession(); setSession(null)
        say("会话失效，请重新登录")
      } else {
        say(`开门异常：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  // ── 未登录：登录页 ──
  if (!session) {
    return (
      <NavigationStack>
        <List
          navigationTitle="登录"
          navigationBarTitleDisplayMode="large"
          toast={{
            message: toastMsg,
            isPresented: toastVisible,
            duration: 2.5,
            position: "bottom",
          }}
        >
          <Section
            header={<SectionTitle icon="bolt.fill" title="用 userId 登录" tint="systemOrange" />}
            footer={
              <Text font="caption" foregroundStyle="tertiaryLabel">
                userId 可在原 App 抓包或带 userId= 的链接里找到，会话 30 分钟自动续期。
              </Text>
            }
          >
            <TextField
              title="userId"
              value={userId}
              onChanged={v => { setUserId(v); Storage.set("ql_user_id", v) }}
              prompt="只填自己账号的 userId"
            />
            <TextField
              title="小区 ID"
              value={communityId}
              onChanged={saveCommunityId}
              prompt="例如 7829"
            />
            <Button title={busy ? "处理中…" : "登录"} action={onLoginByUserId} role="confirm" />
          </Section>

          <Section
            header={<SectionTitle icon="key.horizontal.fill" title="已有会话" />}
            footer={
              <Text font="caption" foregroundStyle="tertiaryLabel">
                手机号验证码通道被 WAF 拦截，可从抓包拿到 sessionId 直接粘贴。
              </Text>
            }
          >
            <TextField
              title="sessionId"
              value={manualSid}
              onChanged={setManualSid}
              prompt="h5:xxxxxxxx"
            />
            <TextField
              title="小区 ID"
              value={communityId}
              onChanged={saveCommunityId}
              prompt="例如 7829"
            />
            <Button title="使用" action={onUseManualSid} />
          </Section>
        </List>
      </NavigationStack>
    )
  }

  // ── 已登录：Tab 布局 ──
  return (
    <TabView
      tabIndex={tab}
      onTabIndexChanged={v => {
        setTab(v)
        // 落盘：万一被刷新/重挂载，也不会把用户丢回「开门」页
        Storage.set(TAB_KEY, v)
      }}
    >
      {/* ① 开门 —— iOS 27 Liquid Glass */}
      <Tab title="开门" systemImage="door.left.hand.open">
        <NavigationStack>
          <ZStack
            toast={{
              message: toastMsg,
              isPresented: toastVisible,
              duration: 2.5,
              position: "bottom",
            }}
          >
            {/* 主内容：垂直居中 */}
            <VStack spacing={0}>
              <Spacer />

              {/* 按钮 + 门禁信息，间距 28pt */}
              <VStack spacing={28}>
                <Button action={onOpen} buttonStyle="plain">
                  <ZStack>
                    <Circle
                      frame={{ width: 156, height: 156 }}
                      glassEffect={UIGlass.regular().interactive().tint("rgba(92,143,188,0.85)")}
                    />
                    <Image
                      systemName={busy ? "hourglass" : "key.fill"}
                      font="largeTitle"
                      foregroundStyle="white"
                    />
                  </ZStack>
                </Button>

                <VStack spacing={6}>
                  <Text font="headline">
                    {selectedDoor?.doorControlName ?? "未选择门禁"}
                  </Text>
                  <Text font="caption" foregroundStyle="tertiaryLabel">
                    {selectedDoor
                      ? `${selectedDoor.doorControlId} · ${selectedDoor.hasBluetoothModule !== false ? "蓝牙优先" : "远程"}`
                      : ""}
                  </Text>
                </VStack>
              </VStack>

              <Spacer />
            </VStack>

            {/* 底部控件 */}
            <VStack alignment="center" spacing={12}>
              <Spacer />
              <HStack spacing={32}>
                {arrangedDoors.length > 0 ? (
                  <Menu
                    title={selectedDoor?.doorControlName ?? "选择门禁"}
                    systemImage="chevron.up.chevron.down"
                    buttonStyle="glass"
                    controlSize="small"
                    frame={{ height: 28 }}
                  >
                    {arrangedDoors.map(d => (
                      <Button
                        key={d.doorControlId}
                        title={`${prefs.favorites.includes(d.doorControlId) ? "★ " : ""}${d.doorControlName}${d.online === "offline" ? "（离线）" : ""}`}
                        action={() => {
                          setSelectedDoorId(d.doorControlId)
                          Storage.set("ql_selected_door", d.doorControlId)
                        }}
                      />
                    ))}
                  </Menu>
                ) : (
                  <Text foregroundStyle="secondaryLabel" font="subheadline">
                    {loadingDoors ? "同步中…" : "暂无门禁"}
                  </Text>
                )}
                <Button
                  title={loadingDoors ? "…" : "刷新"}
                  systemImage="arrow.clockwise"
                  buttonStyle="glass"
                  controlSize="small"
                  frame={{ height: 28 }}
                  action={refreshDoors}
                />
              </HStack>
              <Text font="caption2" foregroundStyle="tertiaryLabel">
                {loadingDoors ? "正在同步门禁…" : "点按开门按钮执行"}
              </Text>
            </VStack>
          </ZStack>
        </NavigationStack>
      </Tab>

      {/* ② 门禁 —— 排序 + 收藏，小组件按这个顺序依次展示 */}
      <Tab title="门禁" systemImage="list.bullet">
        <DoorListTab
          doors={doors}
          loading={loadingDoors}
          selectedDoorId={selectedDoor?.doorControlId ?? ""}
          onSync={() => refreshDoors()}
          onRefreshWidget={reloadWidgets}
        />
      </Tab>

      {/* ③ 日志 */}
      <Tab title="日志" systemImage="text.alignleft">
        <NavigationStack>
          <List
            navigationTitle="操作日志"
            navigationBarTitleDisplayMode="large"
            toolbar={{
              topBarTrailing: (
                <HStack spacing={16}>
                  <Button title="复制全部" action={onCopyAllLogs} />
                  <Button title="清空" role="destructive" action={onClearLogs} />
                </HStack>
              ),
            }}
          >
            {logs.length === 0 ? (
              <Text foregroundStyle="secondaryLabel" font="caption">（暂无记录）</Text>
            ) : (
              logs.map((entry, i) => (
                <Button
                  key={`${entry.ts}-${i}`}
                  buttonStyle="plain"
                  action={() => onCopyLine(entry.text)}
                >
                  <HStack alignment="top" spacing={8}>
                    <Text font="caption2" foregroundStyle="tertiaryLabel">
                      {fmtLogTime(entry.ts)}
                    </Text>
                    <Text font="caption" foregroundStyle="secondaryLabel">
                      {entry.text}
                    </Text>
                  </HStack>
                </Button>
              ))
            )}
            {logs.length > 0 ? (
              <Text font="caption2" foregroundStyle="tertiaryLabel">
                共 {logs.length} 条 · 保留 7 天 · 点按任意条目复制
              </Text>
            ) : null}
          </List>
        </NavigationStack>
      </Tab>

      {/* ④ 我的 */}
      <Tab title="我的" systemImage="person.crop.circle">
        <NavigationStack>
          <List
            navigationTitle="我的"
            navigationBarTitleDisplayMode="large"
            toast={{
              message: toastMsg,
              isPresented: toastVisible,
              duration: 2.5,
              position: "bottom",
            }}
          >
            <Section>
              <HStack spacing={10}>
                <Image systemName="checkmark.shield.fill" foregroundStyle="systemGreen" />
                <VStack alignment="leading" spacing={2}>
                  <Text font="headline">{session.phone || "已登录"}</Text>
                  <Text font="caption" foregroundStyle="tertiaryLabel">
                    登录于 {fmtTime(session.loginAt)}
                  </Text>
                </VStack>
                <Spacer />
              </HStack>
              {session.userId ? (
                <HStack>
                  <Text foregroundStyle="secondaryLabel">userId</Text>
                  <Spacer />
                  <Text font="caption">{session.userId}</Text>
                </HStack>
              ) : null}
              <HStack>
                <Text foregroundStyle="secondaryLabel">会话剩余</Text>
                <Spacer />
                <Text font="caption">{remainText(session)}</Text>
              </HStack>
              <HStack>
                <Text foregroundStyle="secondaryLabel">小区 ID</Text>
                <Spacer />
                <Text font="caption">{cfg.communityId || "未配置"}</Text>
              </HStack>
            </Section>

            <Section
              footer={
                <Text font="caption" foregroundStyle="tertiaryLabel">
                  会话 30 分钟有效，到期用 userId 自动续期。
                </Text>
              }
            >
              <Button title="校验会话" action={onCheckLogin} />
              <Button title="登出" role="destructive" action={onLogout} />
            </Section>

            <Section
              header={<SectionTitle icon="waveform.path.ecg" title="数据快照（排查用）" tint="systemTeal" />}
              footer={
                <Text font="caption" foregroundStyle="tertiaryLabel">
                  两边的「门禁」列表理应完全一致。出现"小组件和 App 不一样"时看这三行：
                  小组件时间不更新 → 桌面那个小组件根本没重跑（删掉重加）；
                  版本不是 {BUILD_TAG} → 桌面跑的是旧代码；名称不同 → 两个进程读到的不是同一份数据。
                </Text>
              }
            >
              <HStack>
                <Text>App 读到</Text>
                <Spacer />
                <Text font="caption">{doors.length} 个</Text>
              </HStack>
              <Text font="caption2" foregroundStyle="tertiaryLabel">
                {doors.map(d => d.doorControlName).join(" / ") || "—"}
              </Text>
              <HStack>
                <Text>偏好顺序</Text>
                <Spacer />
                <Text font="caption">{prefs.order.length} 项 · 收藏 {prefs.favorites.length}</Text>
              </HStack>
              {diag ? (
                <>
                  <HStack>
                    <Text>小组件渲染</Text>
                    <Spacer />
                    <Text font="caption">{fmtTime(diag.ts)} · {diag.count} 个</Text>
                  </HStack>
                  <Text font="caption2" foregroundStyle="tertiaryLabel">
                    {diag.names.join(" / ") || "—"}
                  </Text>
                  <HStack>
                    <Text>小组件版本</Text>
                    <Spacer />
                    <Text font="caption" foregroundStyle={diag.version === BUILD_TAG ? "systemGreen" : "systemOrange"}>
                      {diag.version}
                    </Text>
                  </HStack>
                </>
              ) : (
                <Text font="caption" foregroundStyle="secondaryLabel">
                  小组件还没渲染过（没添加过，或一直是旧快照）
                </Text>
              )}
              <Button
                title="重新读取数据"
                systemImage="arrow.triangle.2.circlepath"
                action={() => {
                  setDoors(loadDoors())
                  setDiagTick(t => t + 1)
                }}
              />
            </Section>

            <Section
              header={<SectionTitle icon="square.grid.2x2" title="小组件预览" />}
              footer={
                <Text font="caption" foregroundStyle="tertiaryLabel">
                  应用内预览只是近似效果，实际尺寸、裁剪与点击请以主屏幕上添加的小组件为准。
                </Text>
              }
            >
              <Menu title="选择尺寸预览" systemImage="eye">
                <Button title="小尺寸" action={() => onPreviewWidget("systemSmall")} />
                <Button title="中尺寸" action={() => onPreviewWidget("systemMedium")} />
                <Button title="大尺寸" action={() => onPreviewWidget("systemLarge")} />
                <Button title="超大尺寸" action={() => onPreviewWidget("systemExtraLarge")} />
                <Button title="锁屏矩形" action={() => onPreviewWidget("accessoryRectangular")} />
                <Button title="锁屏圆形" action={() => onPreviewWidget("accessoryCircular")} />
                <Button title="锁屏单行" action={() => onPreviewWidget("accessoryInline")} />
              </Menu>
            </Section>
          </List>
        </NavigationStack>
      </Tab>
    </TabView>
  )
}

/** 启动静默校验 */
async function startupCheck(): Promise<string> {
  const s = loadSession()
  if (!s) return ""
  const cfg = loadConfig()
  const who = s.phone || "未知号码"
  if (!cfg.baseURL) return `已载入会话（${who}），未配置接口地址`
  try {
    const list = await fetchUserDoors({ cfg, session: s })
    return `已载入会话（${who}），有效，${list.length} 个门禁`
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      clearSession()
      return "会话已失效，请重新登录"
    }
    return `已载入会话（${who}），校验失败：${e instanceof Error ? e.message : String(e)}`
  }
}

async function run() {
  const initialLog = await startupCheck()
  await Navigation.present(<App initialLog={initialLog} />)
  Script.exit()
}

run()
