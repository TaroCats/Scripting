`AlarmLiveActivity` 允许脚本在 iOS 26+ 上，为通过 `AlarmManager` 创建的闹钟提供自定义锁屏和灵动岛 UI。

当内置闹钟 Live Activity UI 不能满足需求时，可以用它让闹钟展示更贴近脚本自身产品风格，同时继续使用 AlarmKit 的调度、暂停、继续、倒计时和停止能力。

---

## 文件

自定义闹钟 Live Activity UI 必须注册在独立文件中：

```txt
alarm_live_activity.tsx
```

主脚本仍然在 `index.tsx` 中创建闹钟。如果当前脚本没有提供 `alarm_live_activity.tsx`，或者指定的 UI 名称没有注册，Scripting 会回退到内置闹钟 UI。

---

## 注册 UI

`AlarmLiveActivity` 从 `scripting` 包导入：

```tsx
import {
  AlarmLiveActivity,
  Text,
  LiveActivityUI,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedCenter,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
} from "scripting"

AlarmLiveActivity.register("FocusTimerActivity", state => {
  return (
    <LiveActivityUI
      content={<Text>{state.title}</Text>}
      compactLeading={<Text>{state.mode}</Text>}
      compactTrailing={<Text>{state.title}</Text>}
      minimal={<Text>{state.mode}</Text>}>
      <LiveActivityUIExpandedLeading>
        <Text>{state.title}</Text>
      </LiveActivityUIExpandedLeading>
      <LiveActivityUIExpandedTrailing>
        <Text>{state.mode}</Text>
      </LiveActivityUIExpandedTrailing>
      <LiveActivityUIExpandedCenter>
        <Text>{state.presentation.alert.title}</Text>
      </LiveActivityUIExpandedCenter>
      <LiveActivityUIExpandedBottom>
        <Text>{state.alarmID}</Text>
      </LiveActivityUIExpandedBottom>
    </LiveActivityUI>
  )
})
```

返回的根节点必须是 `LiveActivityUI`。`content`、`compactLeading`、`compactTrailing` 和 `minimal` 区域是必填项。

---

可以在 `LiveActivityUI` 上提供可选的 `small`，为 Apple Watch 智能叠放或 CarPlay 提供紧凑布局。省略时，小尺寸布局沿用 `content`。

## 静态渲染与组件限制

Alarm Live Activity 与普通 Live Activity 一样，将 builder 返回的 UI 构建为静态快照，显示期间不会持续运行 JavaScript 来重新生成视图。

- 不支持 `GeometryReader`、`ScrollViewReader`、`NamespaceReader` 和 `EnvironmentValuesReader` 等需要在显示期间将布局或环境信息回传给 JavaScript、再生成子视图的组件。使用这些组件可能导致对应内容为空。
- 可以使用 `HStack`、`VStack`、`Text`、`Image` 等组件，也可以使用自定义函数组件和根据 `AlarmLiveActivityState` 进行的条件渲染；它们的内容在构建快照时确定。
- 不要依赖视图内的 JavaScript 定时器、事件回调或 `useState` 持续驱动界面刷新。
- **闹钟状态变化仍然可以更新内容。** AlarmKit 提供当前闹钟状态，builder 根据新状态构建新的 UI 快照，例如切换倒计时、暂停和响铃布局；实际显示的刷新时机由系统管理。`AlarmLiveActivity` 只负责注册 UI，不提供普通 `LiveActivity` 实例的 `update(state)` 方法。

倒计时可以使用由系统更新的 `TimerIntervalLabel`。暂停、继续、停止等按钮仍可通过 `state.actions.*.intent` 执行原生闹钟操作，无需保持视图的 JavaScript 持续运行。

---

## 绑定到闹钟

`AlarmManager` 是全局 API，不需要导入。

```tsx
const attributes = AlarmManager.Attributes.create({
  alert: AlarmManager.AlertPresentation.create({
    title: "Focus complete",
    stopButton: AlarmManager.Button.create({
      title: "Done",
      systemImageName: "checkmark"
    })
  }),
  countdown: AlarmManager.CountdownPresentation.create(
    "Deep focus",
    AlarmManager.Button.create({
      title: "Pause",
      systemImageName: "pause.fill"
    })
  ),
  paused: AlarmManager.PausedPresentation.create(
    "Paused",
    AlarmManager.Button.create({
      title: "Resume",
      systemImageName: "play.fill"
    })
  ),
  tintColor: "#ff9f0a",
  metadata: {
    task: "Writing"
  },
  liveActivity: {
    name: "FocusTimerActivity"
  }
})
```

`liveActivity.name` 必须和 `AlarmLiveActivity.register` 传入的名称一致。

---

## 渲染状态

builder 会收到一个 `AlarmLiveActivityState`：

```ts
type AlarmLiveActivityState = {
  alarmID: string
  mode: "scheduled" | "countdown" | "paused" | "alerting"
  title: string
  tintColor?: Color | null
  metadata: Record<string, string>
  presentation: AlarmLiveActivityPresentation
  actions: {
    pause?: AlarmLiveActivityAction | null
    resume?: AlarmLiveActivityAction | null
    stop: AlarmLiveActivityAction
    secondary?: AlarmLiveActivityAction | null
  }
  countdown?: {
    fireDate: Date
    totalCountdownDuration: number
  } | null
  paused?: {
    totalCountdownDuration: number
    prePauseCountdownDuration: number
  } | null
}
```

可以使用 `mode` 切换布局，使用 `metadata` 展示业务数据，也可以复用 `AlarmManager.Attributes` 中配置的标题和按钮文案。

---

## 内置动作

`actions` 字段包含由 Scripting 为当前闹钟创建的 AppIntent 控件。

```tsx
{state.actions.pause && (
  <Button intent={state.actions.pause.intent}>
    <Label title={state.actions.pause.title} systemImage={state.actions.pause.systemImageName ?? "pause.fill"} />
  </Button>
)}

<Button intent={state.actions.stop.intent} role="destructive">
  <Label title={state.actions.stop.title} systemImage={state.actions.stop.systemImageName ?? "xmark"} />
</Button>
```

这些 action 会调用当前闹钟对应的原生 `AlarmManager` 操作：

- `pause`
- `resume`
- `stop`
- 当 alert 的 secondary button 使用 `secondaryButtonBehavior: "countdown"` 时，提供 `secondary`

如果需要额外的脚本业务逻辑，可以另外注册自己的 `AppIntent` 并用于普通 Live Activity 按钮。控制闹钟自身状态时，推荐优先使用 `state.actions.*.intent`。

---

## 注意事项

- `AlarmManager` 的 alert `stopIntent` 和 `secondaryIntent` 仍然属于系统 alert 展示。
- 自定义 Live Activity UI 中的暂停、继续、停止和倒计时按钮应该使用 `state.actions.*.intent`。
- 灵动岛 compact 区域要尽量小，优先使用 SF Symbols、短文案和系统字体。
- iOS 26 上，锁屏和展开灵动岛中的可见控件建议使用 `buttonStyle="glass"` 或 `buttonStyle="glassProminent"`。


## 灵动岛外观

自定义闹钟 builder 支持 Live Activity 文档中的 LiveActivityUI.keylineTint/dynamicIslandContentMargins。省略 tint 继承闹钟颜色，显式 null 传原生 nil，显式 Color 覆盖闹钟色。分模式边距仅作用于灵动岛，不改变内置闹钟 UI 和锁屏外观。
