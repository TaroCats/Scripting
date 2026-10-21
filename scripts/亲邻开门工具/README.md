# 亲邻开门工具（Scripting App 脚本）

用逆向分析出的调用链，在 iOS 上重建「登录 + 远程/蓝牙开门 + 会话持久化」。

> **更正**：上一版说"Scripting 没有蓝牙 API、蓝牙开门做不了"是**错的**。  
> 那是只查了官网 `llms.txt` 索引（未收录蓝牙）。本地完整文档里有  
> `bluetooth/{central_manager,peripheral,service,characteristic,background}`，  
> 平台支持完整 BLE 中央设备。本版已补上蓝牙开门实现。

## 能力对照

| 功能          | 状态        | 说明                                                                                               |
| ----------- | --------- | ------------------------------------------------------------------------------------------------ |
| 手机号 + 验证码登录 | ✅         | `app/api/app/v1/login` + `mobile` / `validCode`                                                  |
| 远程开门        | ✅         | `open/doorcontrol/v2/open` + `doorControlId`，解析 `data.res` / `openDoorState` / `doorControlName` |
| 蓝牙开门        | ✅ 已实现，需配置 | 扫描 → 连接 → 发现服务/特征 → 写入；UUID 与载荷必须靠抓包填                                                            |
| 远程失败自动转蓝牙   | ✅         | 复刻原 App `checkoutBlueOpenDoor` 的顺序                                                               |
| 会话长久不过期     | ✅         | Keychain `first_unlock_this_device` 持久化 + 启动静默校验，不主动清                                            |
| 一键登录（闪验取号）  | ❌         | 需要运营商通道 + 原生取号 SDK。文档里没有 carrier / 取号 相关 API                                                     |

## 会话策略（不再做保活）

按你的要求，**不做 BackgroundKeeper 保活**。改为：

1. 登录成功后 `token` / `sessionId` 写入 **Keychain**（`first_unlock_this_device`：重启后首次解锁即可读，不迁移出本机）
2. 脚本每次启动先读本地会话，**直接进入已登录状态**，不阻塞等待网络
3. 然后做一次 `checkLogin` 静默校验：
   - 通过 → 正常用
   - **只有服务端明确返回 401 / token 失效** → 才清会话要求重登
   - 网络失败/超时 → **不清会话**（避免误判把有效会话丢掉）
4. 开门时若遇到会话失效，强制登出（复刻原 App「sessionId 过期强制退出登录」）

也就是说：只要服务端 token 还有效，你就永远不用再登录。真正决定"过期"的是服务端 TTL，客户端不再主动打断它。

## 仍需你提供的协议细节

### 远程部分

| 项           | 状态                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `baseURL`   | ✅ **已确定**：`https://qapp.qinlinkeji.com/`（生产）/ `https://test-qapp.qinlinkeji.com/`（测试），来自 libapp.so 字符串字面量 |
| `appId`     | 未知，需抓包                                                                                                    |
| `appSecret` | 原 App 硬编码了一个（见逆向报告），本仓库**不落盘**，请自行填                                                                       |
| AES 密钥      | 未知。发现两枚 32 位 hex 常量（`91FC5A0C…` / `FBC213C4…`），是密钥还是 MD5 种子未验证                                            |
| 签名拼接顺序      | 未知。只确认存在 `sign` / `timestamp` / `nonce` 参数                                                                |
| 响应外壳        | 部分未知，按 `code/data/res` 兼容解析                                                                               |

**关于域名的补充**（值得知道）：原 App 不是"一个域名走天下"。`ServiceDomain` 类里有 4 个域：  
`qapp` / `mallapi` / `mobileapi` / `qlp`，每次 API 调用带一个 `domainLevel` 参数决定用哪个，  
且 `ServiceDomain.build` 会从配置读取覆盖。本脚本用到的登录/开门接口先按 `qapp` 走；  
如果某个接口返回 404，换域名重试即可（设置页有一键切换生产/测试）。

### 蓝牙部分（这三项必须抓包）

| 项               | 状态                                            |
| --------------- | --------------------------------------------- |
| `serviceUUID`   | **不在代码里**。全量字符串 62080 条中没有任何 UUID 字面量 → 服务端下发 |
| `writeCharUUID` | 同上                                            |
| 载荷格式            | 未确认。原 App 的 BLE 写入在 Dart 机器码里拼装，是否加密未验证       |
| 设备名过滤           | 可选，设备多时用                                      |

载荷支持模板 + 占位符：`{doorControlId}` `{sessionId}` `{timestamp}`，可 hex 或明文。

## 目录

```
亲邻开门工具/
├── script.json
├── index.tsx            单页 UI：账号 / 门禁 / 蓝牙 / 协议 / 日志
└── core/
    ├── protocol.ts      端点常量（全部来自二进制字符串）+ 配置类型
    ├── aes.ts           AES-128-ECB + PKCS5（宿主只给 AES-GCM）
    ├── crypto.ts        MD5 签名 + 请求体加密
    ├── session.ts       Keychain 会话（first_unlock_this_device）
    ├── api.ts           公共参数 / 签名 / 解包 / 401 → SessionExpiredError
    ├── blue.ts          BLE：扫描→连接→发现→写入→等回执
    └── opendoor.ts      远程优先 → 失败转蓝牙 的状态机
```

## 已跑过的验证

| 项                              | 结果                                                |
| ------------------------------ | ------------------------------------------------- |
| AES-128 单块加密 vs FIPS-197 向量    | `69c4e0d86a7b0430d8cdb78070b4c55a` ✅              |
| 6 个 core 模块在 stub 宿主下加载        | 全部 load OK ✅                                      |
| BLE 全流程（mock central manager）  | scan→connect→discover→write，写入字节 `a10bff` 与模板一致 ✅ |
| 远程失败 → 自动转蓝牙（mock）             | `via=ble`，写入 `a10b` ✅                             |
| 远程成功 / 远程失败 / 401 三分支          | 分别返回 remote / none / 抛 SessionExpiredError ✅      |
| esbuild 编译 `index.tsx` + 全部 TS | 零错误 ✅ |
| **tsc 严格类型检查**（对着 App 同步的 `dts/*.d.ts`） | exit=0，0 错误 ✅ |

**未验证**：真机渲染、真实接口连通（缺 baseURL/密钥）、真机 BLE（缺 UUID/载荷）。

## 使用

1. iPhone 上 Scripting App 导入本目录
2. 「协议配置」域名已默认生产，只需补 `appId` / `appSecret`（点按钮可切生产/测试）
3. 「账号」登录（之后重启不用再登）
4. 「门禁」录入 `doorControlId`（列表接口未确认，`doorcontrol/v2/sort` 只是排序）
5. 想用蓝牙：抓一次原 App 的 BLE 通信拿到 serviceUUID / writeCharUUID / 写入字节，填进「蓝牙」区
6. 点「开门」→ 先远程，失败自动转蓝牙；每一步都会写日志

---

## 附：一轮协议逆向修正（2026-10-22）

线上报 `HTTP 404`（获取验证码），追查后修正如下。

### 1. 端点写错了（404 的直接原因）

`sendValidCode` 之前是照函数名 `interfaceSendValidCode` 猜的
`app/api/app/v1/sendValidCode`。反查该函数体（`Interface.dart` @ `0xbb07c0`），
真实路径是：

```
member/sms/sendSecurityCode
```

同族还有换绑手机号用的 `member/sms/sendSecurityCodeForChangePhone`。

### 2. 顺带把签名算法挖出来了

来自 `qinlin/utils/Encryption.dart`，各步骤的字面量可直接对上：

| 步骤 | 内容 |
|---|---|
| `fixedParameter` | 补 `version` / `timestamp` / `nonce` / `token` / `sessionId` |
| `onAsciiSort` | 参数 ASCII 排序，`k=v` 用 `&` 连接，**尾部追加 `&key=qiAnlPinP`** |
| `md5Encrypt` | 对上面的串取 MD5 → 业务 `sign` |
| `getHeaderSign` | header map `{appid: "gbDjIZQSOpCMX49P", nonce, timestamp, version: "v2"}`，排序后 **追加 `&appsecret=OKFoQ9MmNXQtcyXROo4PnaFkfDPTHuDg`** 再 MD5 |
| `aesEncryptParams` | 参数 AES-128-ECB，密钥 **`91FC5A0CA0856C01A913CD77F21066AC`** |

**时间戳是微秒**（`DateTime.microsecondsSinceEpoch`），之前用毫秒是错的。
`nonce` 由 `randomNumber4()` 生成，即 4 位随机数字。

这些都已在 `core/protocol.ts` 里作为默认值预填，设置页可覆盖。

### 3. 还没确认的两点

- 业务 `sign` 与 header `sign` 是否互相包含（现在两者独立计算）
- AES 密文放 body 字段还是 header（现在放 `payload` 字段 + `AesHeader` header，默认关闭）

### 4. 意外收获：BLE 帧格式线索

`Encryption::onEncrypt` 里出现 `FA34DD0001`、`55AA5A5AA5`、`exclusiveOR`、`resultKey`、
`fixTime: ` 这些常量 —— 明显是设备帧头 + XOR 混淆，不是 HTTP 加密。
下次抓 BLE 时可以用 `FA34DD0001` 作为特征去定位写入载荷。

### 5. 如果还报 404

端点已修正，剩下的可能是 **domain 映射**：原 App 有 `qapp`/`mobileapi`/`mallapi`/`qlp`
四个域，`member/*` 这类接口带 `domainLevel` 参数（此接口里是数值常量），
很可能是 `mobileapi` 而不是 `qapp`。静态分析拿不到域名的具体赋值（`ServiceDomain.build`
从配置读），所以：把 `baseURL` 换成对应子域再试，或者把返回体发我。
