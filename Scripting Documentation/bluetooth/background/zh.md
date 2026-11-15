`BluetoothBackground` 通过主 App 中的内置 `bluetooth.tsx` 处理 BLE Central 后台事件。现有 `BluetoothCentralManager` 和 `BluetoothPeripheral` 使用方式保持不变。

## 注册

在编辑器菜单中选择 Add Bluetooth Background Script 创建 `bluetooth.tsx`。在 `index.tsx` 中显式注册：

```tsx
await BluetoothBackground.register({
  id: "sensor",
  target: {serviceUUIDs: ["180F"], localName: "My Sensor"},
  subscriptions: [{serviceUUID: "180F", characteristicUUID: "2A19"}],
})
```

注册需要前台主 App、蓝牙授权及该任务的后台执行授权。入口固定为 `bluetooth.tsx`，不接受 entry 参数。仅创建文件不会启用后台任务。注册完成只代表保存成功，不代表连接或设备认证成功。

代码与精确 npm 依赖需预先准备在本机。源文件或依赖变化后需要前台重新注册；后台不编译或安装依赖。

## 后台入口

```tsx
BluetoothBackground.handleEvents(async (event, context) => {
  if (event.type === "gap" || event.type === "disconnected") return
  if (event.type !== "ready") return
  const state = await context.session.getState()
  console.log(state.peripheralId)
})
```

模块加载时同步注册一个 handler。connected 只表示链路连接，ready 还表示声明的通知订阅已就绪。事件提供 id、taskId、revision、generation、sessionEpoch、sequence、timestamp（Unix 毫秒）、peripheralId；通知包含 characteristic 和 Data 类型的 value；错误包含 code 与 message。

session 提供 getState、readValue、writeValue、maxWriteValueLength、receiveValue。特征定位必须同时包含 serviceUUID 与 characteristicUUID。写入类型为 withResponse 或 withoutResponse；timeoutMs 为 1–4000，并受本次事件剩余执行预算限制。已订阅特征不能同时调用 readValue，避免通知与读取响应混淆。

请求响应协议应先取得 getState().lastSequence，写入后调用 receiveValue({characteristic, afterSequence, timeoutMs})；写入完成前收到的通知也会缓存。后续使用返回事件的 sequence 更新游标。游标只属于当前 sessionEpoch；同一特征最多一个待完成接收。已交给接收者的通知不再另派发一次事件。

context.checkpoint.read()/write(value) 可保存最多 64 KiB JSON；私密数据使用 Keychain。设备可能已经执行命令而脚本尚未保存结果，因此不要把旧命令当作可自动重放的 checkpoint。

## 管理和限制

getCapabilities 获取能力与限制；list/get(id) 查询本脚本任务；setEnabled(id, false) 停用；unregister(id) 解除注册。重新启用需要前台和有效执行包。更多 → 自动化中的 Background Bluetooth 页面可查看和管理任务。

退出 index.tsx 不停用显式注册的后台任务；改名、删除或替换脚本会使本机注册失效。导入脚本不会继承任务授权。

系统按蓝牙事件调度执行；State Restoration 恢复原生请求，bluetooth.tsx 重建脚本状态，不恢复旧 JS 堆。不要依赖全局变量和定时器长期存在。保持 handler 简短；协作式预算不能强制中断同步 JS 死循环。

后台上下文不展示界面、不申请新权限、不申请音频保活、不创建旧蓝牙 manager。同设备已被现有脚本使用时，后台任务主动让出。系统策略、无线状态及用户操作影响重新拉起；请查看 `(await BluetoothBackground.getCapabilities()).limitations`，不能把恢复机制视为始终运行或保证唤醒。

纯 JavaScript 依赖可以使用本地模块图及 `buffer`、`util`、`stream` 等兼容模块；安全随机数通过 `crypto.getRandomValues` 提供。后台入口不提供文件、网络及 VM 模块（`fs`、`http`、`net`、`tls`、`vm`），蓝牙操作和状态保存应使用 session 与 checkpoint。定时器仅属于当前短事件执行，不能用于长期保活。
