import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  useState,
} from "scripting"
import { checkLogin, loginByCode, logout, sendValidCode, SessionExpiredError } from "./core/api"
import { openDoor } from "./core/opendoor"
import {
  DEFAULT_BLE_SETTINGS,
  DEFAULT_CONFIG,
  HOST_PROD,
  HOST_TEST,
  K,
  type ApiConfig,
  type BleSettings,
  type DoorKey,
} from "./core/protocol"
import { clearSession, loadSession, saveSession, type Session } from "./core/session"

function loadConfig(): ApiConfig {
  return (Storage.get<ApiConfig>(K.config) as ApiConfig) ?? DEFAULT_CONFIG
}

function loadBle(): BleSettings {
  return (Storage.get<BleSettings>(K.ble) as BleSettings) ?? DEFAULT_BLE_SETTINGS
}

function loadDoors(): DoorKey[] {
  return (Storage.get<DoorKey[]>(K.doors) as DoorKey[]) ?? []
}

function App(props: { initialLog: string }) {
  const [cfg, setCfg] = useState<ApiConfig>(loadConfig())
  const [ble, setBle] = useState<BleSettings>(loadBle())
  const [session, setSession] = useState<Session | null>(loadSession())
  const [doors, setDoors] = useState<DoorKey[]>(loadDoors())
  const [phone, setPhone] = useState<string>((Storage.get<string>(K.phone) as string) ?? "")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState(props.initialLog)

  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")

  const say = (line: string) => {
    const stamp = new Date().toLocaleTimeString()
    setLogs(`${stamp}  ${line}\n${logs}`.split("\n").slice(0, 10).join("\n"))
  }

  function persistCfg(next: ApiConfig) {
    setCfg(next)
    Storage.set(K.config, next)
  }

  function persistBle(next: BleSettings) {
    setBle(next)
    Storage.set(K.ble, next)
  }

  function persistDoors(next: DoorKey[]) {
    setDoors(next)
    Storage.set(K.doors, next)
  }

  /** 手机号校验：对齐原 App buildBtn 的 11 位判断 */
  function phoneValid(): boolean {
    return /^1\d{10}$/.test(phone)
  }

  async function onSendCode() {
    if (busy) return
    if (!phoneValid()) {
      say("请输入11位的手机号")
      return
    }
    setBusy(true)
    try {
      const env = await sendValidCode(phone, { cfg })
      say(`验证码已发送（${env.code || "ok"}）`)
    } catch (e) {
      say(`发送失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onLogin() {
    if (busy) return
    if (!phoneValid()) {
      say("请输入11位的手机号")
      return
    }
    if (code.trim().length < 4) {
      say("验证码有误，请重新输入")
      return
    }
    setBusy(true)
    try {
      const env = await loginByCode(phone, code.trim(), { cfg })
      const data = env.data ?? {}
      const token = String(data.token ?? data.accessToken ?? "")
      if (!token) {
        say("登录返回里没有 token —— 响应外壳与预期不符，看协议配置区说明")
        return
      }
      const s = saveSession({ token, sessionId: String(data.sessionId ?? ""), phone })
      setSession(s)
      setCode("")
      say("登录成功，会话已写入 Keychain（重启后不用重新登录）")
    } catch (e) {
      say(`登录失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onLogout() {
    if (busy) return
    setBusy(true)
    try {
      await logout({ cfg, session })
    } catch {
      // 服务端登出失败不影响本地清理
    } finally {
      clearSession()
      setSession(null)
      setBusy(false)
      say("已登出")
    }
  }

  async function onCheckLogin() {
    if (busy) return
    if (!session) {
      say("当前没有会话")
      return
    }
    setBusy(true)
    try {
      const env = await checkLogin({ cfg, session })
      say(`会话有效（${env.code || "ok"}）`)
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession()
        setSession(null)
        say("服务端判定会话失效，请重新登录")
      } else {
        say(`检查失败（不代表失效）：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function onOpen(key: DoorKey) {
    if (busy) return
    if (!session) {
      say("未登录，无法开门")
      return
    }
    setBusy(true)
    try {
      const r = await openDoor(key, { cfg, session }, ble, {
        onStep: (stage, detail) => say(`· ${stage}${detail ? ` ${detail}` : ""}`),
      })
      say(`${r.ok ? "✅" : "❌"} ${r.message}`)
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession()
        setSession(null)
        say("会话失效，已强制登出（原 App 同款行为）")
      } else {
        say(`开门异常：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="亲邻开门工具"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarTrailing: session ? <Button title="登出" action={onLogout} /> : undefined,
        }}
      >
        <Section
          header={<Text>账号</Text>}
          footer={
            <Text>
              会话存在 Keychain（first_unlock_this_device），重启后仍在。是否过期只取决于服务端
              token 生命周期，客户端不主动清。
            </Text>
          }
        >
          {session ? (
            <>
              <HStack>
                <Text>已登录</Text>
                <Spacer />
                <Text foregroundStyle="secondaryLabel">{session.phone || "—"}</Text>
              </HStack>
              <Button title={busy ? "检查中…" : "校验会话"} action={onCheckLogin} />
            </>
          ) : (
            <>
              <TextField title="手机号" value={phone} onChanged={setPhone} prompt="11 位手机号" />
              <HStack>
                <TextField title="验证码" value={code} onChanged={setCode} prompt="短信验证码" />
                <Button title="获取" action={onSendCode} />
              </HStack>
              <Button title={busy ? "登录中…" : "登录"} action={onLogin} />
            </>
          )}
        </Section>

        <Section
          header={<Text>门禁</Text>}
          footer={
            <Text>
              远程失败会自动尝试蓝牙（原 App 同款顺序）。蓝牙需要填下面的 UUID 与载荷模板，
              留空则只走远程。
            </Text>
          }
        >
          {doors.length === 0 ? (
            <Text foregroundStyle="secondaryLabel">尚未添加门禁，请录入 doorControlId</Text>
          ) : (
            doors.map((d, i) => (
              <HStack key={`${d.doorControlId}-${i}`}>
                <Button
                  title={`开门 · ${d.doorControlName || d.doorControlId}`}
                  action={() => onOpen(d)}
                />
                <Spacer />
                <Button
                  title="移除"
                  action={() => persistDoors(doors.filter((_, idx) => idx !== i))}
                />
              </HStack>
            ))
          )}
          <TextField title="doorControlId" value={newId} onChanged={setNewId} prompt="门禁点 ID" />
          <TextField title="名称" value={newName} onChanged={setNewName} prompt="可选" />
          <Button
            title="添加到列表"
            action={() => {
              if (!newId.trim()) {
                say("doorControlId 不能为空")
                return
              }
              persistDoors([
                ...doors,
                { doorControlId: newId.trim(), doorControlName: newName.trim() },
              ])
              setNewId("")
              setNewName("")
              say("已添加")
            }}
          />
        </Section>

        <Section
          header={<Text>蓝牙（可选）</Text>}
          footer={
            <Text>
              serviceUUID / writeCharUUID / 载荷格式在原 App 里不是硬编码，由服务端下发或本地拼装，
              必须靠抓包或 HCI 日志确认。填错只会连不上或写入无响应。
            </Text>
          }
        >
          <TextField
            title="serviceUUID"
            value={ble.serviceUUID}
            onChanged={v => persistBle({ ...ble, serviceUUID: v })}
            prompt="如 0000fee0-0000-1000-8000-00805f9b34fb"
          />
          <TextField
            title="writeCharUUID"
            value={ble.writeCharUUID}
            onChanged={v => persistBle({ ...ble, writeCharUUID: v })}
          />
          <TextField
            title="notifyCharUUID"
            value={ble.notifyCharUUID}
            onChanged={v => persistBle({ ...ble, notifyCharUUID: v })}
            prompt="可选，填了就等回执"
          />
          <TextField
            title="设备名过滤"
            value={ble.matchName}
            onChanged={v => persistBle({ ...ble, matchName: v })}
            prompt="可选"
          />
          <TextField
            title="载荷模板"
            value={ble.payloadTemplate}
            onChanged={v => persistBle({ ...ble, payloadTemplate: v })}
            prompt="支持 {doorControlId} {sessionId} {timestamp}"
            axis="vertical"
          />
          <Toggle
            title="载荷按 hex 解析"
            value={ble.payloadEncoding === "hex"}
            onChanged={v => persistBle({ ...ble, payloadEncoding: v ? "hex" : "text" })}
          />
        </Section>

        <Section
          header={<Text>协议配置</Text>}
          footer={
            <Text>
              域名已从 libapp.so 取出（ServiceDomain.qapp，生产/测试各一个），默认就是生产。
              还剩 appId / appSecret / AES 密钥需要你补。
            </Text>
          }
        >
          <HStack>
            <Button title="用生产域名" action={() => persistCfg({ ...cfg, baseURL: HOST_PROD })} />
            <Button title="用测试域名" action={() => persistCfg({ ...cfg, baseURL: HOST_TEST })} />
          </HStack>
          <TextField
            title="baseURL"
            value={cfg.baseURL}
            onChanged={v => persistCfg({ ...cfg, baseURL: v })}
            prompt="https://qapp.qinlinkeji.com"
          />
          <TextField
            title="appId"
            value={cfg.appId}
            onChanged={v => persistCfg({ ...cfg, appId: v })}
          />
          <TextField
            title="appSecret"
            value={cfg.appSecret}
            onChanged={v => persistCfg({ ...cfg, appSecret: v })}
            prompt="签名盐值"
          />
          <TextField
            title="AES 密钥(hex)"
            value={cfg.aesKeyHex}
            onChanged={v => persistCfg({ ...cfg, aesKeyHex: v })}
            prompt="32 位十六进制"
          />
          <Toggle
            title="请求体 AES-128-ECB 加密"
            value={cfg.encryptBody}
            onChanged={v => persistCfg({ ...cfg, encryptBody: v })}
          />
          <Toggle
            title="使用 MD5 签名"
            value={cfg.signMode === "md5"}
            onChanged={v => persistCfg({ ...cfg, signMode: v ? "md5" : "none" })}
          />
        </Section>

        <Section header={<Text>日志</Text>}>
          <VStack alignment="leading" spacing={4}>
            <Text font="caption" foregroundStyle="secondaryLabel">{logs || "（空）"}</Text>
          </VStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

/** 启动时静默校验：有会话就先用，只有服务端明确失效才要求重登 */
async function startupCheck(): Promise<string> {
  const s = loadSession()
  if (!s) return "未登录"
  const cfg = loadConfig()
  const who = s.phone || "未知号码"
  if (!cfg.baseURL) return `已载入本地会话（${who}），未配置 baseURL，跳过校验`
  try {
    await checkLogin({ cfg, session: s })
    return `已载入本地会话（${who}），服务端校验通过`
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      clearSession()
      return "本地会话已被服务端判定失效，请重新登录"
    }
    return `已载入本地会话（${who}），校验失败但未清除：${
      e instanceof Error ? e.message : String(e)
    }`
  }
}

async function run() {
  const initialLog = await startupCheck()
  await Navigation.present(<App initialLog={initialLog} />)
  Script.exit()
}

run()
