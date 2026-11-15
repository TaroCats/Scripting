# 无障碍播报

`Accessibility` 是全局 API，无需 import。用它通过旁白播报简短的重要结果，不主动移动用户的无障碍焦点。它与通用文字转语音的 `Speech` 是不同能力。

## `Accessibility.announce(message: string): Promise<boolean>`

- `message`：非空字符串，首尾空白会被移除；非字符串或纯空白字符串以 `TypeError` 拒绝。
- 返回 `true` 表示已向系统提交播报，**不代表**旁白已经读出或朗读结束。
- 旁白关闭、Scripting 不在活跃前台或脚本不符合条件时返回 `false`。不会保存播报以便下次回到前台重放。
- 支持主 App 中的存活脚本入口、Home UI 和 assistant-tool 上下文。最小化脚本、静态快照、Widget/Intent 上下文和 App 扩展不能通过此接口播报；只有主 App 注册此全局对象。
- 调用时和提交前都会检查条件。退出或销毁脚本会取消待提交操作，不再执行已销毁上下文中的 Promise 回调。需要播报最终结果时，**先 await 再退出脚本**。

需要包含本次更新的 Scripting 版本；3.3.0（27）及更早版本不支持。

## 示例

```tsx
import { Button, Navigation, Script, Text, VStack, useState } from "scripting"

async function main() {
  function Example() {
    const [status, setStatus] = useState("就绪")

    async function complete() {
      const result = "操作已完成"
      setStatus(result)
      const submitted = await Accessibility.announce(result)
      console.log(submitted ? "已提交播报" : "已跳过播报")
    }

    return <VStack spacing={16}>
      <Text>{status}</Text>
      <Button title="完成操作" action={complete} />
    </VStack>
  }

  await Navigation.present(<Example />)
  Script.exit()
}

void main()
```

结果也应保留在界面中，播报只是可访问文字和控件的补充。适合播报任务完成、错误或搜索结果摘要；不要逐 token、逐进度或反复播报未变化的状态。接口不覆盖系统朗读调度，也不会强制聚焦某个控件。

单个元素的默认激活与命名操作，请参阅无障碍视图修饰器文档。
