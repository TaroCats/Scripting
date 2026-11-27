import {
  Button,
  HStack,
  Image,
  List,
  Menu,
  Navigation,
  NavigationStack,
  ProgressView,
  Section,
  SecureField,
  Spacer,
  Text,
  TabView,
  TextField,
  VStack,
  useEffect,
  useState,
} from "scripting"

import { aria2ListTasks, aria2Remove, aria2Test } from "./core/aria2"
import { appendInbox, pendingInboxCount, takeInbox } from "./core/bridge"
import {
  cloudreveListTasks,
  cloudreveLogin,
  cloudreveLogout,
  ensureAccessToken,
} from "./core/cloudreve"
import {
  loadAria2Config,
  loadCloudreveConfig,
  loadMode,
  saveAria2Config,
  saveCloudreveDst,
  saveMode,
} from "./core/config"
import {
  errorMessage,
  formatBytes,
  formatSpeed,
  pushJob,
  pushUrlTo,
  tokenStatus,
} from "./core/tasks"
import type { DownloadTask, DownloaderMode } from "./core/types"
import DirectoryPicker from "./directory_picker"

const GREEN = "#4C8C6A"
const DEEP_GREEN = "#2F6B50"
const MUTED = "#6E6E73"

let polling = false

async function pollTasks(
  setTasks: (tasks: DownloadTask[]) => void,
  setNotice: (message: string) => void,
  setPending: (count: number) => void,
  announceInbox: boolean,
): Promise<void> {
  if (polling) return
  polling = true
  try {
    const tasks: DownloadTask[] = []
    const failures: string[] = []
    if (loadAria2Config().rpcUrl) {
      try {
        tasks.push(...(await aria2ListTasks(loadAria2Config())))
      } catch (error) {
        failures.push(`aria2: ${errorMessage(error)}`)
      }
    }
    if (loadCloudreveConfig().token) {
      try {
        tasks.push(...(await cloudreveListTasks()))
      } catch (error) {
        failures.push(`Cloudreve: ${errorMessage(error)}`)
      }
    }
    setTasks(tasks)

    const jobs = takeInbox()
    if (jobs.length > 0) {
      let succeeded = 0
      for (const job of jobs) {
        try {
          await pushJob(job)
          succeeded += 1
        } catch {
          // A single bad link must not block the rest of the queue.
          appendInbox(job)
        }
      }
      if (announceInbox) {
        setNotice(`已处理 Safari 拦截：${succeeded}/${jobs.length} 个任务`)
      }
    }
    if (announceInbox && failures.length > 0) {
      setNotice(`部分渠道刷新失败：${failures.join("；")}`)
    }
    setPending(pendingInboxCount())
  } catch (error) {
    if (announceInbox) setNotice(`刷新失败：${errorMessage(error)}`)
  } finally {
    polling = false
  }
}

function statusLabel(status: string): string {
  const lower = status.toLowerCase()
  if (lower === "active" || lower === "downloading" || lower === "processing") return "下载中"
  if (lower === "waiting" || lower === "queued") return "排队中"
  if (lower === "paused") return "已暂停"
  if (lower === "complete" || lower === "completed" || lower === "seeding") return "已完成"
  if (lower === "error" || lower === "failed") return "出错"
  return status || "未知状态"
}

function phaseLabel(phase: string | undefined, status: string): string {
  const value = (phase || "").toLowerCase()
  if (value === "finish" || status.toLowerCase() === "completed") return "已完成"
  if (
    value === "upload" ||
    value === "uploading" ||
    value === "import" ||
    value === "importing" ||
    value === "transfer" ||
    value === "transferring" ||
    value === "save" ||
    value === "saving"
  ) {
    return "转存中"
  }
  if (value === "monitor" || value === "download" || value === "downloading") return "下载中"
  if (value === "seeding") return "做种中"
  return statusLabel(status)
}

function TaskRow({ task, onRemove }: { task: DownloadTask; onRemove: () => void }) {
  const stateText =
    task.source === "cloudreve" ? phaseLabel(task.phase, task.status) : statusLabel(task.status)
  const stateColor = stateText === "转存中" ? "#C47F17" : DEEP_GREEN

  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={12}
      background={{ light: "#E9F2EC", dark: "#22362B" }}
      clipShape={{ type: "rect", cornerRadius: 16 }}
    >
      <HStack spacing={8}>
        <Image
          systemName={task.source === "aria2" ? "arrow.down.to.line" : "icloud.and.arrow.down"}
          font={16}
          foregroundStyle={DEEP_GREEN}
        />
        <Text font={14} fontWeight="semibold" lineLimit={1}>
          {task.name}
        </Text>
        <Spacer />
        <Text font={12} monospacedDigit foregroundStyle={MUTED}>
          {Math.round(task.progress * 100)}%
        </Text>
      </HStack>
      <ProgressView value={task.progress} total={1} progressViewStyle="linear" />
      <HStack spacing={8}>
        <Text font={11} foregroundStyle={MUTED}>
          {formatBytes(task.downloaded)} / {formatBytes(task.total)}
        </Text>
        <Spacer />
        <Text font={11} monospacedDigit foregroundStyle={MUTED}>
          {formatSpeed(task.speed)}
        </Text>
        <Text font={11} foregroundStyle={stateColor}>
          {stateText}
        </Text>
        {task.source === "aria2" ? (
          <Button title="移除" buttonStyle="glass" action={onRemove} />
        ) : null}
      </HStack>
    </VStack>
  )
}

export default function App() {
  const dismiss = Navigation.useDismiss()

  const initialAria2 = loadAria2Config()
  const initialCloud = loadCloudreveConfig()
  const lastMode = loadMode()
  const [rpcUrl, setRpcUrl] = useState(initialAria2.rpcUrl)
  const [secret, setSecret] = useState(initialAria2.secret)
  const [baseUrl, setBaseUrl] = useState(initialCloud.baseUrl)
  const [email, setEmail] = useState(initialCloud.email)
  const [password, setPassword] = useState("")
  const [dst, setDst] = useState(initialCloud.dst)
  const [url, setUrl] = useState("")
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [notice, setNotice] = useState("准备就绪")
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tokenText, setTokenText] = useState(tokenStatus(initialCloud.token))
  const [channelSheet, setChannelSheet] = useState(false)
  const [countdown, setCountdown] = useState(2)
  const [pendingUrl, setPendingUrl] = useState("")
  const [destSheet, setDestSheet] = useState(false)
  const [treeSheet, setTreeSheet] = useState(false)
  const [treePurpose, setTreePurpose] = useState<"settings" | "push">("settings")

  useEffect(() => {
    const refresh = () => {
      void pollTasks(setTasks, setNotice, setPending, false)
    }
    refresh()
    const progressTimer = setInterval(refresh, 1500)

    const tokenTimer = setInterval(() => {
      if (!loadCloudreveConfig().token) return
      void ensureAccessToken()
        .then(() => setTokenText(tokenStatus(loadCloudreveConfig().token)))
        .catch(error => setTokenText(`刷新失败：${errorMessage(error)}`))
    }, 30000)

    return () => {
      clearInterval(progressTimer)
      clearInterval(tokenTimer)
    }
  }, [])

  const connectAria2 = async () => {
    setBusy(true)
    setNotice("正在连接 aria2…")
    try {
      const config = { rpcUrl, secret }
      await aria2Test(config)
      saveAria2Config(config)
      setNotice("aria2 连接成功，下次推送可选该渠道")
    } catch (error) {
      setNotice(`aria2 连接失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const loginCloudreve = async () => {
    setBusy(true)
    setNotice("正在登录 Cloudreve v4…")
    try {
      await cloudreveLogin(baseUrl, email, password, dst)
      setPassword("")
      setTokenText(tokenStatus(loadCloudreveConfig().token))
      setNotice("Cloudreve 登录成功，下次推送可选该渠道")
    } catch (error) {
      setNotice(`Cloudreve 登录失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const logoutCloudreve = async () => {
    await cloudreveLogout()
    setTokenText(tokenStatus(null))
    setNotice("Cloudreve 已退出登录")
  }

  const performPush = async (
    mode: DownloaderMode,
    raw: string,
    destination?: string,
  ) => {
    setChannelSheet(false)
    if (!raw.trim()) return
    if (mode === "cloudreve" && !destination) {
      setPendingUrl(raw)
      setDestSheet(true)
      return
    }
    // Remember the choice so Safari-intercepted links use the same channel.
    saveMode(mode)
    setBusy(true)
    try {
      setNotice(await pushUrlTo(raw, mode, destination))
      setUrl("")
      await pollTasks(setTasks, setNotice, setPending, false)
    } catch (error) {
      setNotice(`推送失败：${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const requestPush = () => {
    if (!url.trim()) {
      setNotice("请先输入下载链接")
      return
    }
    setPendingUrl(url)
    setCountdown(2)
    setChannelSheet(true)
  }

  const chooseDefaultDest = () => {
    setDestSheet(false)
    void performPush("cloudreve", pendingUrl, "cloudreve://my")
  }

  const chooseCustomDest = () => {
    setDestSheet(false)
    setTreePurpose("push")
    setTreeSheet(true)
  }

  const selectTreePath = (path: string) => {
    if (treePurpose === "settings") {
      saveCloudreveDst(path)
      setDst(path)
      setNotice(`已设置保存目录：${path}`)
    } else {
      void performPush("cloudreve", pendingUrl, path)
    }
  }

  useEffect(() => {
    if (!channelSheet) return
    if (countdown <= 0) {
      void performPush("aria2", pendingUrl)
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [channelSheet, countdown, pendingUrl])

  const removeTask = async (task: DownloadTask) => {
    try {
      await aria2Remove(loadAria2Config(), task.id)
      setNotice("已从 aria2 移除任务")
      await pollTasks(setTasks, setNotice, setPending, false)
    } catch (error) {
      setNotice(`移除失败：${errorMessage(error)}`)
    }
  }

  const ariaTasks = tasks.filter(task => task.source === "aria2")
  const cloudTasks = tasks.filter(task => task.source === "cloudreve")

  return (
    <NavigationStack
      sheet={{
        isPresented: treeSheet,
        onChanged: setTreeSheet,
        content: (
          <DirectoryPicker
            isPresented={treeSheet}
            onChanged={setTreeSheet}
            initialPath={treePurpose === "settings" ? dst : loadCloudreveConfig().dst}
            onSelect={selectTreePath}
          />
        ),
      }}
    >
      <TabView tint={DEEP_GREEN}>
        <List
          navigationTitle="推送"
          navigationBarTitleDisplayMode="inline"
          toolbar={{ cancellationAction: <Button title="关闭" action={dismiss} /> }}
          tabItem={
            <VStack spacing={2}>
              <Image systemName="bolt.fill" />
              <Text font={10}>推送</Text>
            </VStack>
          }
          confirmationDialog={{
            title: "选择下载渠道",
            message: (
              <Text font={13}>
                {countdown > 0 ? `${countdown} 秒后默认使用 aria2` : "正在推送…"}
              </Text>
            ),
            isPresented: channelSheet,
            onChanged: setChannelSheet,
            actions: (
              <VStack spacing={6}>
                <Button title="aria2" action={() => void performPush("aria2", pendingUrl)} />
                <Button title="Cloudreve v4" action={() => void performPush("cloudreve", pendingUrl)} />
                <Button title="取消" action={() => setChannelSheet(false)} />
              </VStack>
            ),
          }}
        >
          <Section>
            <HStack
              spacing={12}
              padding={14}
              foregroundStyle={{ light: "#1C1C1E", dark: "#F2F7F4" }}
              background={{ light: "#E9F2EC", dark: "#22362B" }}
              clipShape={{ type: "rect", cornerRadius: 22 }}
            >
              <Image systemName="externaldrive.fill" font={34} foregroundStyle="#4C8C6A" />
              <VStack alignment="leading" spacing={2}>
                <Text font={22} fontWeight="bold">
                  MergeDL
                </Text>
                <Text font={12} foregroundStyle={{ light: "#3A3A3C", dark: "#A8C4B4" }}>
                  aria2 · Cloudreve v4 · Safari 拦截
                </Text>
              </VStack>
              <Spacer />
              <Image systemName="bolt.fill" font={20} foregroundStyle="#4C8C6A" />
            </HStack>
          </Section>

          <Section
            title="下载渠道与链接"
            confirmationDialog={{
              title: "选择保存目录",
              message: <Text font={13}>Cloudreve 离线下载目标目录</Text>,
              isPresented: destSheet,
              onChanged: setDestSheet,
              actions: (
                <VStack spacing={6}>
                  <Button title="默认目录" action={chooseDefaultDest} />
                  <Button title="自定义目录…" action={chooseCustomDest} />
                  <Button title="取消" action={() => setDestSheet(false)} />
                </VStack>
              ),
            }}
          >
            <Text font={12} foregroundStyle={MUTED}>
              {`上次渠道：${lastMode === "aria2" ? "aria2" : "Cloudreve v4"} · Safari 拦截任务使用该渠道`}
            </Text>
            <TextField title="下载链接" value={url} onChanged={setUrl} prompt="http(s) 或 magnet 链接" autocorrectionDisabled keyboardType="URL" onSubmit={requestPush} />
            <Button title={busy ? "处理中…" : "推送"} buttonStyle="glass" tint={DEEP_GREEN} action={requestPush} disabled={busy} />
            <Text font={12} foregroundStyle={MUTED}>
              {notice}
            </Text>
          </Section>

          <Section title="Safari 拦截">
            <Text font={12} foregroundStyle={MUTED}>
              在 Safari 中启用 MergeDL 浏览器脚本，点击文件下载链接会被拦截并加入队列；打开本页面后自动推送。
            </Text>
            <Text font={12} foregroundStyle={DEEP_GREEN}>
              待推送：{pending} 个
            </Text>
          </Section>
        </List>

        <List
          navigationTitle="任务"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
            topBarTrailing: (
              <Button
                title="刷新"
                action={() => {
                  void pollTasks(setTasks, setNotice, setPending, true)
                }}
              />
            ),
          }}
          tabItem={
            <VStack spacing={2}>
              <Image systemName="list.bullet.clipboard" />
              <Text font={10}>任务</Text>
            </VStack>
          }
        >
          <Section title="aria2 任务">
            {ariaTasks.length === 0 ? (
              <Text font={13} foregroundStyle={MUTED}>
                暂无 aria2 任务，每 1.5 秒自动刷新
              </Text>
            ) : (
              ariaTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRemove={() => void removeTask(task)}
                />
              ))
            )}
          </Section>

          <Section title="Cloudreve v4 任务">
            {cloudTasks.length === 0 ? (
              <Text font={13} foregroundStyle={MUTED}>
                暂无 Cloudreve 任务，每 1.5 秒自动刷新
              </Text>
            ) : (
              cloudTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRemove={() => void removeTask(task)}
                />
              ))
            )}
          </Section>
        </List>

        <List
          navigationTitle="设置"
          navigationBarTitleDisplayMode="inline"
          toolbar={{ cancellationAction: <Button title="关闭" action={dismiss} /> }}
          tabItem={
            <VStack spacing={2}>
              <Image systemName="gearshape" />
              <Text font={10}>设置</Text>
            </VStack>
          }
        >
          <Section title="aria2 连接">
            <TextField title="RPC 地址" value={rpcUrl} onChanged={setRpcUrl} prompt="https://host/jsonrpc" autocorrectionDisabled keyboardType="URL" />
            <SecureField title="RPC 密钥" value={secret} onChanged={setSecret} prompt="aria2 rpc-secret" />
            <Button title={busy ? "处理中…" : "测试并保存连接"} buttonStyle="glass" action={() => void connectAria2()} disabled={busy} />
            <Text font={12} foregroundStyle={MUTED}>
              {notice}
            </Text>
          </Section>

          <Section title="Cloudreve v4 登录">
            <TextField title="站点地址" value={baseUrl} onChanged={setBaseUrl} prompt="https://pan.example.com" autocorrectionDisabled keyboardType="URL" />
            <TextField title="邮箱" value={email} onChanged={setEmail} prompt="user@example.com" autocorrectionDisabled keyboardType="emailAddress" textContentType="emailAddress" />
            <SecureField title="密码" value={password} onChanged={setPassword} prompt="登录密码" />
            <Menu
              title="保存目录"
              systemImage="folder"
              primaryAction={() => {
                setTreePurpose("settings")
                setTreeSheet(true)
              }}
            >
              <Text font={12} foregroundStyle={MUTED} lineLimit={1}>
                当前：{dst}
              </Text>
              <Button
                title="从目录树选择…"
                action={() => {
                  setTreePurpose("settings")
                  setTreeSheet(true)
                }}
              />
            </Menu>
            <HStack spacing={10}>
              <Button title={busy ? "处理中…" : "登录"} buttonStyle="glass" tint={DEEP_GREEN} action={() => void loginCloudreve()} disabled={busy} />
              <Button title="退出" buttonStyle="glass" action={() => void logoutCloudreve()} />
            </HStack>
            <Text font={12} foregroundStyle={MUTED}>
              {tokenText}
            </Text>
          </Section>
        </List>
      </TabView>
    </NavigationStack>
  )
}
