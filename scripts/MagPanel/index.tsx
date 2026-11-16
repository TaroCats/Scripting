/**
 * MagPanel 主界面：配置 magpie 网关地址 / key，选小组件显示什么，并现场验证。
 *
 * 生命周期：一次性页面 —— Navigation.present 后等待关闭，再 Script.exit()。
 * 配置一改动就落盘（App Group 文件 + Storage 兜底），不需要"保存"按钮。
 */
import {
  Button,
  HStack,
  Image,
  List,
  Menu,
  Navigation,
  NavigationStack,
  Script,
  SecureField,
  Section,
  Spacer,
  Stepper,
  SVG,
  Text,
  TextField,
  Toggle,
  VStack,
  Widget,
  useEffect,
  useState,
  type WidgetFamily,
  type KeywordsColor,
} from "scripting"
import { APP_TIMEOUT_MS, displayHost, isLoopback, probeConfig, PanelRequestError } from "./core/api"
import { fmtAgo, fmtClock, fmtPct, quotaColor } from "./core/format"
import { BUILTIN_ICON_COUNT, GENERIC_ICON, MAGPIE_ICON, resolveIcon } from "./core/icons"
import { cachedIconPath, iconBaseOf, iconFileNameOf } from "./core/icon_cache"
import { buildSnapshot } from "./core/panel"
import { ProviderIconView, svgWithSize } from "./widgets/icon_view"
import { clearSnapshot, loadConfig, normalizeConfig, readSnapshot, reloadWidgets, saveConfig, writeSnapshot } from "./core/store"
import type { PanelConfig, PanelSnapshot } from "./core/types"

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <HStack spacing={6}>
      <Image systemName={icon} font="caption" foregroundStyle="secondaryLabel" />
      <Text font="caption" foregroundStyle="secondaryLabel">
        {title}
      </Text>
    </HStack>
  )
}

function Hint({ children }: { children: string }) {
  return (
    <Text font="caption" foregroundStyle="tertiaryLabel">
      {children}
    </Text>
  )
}

/** 解析出来的图标：本地缓存 / 内联 SVG / 网络图 / magpie 的 generic 占位 */
function IconSample(props: { icon?: string; iconPath?: string; provider?: string; name?: string; size?: number }) {
  return (
    <ProviderIconView
      icon={props.icon}
      iconPath={props.iconPath}
      provider={props.provider}
      name={props.name}
      size={props.size ?? 18}
    />
  )
}

function Row(props: { label: string; value: string; tint?: KeywordsColor }) {
  return (
    <HStack>
      <Text>{props.label}</Text>
      <Spacer />
      <Text font="caption" foregroundStyle={props.tint ?? "secondaryLabel"} lineLimit={2}>
        {props.value}
      </Text>
    </HStack>
  )
}

function App() {
  const [cfg, setCfg] = useState<PanelConfig>(() => loadConfig())
  const [snapshot, setSnapshot] = useState<PanelSnapshot | null>(() => readSnapshot())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    // 打开就静默刷一次，用户不必先点按钮才看到真实数据
    void refresh(true)
  }, [])

  function update(patch: Partial<PanelConfig>) {
    const next = normalizeConfig({ ...cfg, ...patch })
    setCfg(next)
    saveConfig(next)
    // 故意不在这里 reloadWidgets：输入框每敲一个字都重载会烧掉 WidgetKit 的刷新预算，
    // 小组件下次取时间线自然会读到新配置。
  }

  async function probe() {
    if (busy) return
    setBusy(true)
    setMessage("正在连接…")
    try {
      setMessage(`✅ ${await probeConfig(cfg)}`)
    } catch (e) {
      setMessage(`❌ ${e instanceof PanelRequestError ? `${e.message}\n${e.hint}` : e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function refresh(silent = false) {
    if (busy) return
    setBusy(true)
    if (!silent) setMessage("正在刷新…")
    try {
      const snap = await buildSnapshot(cfg, APP_TIMEOUT_MS)
      if (snap.error && snapshot && snapshot.cards.length > 0) {
        // 失败别覆盖上一份好数据
        setMessage(`❌ ${snap.error}`)
      } else {
        writeSnapshot(snap)
        setSnapshot(snap)
        setMessage(snap.error ? `❌ ${snap.error}` : `✅ 已刷新：${snap.cards.length} 张卡`)
      }
      reloadWidgets()
    } catch (e) {
      setMessage(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  /** 把图标解析情况复制到剪贴板，方便贴出来定位（截图我这边看不了） */
  async function copyIconDiagnostics() {
    const lines: string[] = []
    lines.push(`showIcons=${cfg.showIcons} iconBase=${iconBaseOf(cfg)} key=${cfg.iconKey ? "set" : "empty"}`)
    lines.push(`snapshot.iconNote=${snapshot?.iconNote ?? "-"}`)
    for (const card of cards) {
      const file = iconFileNameOf(card.icon)
      let cached = "-"
      if (file) {
        const p = cachedIconPath(file)
        if (p) {
          let size = "?"
          try {
            size = String(FileManager.statSync(p).size)
          } catch {
            size = "stat-fail"
          }
          cached = `${size}B`
        }
      }
      const code = resolveIcon(card.icon, card.provider, card.title)
      lines.push(
        `${card.title} | icon=${card.icon || "(empty)"} | file=${file || "-"} | cached=${cached} | svg=${code ? `${code.length}B` : "(none)"}${code ? ` mono=${code.includes("currentColor")}` : ""}`
      )
    }
    try {
      await Pasteboard.setString(lines.join("\n"))
      setMessage("✅ 图标诊断已复制到剪贴板")
    } catch (e) {
      setMessage(`❌ 复制失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function preview(family: WidgetFamily) {
    try {
      await Widget.preview({ family })
    } catch (e) {
      setMessage(`预览失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const cards = snapshot?.cards ?? []
  const gateway = snapshot?.gateway ?? null
  const hint = isLoopback(cfg.baseURL)
    ? "本机地址：小组件跑在手机上时 127.0.0.1 指向手机自己。要让手机读电脑上的 magpie，填电脑的局域网 IP，并在 magpie 打开「Share on local network」。"
    : "跨机器访问必须带 magpie 里已启用的网关 key，否则会 401。"

  return (
    <NavigationStack>
      <List navigationTitle="MagPanel">
        <Section header={<SectionTitle icon="antenna.radiowaves.left.and.right" title="网关连接" />} footer={<Hint>{hint}</Hint>}>
          <TextField
            title="地址"
            value={cfg.baseURL}
            onChanged={v => update({ baseURL: v })}
            prompt="http://192.168.1.10:3425"
          />
          <SecureField
            title="网关 Key"
            value={cfg.token}
            onChanged={v => update({ token: v })}
            prompt="magpie gateway key（本机可留空）"
          />
          <Button title={busy ? "处理中…" : "测试连接"} systemImage="bolt.horizontal" action={probe} />
          <Button title="立即刷新并推送小组件" systemImage="arrow.triangle.2.circlepath" action={() => refresh(false)} />
          {message ? (
            <Text
              font="caption"
              foregroundStyle={
                message.startsWith("❌") ? "systemRed" : message.startsWith("✅") ? "systemGreen" : "secondaryLabel"
              }
            >
              {message}
            </Text>
          ) : null}
        </Section>

        <Section
          header={<SectionTitle icon="slider.horizontal.3" title="显示内容" />}
          footer={<Hint>这些开关只影响小组件怎么画，不改变 magpie 的配置。关掉「显示账户信息」会隐藏套餐名和账号（邮箱），小组件上只剩供应商与余量。</Hint>}
        >
          <TextField title="小组件标题" value={cfg.title} onChanged={v => update({ title: v })} prompt="magpie" />
          <Toggle title="标题显示喜鹊图标" value={cfg.showTitleIcon} onChanged={v => update({ showTitleIcon: v })} />
          <Toggle title="显示网关信息" value={cfg.showGateway} onChanged={v => update({ showGateway: v })} />
          <Toggle title="显示供应商图标" value={cfg.showIcons} onChanged={v => update({ showIcons: v })} />
          <Toggle title="显示账户信息" value={cfg.showAccount} onChanged={v => update({ showAccount: v })} />
          <Toggle title="显示余额/套餐卡" value={cfg.showAuxCards} onChanged={v => update({ showAuxCards: v })} />
          <Toggle title="显示积分/文本额度行" value={cfg.showAuxWindows} onChanged={v => update({ showAuxWindows: v })} />
          <HStack spacing={10} alignment="center">
            <SVG code={MAGPIE_ICON} resizable scaleToFit frame={{ width: 18, height: 18 }} />
            {["claude", "codex", "deepseek", "gemini", "trae", "marvis"].map(key => (
              <IconSample key={key} name={key} size={18} />
            ))}
            <Spacer />
            <Text font="caption2" foregroundStyle="tertiaryLabel">
              内置 {BUILTIN_ICON_COUNT} 个
            </Text>
          </HStack>
          <Menu title={`数值：${cfg.metric === "left" ? "剩余余量" : "已用比例"}`} systemImage="percent">
            <Button title="剩余余量" action={() => update({ metric: "left" })} />
            <Button title="已用比例" action={() => update({ metric: "used" })} />
          </Menu>
          <Menu title={`排序：${cfg.sort === "urgent" ? "最紧张优先" : "网关原序"}`} systemImage="arrow.up.arrow.down">
            <Button title="最紧张优先" action={() => update({ sort: "urgent" })} />
            <Button title="网关原序" action={() => update({ sort: "source" })} />
          </Menu>
          <TextField
            title="只看这些供应商"
            value={cfg.providerFilter}
            onChanged={v => update({ providerFilter: v })}
            prompt="claude, codex（留空 = 全部）"
          />
        </Section>

        <Section
          header={<SectionTitle icon="photo" title="自建供应商图标" />}
          footer={
            <Hint>
              magpie 自建/第三方供应商的图标是它抓的 favicon，只存在它本机的 icons 目录，网关（3425）读不到；能取到的是 magpie 网页端（默认 3430）的 /api/icons/&lt;文件名&gt; 与 /icons/&lt;资源名&gt;.svg|png，而网页端需要 key。填上之后拉一次会缓存到本机，之后离线可用；取不到的显示 magpie 同款占位图标。
            </Hint>
          }
        >
          <TextField
            title="图标地址"
            value={cfg.iconBaseURL}
            onChanged={v => update({ iconBaseURL: v })}
            prompt={`留空 = ${iconBaseOf(cfg) || "网关主机:3430"}`}
          />
          <SecureField
            title="网页 Key"
            value={cfg.iconKey}
            onChanged={v => update({ iconKey: v })}
            prompt="magpie web 链接里的 k=，或 MAGPIE_WEB_KEY"
          />
        </Section>

        <Section header={<SectionTitle icon="widget.small" title="小组件参数" />}>
          <Stepper
            title={`最多 ${cfg.maxCards} 张卡`}
            onIncrement={() => update({ maxCards: cfg.maxCards + 1 })}
            onDecrement={() => update({ maxCards: cfg.maxCards - 1 })}
          />
          <Stepper
            title={`每 ${cfg.refreshMinutes} 分钟刷新`}
            onIncrement={() => update({ refreshMinutes: cfg.refreshMinutes + 5 })}
            onDecrement={() => update({ refreshMinutes: cfg.refreshMinutes - 5 })}
          />
          <Hint>系统对小组件刷新有预算，间隔太短也不会真的按你设的频率跑。</Hint>
        </Section>

        <Section
          header={<SectionTitle icon="square.grid.2x2" title="小组件预览" />}
          footer={<Hint>应用内预览只是近似效果，真实尺寸与裁剪以主屏幕上的小组件为准。</Hint>}
        >
          <Menu title="选择尺寸预览" systemImage="eye">
            <Button title="小尺寸" action={() => preview("systemSmall")} />
            <Button title="中尺寸" action={() => preview("systemMedium")} />
            <Button title="大尺寸" action={() => preview("systemLarge")} />
            <Button title="超大尺寸" action={() => preview("systemExtraLarge")} />
            <Button title="锁屏矩形" action={() => preview("accessoryRectangular")} />
            <Button title="锁屏圆形" action={() => preview("accessoryCircular")} />
            <Button title="锁屏单行" action={() => preview("accessoryInline")} />
          </Menu>
        </Section>

        <Section
          header={<SectionTitle icon="list.bullet.rectangle" title="当前数据" />}
          footer={<Hint>这里列的就是小组件能拿到的东西；为空说明还没连通，或 magpie 里没有登录任何供应商。</Hint>}
        >
          <Row
            label="上次刷新"
            value={snapshot ? `${fmtAgo(snapshot.fetchedAt, Date.now())} · ${fmtClock(snapshot.fetchedAt)}` : "还没刷新"}
          />
          <Row label="配额卡" value={`${cards.length} 张`} />
          {gateway ? (
            <Row
              label="网关"
              value={`${displayHost(cfg.baseURL)}${gateway.modelCount !== null ? ` · ${gateway.modelCount} 模型` : ""}`}
              tint={gateway.ok ? "systemGreen" : "systemOrange"}
            />
          ) : null}
          {gateway?.limited ? <Row label="key 限额" value={gateway.limitText ?? "已设限"} /> : null}
          {snapshot?.iconNote ? <Row label="图标" value={snapshot.iconNote} tint="systemOrange" /> : null}
          {snapshot?.error ? <Row label="错误" value={snapshot.error} tint="systemRed" /> : null}

          {cards.map(card => (
            <VStack alignment="leading" spacing={4} key={card.id}>
              <HStack spacing={6}>
                <IconSample icon={card.icon} iconPath={card.iconPath} provider={card.provider} name={card.title} size={14} />
                <Text bold lineLimit={1}>
                  {card.title}
                </Text>
                {cfg.showAccount && card.subtitle ? (
                  <Text font="caption" foregroundStyle="tertiaryLabel" lineLimit={1}>
                    {card.subtitle}
                  </Text>
                ) : null}
                <Spacer />
                <Text font="caption" foregroundStyle={card.worst <= 101 ? quotaColor(card.worst) : "secondaryLabel"} monospacedDigit>
                  {card.worst <= 101 ? fmtPct(card.worst) : "—"}
                </Text>
              </HStack>
              {card.error ? (
                <Text font="caption2" foregroundStyle="systemOrange" lineLimit={2}>
                  {card.error}
                </Text>
              ) : null}
              {card.windows.map(w => (
                <HStack spacing={6} key={w.key}>
                  <Text font="caption2" foregroundStyle="secondaryLabel">
                    {w.label}
                  </Text>
                  <Spacer />
                  <Text font="caption2" foregroundStyle={w.hasShare ? quotaColor(w.leftPct) : "secondaryLabel"} monospacedDigit>
                    {w.hasShare ? fmtPct(w.leftPct) : w.text ?? "—"}
                  </Text>
                </HStack>
              ))}
              {card.balanceText ? (
                <Text font="caption2" foregroundStyle="secondaryLabel">
                  余额 {card.balanceText}
                </Text>
              ) : null}
            </VStack>
          ))}

          <Button
            title="清空本地快照"
            role="destructive"
            action={() => {
              clearSnapshot()
              setSnapshot(null)
              reloadWidgets()
              setMessage("已清空本地快照")
            }}
          />
        </Section>

        <Section
          header={<SectionTitle icon="stethoscope" title="图标诊断" />}
          footer={
            <Hint>
              A/B/C/D 是同一个图标用四种画法的对照：A 把尺寸写进 SVG（本次方案）、B 用 resizable（上一版方案）、C 彩色图标对照、D 占位立方体。告诉我哪几个看得见就能定位。点下面的按钮把每张卡的图标解析结果复制出来。
            </Hint>
          }
        >
          <HStack spacing={18} alignment="center">
            <VStack spacing={3}>
              <Text font="caption2">A</Text>
              <SVG code={svgWithSize(resolveIcon("trae") ?? GENERIC_ICON, 18)} frame={{ width: 18, height: 18 }} />
            </VStack>
            <VStack spacing={3}>
              <Text font="caption2">B</Text>
              <SVG code={svgWithSize(resolveIcon("trae") ?? GENERIC_ICON, 18)} resizable frame={{ width: 18, height: 18 }} />
            </VStack>
            <VStack spacing={3}>
              <Text font="caption2">C</Text>
              <SVG code={svgWithSize(resolveIcon("claude-color") ?? GENERIC_ICON, 18)} frame={{ width: 18, height: 18 }} />
            </VStack>
            <VStack spacing={3}>
              <Text font="caption2">D</Text>
              <SVG code={svgWithSize(GENERIC_ICON, 18)} frame={{ width: 18, height: 18 }} />
            </VStack>
            <Spacer />
          </HStack>
          <Button title="复制图标诊断" systemImage="doc.on.clipboard" action={copyIconDiagnostics} />
        </Section>

        <Section header={<SectionTitle icon="info.circle" title="说明" />}>
          <Hint>数据来自 magpie 的 /v1/magpie/quotas/cards（供应商余量）与 /v1/magpie/limit（网关 key 限额）。只有握着登录态的那台 magpie 会去问厂商，这里读的是它缓存的读数。</Hint>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<App />)
  Script.exit()
}

run()
