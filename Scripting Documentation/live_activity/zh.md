`LiveActivity` API 允许你的脚本在 iOS 的锁屏界面以及支持的设备上的动态岛中展示实时数据。通过该 API，你可以创建、更新并结束 Live Activity，同时监听其生命周期状态和系统支持情况。

本文件详细介绍 Scripting app 中的 **LiveActivity API**，包括：

- Live Activity 的生命周期与核心概念
- 如何注册 Live Activity UI
- 如何在脚本中启动、更新、结束 Live Activity
- 如何构建 Live Activity UI（包括 Dynamic Island 多种布局）
- 所有类型参数说明
- 完整示例代码与最佳实践

本 API 基于 Apple ActivityKit 能力，并以 TypeScript/TSX 的方式封装，允许开发者使用 React 风格构建 Lock Screen 与 Dynamic Island 界面。

---

## 1. Live Activity 概念理解

Live Activity 展示在以下区域：

- **锁屏界面**
- **iPhone 14 Pro+ 的 Dynamic Island**
- **其他设备的悬浮样式（Banner）**
- **Apple Watch 智能叠放和 CarPlay**

它能随着应用或脚本运行实时更新内容，如：

- 计时器
- 外卖进度
- 健身、运动状态
- 倒计时、打卡、提醒

**在 Scripting app 中，一个 Live Activity 由两部分组成：**

1. **内容状态（contentState）**
   一个 JSON 可序列化的对象，会随时间改变。
2. **UI Builder**
   通过 TSX 描述不同区域的展示方式。

---

## 2. Live Activity 状态类型

```ts
type LiveActivityState = "active" | "dismissed" | "ended" | "stale";
```

| 状态      | 描述                                              |
| --------- | ------------------------------------------------- |
| active    | 正在显示，可以更新内容                            |
| stale     | 已过期，需要更新 staleDate 后才能恢复 active      |
| ended     | 活动已结束但仍在锁屏显示（最长 4 小时或自定时间） |
| dismissed | 已被系统或用户移除，不再可见                      |

---

## 3. LiveActivityDetail 类型

```ts
type LiveActivityDetail = {
  id: string;
  state: LiveActivityState;
};
```

用于描述当前正在运行的所有 Live Activity 信息。

---

## 4. LiveActivity UI 构建类型

## 4.1 LiveActivityUIProps

```ts
type LiveActivityUIProps = {
  keylineTint?: Color | null;
  dynamicIslandContentMargins?: Partial<Record<LiveActivityDynamicIslandMode, LiveActivityDynamicIslandMargins>>;
  content: VirtualNode;
  small?: VirtualNode;
  compactLeading: VirtualNode;
  compactTrailing: VirtualNode;
  minimal: VirtualNode;
  children: VirtualNode | VirtualNode[];
};
```

这些字段对应 Live Activity 的不同展示区域：

- **content**：锁屏和普通设备顶部 Banner 显示
- **small**：Apple Watch 智能叠放和 CarPlay 的可选紧凑布局
- **compactLeading / compactTrailing**：Dynamic Island 收缩状态左右区域
- **minimal**：最小化的单点显示
- **children**：展开后的多个区域（使用 `LiveActivityUIExpanded*` 包裹）

系统请求小尺寸布局时，有 `small` 就显示它，省略时沿用 `content`。Apple Watch 智能叠放要求 watchOS 11 或更新版本，并配对运行 iOS 18 或更新版本的 iPhone。紧凑布局应简洁，确保关键内容在较大字体下也能显示。

如果使用远程 Live Activity，添加 `small` 后需重新准备模板，并用新模板启动活动。已运行的活动继续使用原来绑定的模板。

---

## 4.2 静态渲染与组件限制

Live Activity 将 builder 返回的 UI 构建为静态快照，显示期间不会持续运行 JavaScript 来重新生成视图。

- 不支持 `GeometryReader`、`ScrollViewReader`、`NamespaceReader` 和 `EnvironmentValuesReader` 等需要在显示期间将布局或环境信息回传给 JavaScript、再生成子视图的组件。使用这些组件可能导致对应内容为空。
- 可以使用 `HStack`、`VStack`、`Text`、`Image` 等组件，也可以使用自定义函数组件和根据 `contentState` 进行的条件渲染；它们的内容在构建快照时确定。
- **仍然支持通过 `activity.update(state)` 更新内容。** 新状态会传给已注册的 builder，用于构建新的 UI 快照；实际显示的刷新时机由 ActivityKit/WidgetKit 管理。不要依赖视图内的定时器、事件回调或 `useState` 持续驱动界面刷新。

---

## 5. 注册 Live Activity UI

Live Activity 必须放在单独的文件中，例如 `live_activity.tsx`：

```tsx
import { HStack, Image, Text, LiveActivity, LiveActivityUI,
  LiveActivityUIExpandedCenter, type LiveActivityUIBuilder } from "scripting";

export type State = {
  mins: number;
};

function ContentView(state: State) {
  return (
    <HStack activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      <Image systemName="waterbottle" foregroundStyle="systemBlue" />
      <Text>{state.mins}分钟后补水</Text>
    </HStack>
  );
}

const builder: LiveActivityUIBuilder<State> = (state) => {
  return (
    <LiveActivityUI
      content={<ContentView {...state} />}
      small={<Text lineLimit={1}>{state.mins} 分钟后补水</Text>}
      compactLeading={
        <HStack>
          <Image systemName="clock" />
          <Text>{state.mins}m</Text>
        </HStack>
      }
      compactTrailing={<Image systemName="waterbottle" foregroundStyle="systemBlue" />}
      minimal={<Image systemName="clock" />}>
      <LiveActivityUIExpandedCenter>
        <ContentView {...state} />
      </LiveActivityUIExpandedCenter>
    </LiveActivityUI>
  );
};

export const MyLiveActivity = LiveActivity.register("MyLiveActivity", builder);
```

---

## 6. 在脚本中使用 Live Activity

下面展示如何启动、更新、监听状态并结束 Live Activity。`BackgroundKeeper` 是全局 API，无需导入；UI 组件、hooks、类型和 `Script` 从 `"scripting"` 导入。此入口保存为 `index.tsx`，使用上文 `live_activity.tsx` 导出的工厂。

```tsx
import {
  Button,
  Text,
  VStack,
  Navigation,
  NavigationStack,
  useMemo,
  useState,
  LiveActivityState,
  Script,
} from "scripting";
import { MyLiveActivity } from "./live_activity";

function Example() {
  const dismiss = Navigation.useDismiss();
  const [state, setState] = useState<LiveActivityState>();

  const activity = useMemo(() => {
    const instance = MyLiveActivity();

    instance.addUpdateListener((s) => {
      setState(s);
      if (s === "dismissed") {
        void BackgroundKeeper.stopKeepAlive();
      }
    });

    return instance;
  }, []);

  return (
    <NavigationStack>
      <VStack
        navigationTitle="LiveActivity 示例"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="完成" action={dismiss} />,
        }}>
        <Text>当前状态：{state ?? "-"}</Text>

        <Button
          title="启动 Live Activity"
          disabled={state != null}
          action={async () => {
            let count = 5;
            if (!await BackgroundKeeper.keepAlive()) return;
            if (!await activity.start({ mins: count })) {
              await BackgroundKeeper.stopKeepAlive();
              return;
            }

            function tick() {
              setTimeout(async () => {
                count -= 1;

                if (count === 0) {
                  await activity.end({ mins: 0 });
                  await BackgroundKeeper.stopKeepAlive();
                } else {
                  await activity.update({ mins: count });
                  tick();
                }
              }, 60000);
            }
            tick();
          }}
        />
      </VStack>
    </NavigationStack>
  );
}

async function run() {
  await Navigation.present(<Example />);
  Script.exit();
}

run();
```

---

## 7. LiveActivity 类 API 说明

## 7.1 start(contentState, options?)

```ts
start(contentState: T, options?: LiveActivityOptions): Promise<boolean>
```

- 请求系统启动 Live Activity
- contentState 必须可以 JSON 序列化

### LiveActivityOptions

```ts
type LiveActivityOptions = {
  staleDate?: number | Date;
  relevanceScore?: number;
};
```

- staleDate：到期变为 stale 的时间戳（ms） 或 Date 对象
- relevanceScore：控制 Dynamic Island 的优先级

---

## 7.2 update(contentState, options?)

```ts
update(contentState: T, options?: LiveActivityUpdateOptions)
```

将新的 JSON 可序列化状态传给 builder，更新 Live Activity 的内容。例如，`await activity.update({ mins: 5 })` 会使用新的 `mins` 值构建 UI 快照。静态渲染不会禁用此更新能力；组件限制见第 4.2 节。

### LiveActivityUpdateOptions

```ts
type LiveActivityUpdateOptions = {
  staleDate?: number | Date;
  relevanceScore?: number;
  alert?: {
    title: string;
    body: string;
  };
};
```

可带 Apple Watch 的更新提示。

---

## 7.3 end(contentState, options?)

```ts
end(contentState: T, options?: LiveActivityEndOptions)
```

### LiveActivityEndOptions

```ts
type LiveActivityEndOptions = {
  staleDate?: number | Date;
  relevanceScore?: number;
  dismissTimeInterval?: number;
};
```

dismissTimeInterval（单位秒）:

- 未提供：系统默认最长保留 4 小时
- \<= 0：立即移除
- \> 0：指定多久后移除

---

## 7.4 获取活动状态

```ts
getActivityState(): Promise<LiveActivityState | null>
```

---

## 7.5 监听状态更新

```ts
addUpdateListener(listener);
removeUpdateListener(listener);
```

当 Live Activity 状态变更时回调，例如：

- active → stale
- active → ended
- ended → dismissed

---

## 7.6 静态方法

```ts
static areActivitiesEnabled(): Promise<boolean>
static getAllActivities(): Promise<LiveActivityDetail[]>
static getAllActivitiesIds(): Promise<string[]>
static getActivityState(activityId: string)
static from(activityId, name)
static endAllActivities(options?)
```

---

## 8. Live Activity UI 组件

| 组件                           | 描述               |
| ------------------------------ | ------------------ |
| LiveActivityUI                 | 注册 UI 的根结构   |
| LiveActivityUIExpandedCenter   | 展开状态的中间区域 |
| LiveActivityUIExpandedLeading  | 左侧区域           |
| LiveActivityUIExpandedTrailing | 右侧区域           |
| LiveActivityUIExpandedBottom   | 底部区域           |

用于构建 Dynamic Island 展开布局。

---

## 9. 注意事项与最佳实践

## 9.1 必须 JSON 可序列化

contentState 中不能包含：

- 函数
- Date 对象（需转 timestamp）
- class 实例
- 非可序列化对象

## 9.2 Live Activity 必须放在独立文件

例如：

```
live_activity.tsx
```

这与系统对 UI 构建的要求有关。

## 9.3 Scripting 的 Live Activity 与脚本生命周期隔离

即使脚本结束，Live Activity 会继续保持。

若你希望脚本保持运行，可使用：

```ts
BackgroundKeeper.keepAlive();
```

---

## 10. 完整示例（简化版）

```tsx
const activity = MyLiveActivity();

await activity.start({ mins: 10 });

await activity.update({ mins: 5 });

await activity.end({ mins: 0 }, { dismissTimeInterval: 0 });
```

## 11. 注意事项

- Live Activity 的启动是异步的，需要等到 `start` 返回 `true` 时才能调用 `update` 和 `end`
- Live Activity 不能访问 Documents 和 iCloud 目录，只能访问 app group 目录，如果你想要访问文件或者渲染图片，必须把文件或图片保存到 `FileManager.appGroupDocumentsDirectory` 目录中。 比如渲染图片，你保存到 `FileManager.appGroupDocumentsDirectory` 中， 再通过 `<Image filePath={Path.join(FileManager.appGroupDocumentsDirectory, 'example.png')} />` 渲染
- Live Activity 可以访问与 App 共享的 Storage 数据

## 灵动岛系统轮廓与分模式内容边距

LiveActivityUI 支持 WidgetKit 原生 keylineTint 与分模式 dynamicIslandContentMargins（桥接 WidgetKit 的 DynamicIsland.contentMargins(_:_:for:)，iOS 16.1+）。配置作用于整个 Dynamic Island，不是在左右 compact 子区域内绘制边框或 padding。系统控制轮廓形状和样式；本接口不设置线宽、不允许穿过相机绘图、不保证与充电动画外观完全一致。

省略 keylineTint 保留默认行为：普通实时活动沿用系统默认，自定义 AlarmLiveActivity UI 继承闹钟 tint。显式 null 传原生 nil，不继承闹钟色；不保证 nil 等于完全隐藏边框。使用已有 Color 字符串及其透明度格式，不接受渐变。非法颜色由原生渲染器给出诊断。

边距为有限非负 point 数值，0 有效。覆盖优先级为单边高于 horizontal/vertical，再高于 all，与字段插入顺序无关。未指定边保留原生默认，空对象不改变设置。expanded 指整个展开模式，不是单个展开区域。非法模式、边或数值会报错。本配置不影响锁屏 content，也不替代子 View 的通用 contentMargins。缩小边距不会取消系统裁剪。

contentState 更新时由 builder 返回新的配置，使用静态快照渲染，不持有持续调用 JS 的回调。实际刷新时机仍由 ActivityKit/WidgetKit 管理。轮廓和 compact 布局外观需在有灵动岛的 iPhone 上核对。

示例见 appearance.tsx：将注册代码保存为脚本的 live_activity.tsx，再在 index.tsx 导入工厂；头部示例 start/update/end 只操作该 demo 实例。闹钟可在 alarm_live_activity.tsx builder 上使用相同 props，AlarmKit 本身仍需要 iOS 26+。

```ts
type LiveActivityDynamicIslandMode =
  | "compactLeading" | "compactTrailing" | "minimal" | "expanded"
type LiveActivityDynamicIslandMargins = Partial<Record<
  "all" | "horizontal" | "vertical" | "top" | "leading" | "bottom" | "trailing", number
>>
// New LiveActivityUIProps:
// keylineTint?: Color | null
// dynamicIslandContentMargins?: Partial<Record<LiveActivityDynamicIslandMode, LiveActivityDynamicIslandMargins>>
```

```tsx
<LiveActivityUI
  keylineTint={state.tint}
  dynamicIslandContentMargins={{ compactLeading: { all: 0 }, compactTrailing: { all: 0 } }}
  content={<Text>Charging</Text>}
  compactLeading={<Image systemName="bolt.fill" />}
  compactTrailing={<Text>80%</Text>}
  minimal={<Image systemName="bolt.fill" />}
>
  <LiveActivityUIExpandedCenter><Text>Charging</Text></LiveActivityUIExpandedCenter>
</LiveActivityUI>
```

## 空的灵动岛区域

从 `scripting` 导入 `EmptyView`，需要留空的槽位传入 `<EmptyView />`。当前槽位要求视图节点，不能用 `null` 或 `undefined` 替代。以下 builder 可配合上文创建 LiveActivity 的示例使用。

```tsx
import { EmptyView, LiveActivityUI, LiveActivityUIExpandedCenter, Text,
  type LiveActivityUIBuilder } from "scripting"

type State = { label: string }
export const build: LiveActivityUIBuilder<State> = state => (
  <LiveActivityUI
    content={<Text>{state.label}</Text>}
    compactLeading={<EmptyView />}
    compactTrailing={<Text>{state.label}</Text>}
    minimal={<EmptyView />}
  >
    <LiveActivityUIExpandedCenter><Text>{state.label}</Text></LiveActivityUIExpandedCenter>
  </LiveActivityUI>
)
```

## 展开区域优先级

四个 LiveActivityUIExpanded 组件均支持 `priority?: number`。数值越高，系统越优先分配空间，默认 0。允许有限数值，含 0 和负数；非法值使 builder 明确失败。它是原生区域分配提示，与通用 layoutPriority modifier 独立。AlarmLiveActivity 自定义界面使用同一组组件，已有边框色与边距保持不变。

```tsx
// live_activity.tsx
import { LiveActivity, LiveActivityUI, Text,
  LiveActivityUIExpandedLeading, LiveActivityUIExpandedTrailing,
  LiveActivityUIExpandedCenter, LiveActivityUIExpandedBottom } from "scripting"
export const PriorityDemo = LiveActivity.register("PriorityDemo", () => (
  <LiveActivityUI content={<Text>Priority demo</Text>}
    compactLeading={<Text>L</Text>} compactTrailing={<Text>R</Text>} minimal={<Text>P</Text>}>
    <LiveActivityUIExpandedLeading priority={2}>
      <Text accessibilityLabel="Main status">Long primary status</Text>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing priority={0}><Text>Secondary</Text></LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedCenter priority={1}><Text>Center</Text></LiveActivityUIExpandedCenter>
    <LiveActivityUIExpandedBottom priority={0}><Text>Details</Text></LiveActivityUIExpandedBottom>
  </LiveActivityUI>
))
```

```ts
// index.tsx
import { Script } from "scripting"
import { PriorityDemo } from "./live_activity"
async function main() {
  const activity = PriorityDemo()
  try {
    if (!await activity.start({})) throw new Error("Live Activity could not start")
  } finally {
    Script.exit()
  }
}

void main()
```

请在灵动岛 iPhone 上验证展开布局、长文本/本地化、大字号、VoiceOver 标签与顺序。iPad 可验证 builder 数据及系统支持的锁屏展示，不能据此确认灵动岛展开效果。
