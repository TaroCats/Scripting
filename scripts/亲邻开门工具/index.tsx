import {
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
  useMemo,
  useObservable,
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
  DEFAULT_BLE_SETTINGS,
  DEFAULT_CONFIG,
  K,
  type ApiConfig,
  type BleSettings,
  type DoorKey,
} from "./core/protocol"
import {
  arrangeDoors,
  loadDoorPrefs,
  moveWithin,
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

function App(props: { initialLog: string }) {
  const [cfg, setCfg] = useState<ApiConfig>(loadConfig())
  const [ble, setBle] = useState<BleSettings>(loadBle())
  const [session, setSession] = useState<Session | null>(loadSession())
  const [doors, setDoors] = useState<DoorKey[]>(loadDoors())
  const [prefs, setPrefs] = useState<DoorPrefs>(loadDoorPrefs())
  /** 展示用顺序：收藏在前，组内按用户拖动的顺序 */
  const arrangedDoors = useMemo(() => arrangeDoors(doors, prefs), [doors, prefs])
  const [selectedDoorId, setSelectedDoorId] = useState<string>(
    (Storage.get<string>("ql_selected_door") as string) ?? ""
  )
  const [phone, setPhone] = useState<string>((Storage.get<string>(K.phone) as string) ?? "")
  const [code, setCode] = useState("")
  const [manualSid, setManualSid] = useState("")
  const [tab, setTab] = useState(0)
  const [userId, setUserId] = useState<string>((Storage.get<string>("ql_user_id") as string) ?? "")
  const [communityId, setCommunityId] = useState<string>(cfg.communityId ?? "")
  const [busy, setBusy] = useState(false)
  const [loadingDoors, setLoadingDoors] = useState(false)
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
    setPrefs(np)
    saveDoorPrefs(np)
    const first = arrangeDoors(next, np)[0]
    if (first && !next.some(d => d.doorControlId === selectedDoorId)) {
      setSelectedDoorId(first.doorControlId)
      Storage.set("ql_selected_door", first.doorControlId)
    }
  }

  function commitPrefs(next: DoorPrefs) {
    setPrefs(next)
    saveDoorPrefs(next)
    // 排序/收藏是小组件的直接输入，改完立刻刷一次时间线
    try { Widget.reloadAll() } catch { /* 预览等场景下不可用，忽略 */ }
  }

  function onToggleFavorite(doorControlId: string) {
    const ids = arrangedDoors.map(d => d.doorControlId)
    commitPrefs(toggleFavorite(prefs, ids, doorControlId))
  }

  function onReorder(segment: "fav" | "other", indices: number[], newOffset: number) {
    const favSet = new Set(prefs.favorites)
    const favs = arrangedDoors.filter(d => favSet.has(d.doorControlId))
    const others = arrangedDoors.filter(d => !favSet.has(d.doorControlId))
    const nextFavs = segment === "fav" ? moveWithin(favs, indices, newOffset) : favs
    const nextOthers = segment === "other" ? moveWithin(others, indices, newOffset) : others
    commitPrefs({
      order: [...nextFavs, ...nextOthers].map(d => d.doorControlId),
      favorites: prefs.favorites,
    })
  }

  function onResetOrder() {
    const ids = doors.map(d => d.doorControlId)
    commitPrefs({ order: ids, favorites: prefs.favorites })
    say("已按服务端顺序重排（收藏保留）")
  }

  const favDoors = useMemo(
    () => arrangedDoors.filter(d => prefs.favorites.includes(d.doorControlId)),
    [arrangedDoors, prefs]
  )
  const otherDoors = useMemo(
    () => arrangedDoors.filter(d => !prefs.favorites.includes(d.doorControlId)),
    [arrangedDoors, prefs]
  )

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

  /** 门禁列表行：左侧 ☆/★ 切换收藏，右侧显示在线状态与当前选中项 */
  function doorRow(d: DoorKey) {
    const fav = prefs.favorites.includes(d.doorControlId)
    const isSelected = selectedDoor?.doorControlId === d.doorControlId
    return (
      <HStack key={d.doorControlId} spacing={10}>
        <Button buttonStyle="plain" action={() => onToggleFavorite(d.doorControlId)}>
          <Image
            systemName={fav ? "star.fill" : "star"}
            font="body"
            foregroundStyle={fav ? "systemYellow" : "tertiaryLabel"}
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
        {isSelected ? (
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
      onTabIndexChanged={setTab}
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
        <NavigationStack>
          <List
            navigationTitle="门禁列表"
            navigationBarTitleDisplayMode="large"
            toast={{
              message: toastMsg,
              isPresented: toastVisible,
              duration: 2.5,
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
                  {favDoors.length > 0
                    ? `收藏 ${favDoors.length} 项，按顺序排在最前；小尺寸小组件显示第一项。`
                    : "点左侧 ☆ 收藏常用门禁，收藏后自动置顶，并优先出现在小组件里。"}
                </Text>
              }
            >
              {favDoors.length > 0 ? (
                <ForEach
                  count={favDoors.length}
                  itemBuilder={i => doorRow(favDoors[i])}
                  onMove={(indices, newOffset) => onReorder("fav", indices, newOffset)}
                />
              ) : (
                <Text font="caption" foregroundStyle="secondaryLabel">（暂无收藏）</Text>
              )}
            </Section>

            <Section
              header={<SectionTitle icon="door.left.hand.open" title="其他门禁" />}
              footer={
                <Text font="caption" foregroundStyle="tertiaryLabel">
                  点右上角「编辑」后拖动排序。顺序与收藏只存在本机，同步门禁不会覆盖；新增的门禁会追加到本组末尾。
                </Text>
              }
            >
              {otherDoors.length > 0 ? (
                <ForEach
                  count={otherDoors.length}
                  itemBuilder={i => doorRow(otherDoors[i])}
                  onMove={(indices, newOffset) => onReorder("other", indices, newOffset)}
                />
              ) : (
                <Text font="caption" foregroundStyle="secondaryLabel">
                  {arrangedDoors.length > 0 ? "（全部门禁都已收藏）" : "（暂无门禁，先同步一次）"}
                </Text>
              )}
            </Section>

            <Section footer={
              <Text font="caption" foregroundStyle="tertiaryLabel">
                小组件（中/大尺寸）按「收藏 → 其他」的顺序依次展示；小尺寸与锁屏显示列表第一项。
              </Text>
            }>
              <Button
                title={loadingDoors ? "同步中…" : "同步门禁列表"}
                systemImage="arrow.clockwise"
                action={refreshDoors}
              />
              <Button title="恢复默认顺序" role="destructive" action={onResetOrder} />
            </Section>
          </List>
        </NavigationStack>
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
