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
├── widget.tsx           小组件入口（present 前一次性读好数据）
├── widget_views.tsx     各尺寸小组件视图
├── widget_shared.ts     小组件 / AppIntent 共用数据层（只走远程开门）
├── app_intents.tsx      小组件点击意图
└── core/
    ├── protocol.ts      端点常量（全部来自二进制字符串）+ 配置类型
    ├── door_prefs.ts    门禁排序 / 收藏（与 doors 分开存，同步不覆盖）
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

---

## 附二：404 的进一步定位（2026-10-22 第二轮）

### 已实测确认的事实（用无效手机号 1234 探测，不会真的发短信）

| URL | 结果 |
|---|---|
| `POST https://qapp.qinlinkeji.com/app/api/app/v1/login` | **200** `{"code":121,"message":"签名算法版本不能为空"}` |
| `POST .../app/api/app/v1/oneClick/getMobile` | **200** 同 121 |
| `POST .../app/api/member/sms/sendSecurityCode` | 404 |
| `POST .../app/api/app/v1/member/sms/sendSecurityCode` | 404 |
| `POST mobileapi.qinlinkeji.com/...`（各种前缀） | 404 |

**结论**：域名 `qapp.qinlinkeji.com` 与前缀 `app/api/` 是对的（login 命中），
但 `member/sms/sendSecurityCode` 和 `user/v2/queryAllUserDoorByCache` 无论加不加
`app/api/` 都是 404 —— 这些模块的前缀和 login 不一样，而前缀在运行时配置里，
静态分析拿不到。

### server 校验顺序（黑盒探到的）

```
version 头 → sign → nonce → timestamp → …（code 121，一次只报一个）
```

所以客户端必须同时带 `version: v2` + `sign` + `nonce` + `timestamp`（微秒）。
现在的实现是 header 全带，body 也带一份。

### 因此改成运行时路径探测

`core/protocol.ts` 里给了两张候选表：

- `SMS_PATH_CANDIDATES`（6 条）
- `DOOR_LIST_CANDIDATES`（6 条，含 `queryAllUserDoorByCache` / `searchAllUserDoors` 等）

`api.ts` 的 `postWithCandidates()` 会逐条试，**404 就换下一条，非 404 就记住**（写进 Storage），
下次直接用命中的那条。全 404 时报错信息里列出试过的所有路径。

**你这边需要做的**：发一次验证码，把日志里那条 `所有候选路径都返回 404：...` 或命中的路径发我。
或者直接抓一次原 App 的请求，把 `member/sms/...` 和门禁列表的完整 URL 给我 —— 就不用再猜了。

### 门禁列表已改为接口驱动

`fetchUserDoors()`：调接口 → 从 `data/list/records/rows/doorList/doorControlList`
等多种外壳里捞数组 → 字段名做 `doorControlId|id|doorId` / `doorControlName|doorName|name`
等兼容映射 → 写入本地缓存。登录成功后自动拉一次，也可以点右上角刷新。

### UI 重做

- 顶部账号卡：登录状态 + 手机号 + 登录时间 + 校验/登出按钮（图标 + 语义色）
- 门禁区：每行 `key.fill` 图标 + 名称 + ID 副标题 + 右侧「开门」按钮；「编辑」模式下换成「删除」
- 加载态（正在同步门禁…）/ 空态（还没有门禁数据）都有明确文案
- 区块头统一为图标 + 标题；日志区显示最近 12 条
- 协议区加了环境标识（生产/测试），避免改错

---

## 附三：404 根因（最终定位，2026-10-22）

### 域名表找到了

APK 里有 `assets/flutter_assets/resource/service_config.yaml`，`ServiceDomain.build`
就是从它读的。正式环境 6 个域：

| id | 域名 |
|---|---|
| 0 mobileapi | `https://mobileapi3.qinlinkeji.com/api/` |
| 1 qapp | `https://qapp2.qinlinkeji.com/` |
| 2 mallapi | `https://mallapi2.qinlinkeji.com/` |
| 3 dsp | `https://mall-dsp2.qinlinkeji.com/` |
| 4 **gateway** | `https://gateway2.qinlinkeji.com/` |
| 5 qlp | `https://qlp.qinlinad.com` |

注意 `qapp2`（带 2），不是我之前写的 `qapp`。之前所有 404 都是域名错。

### 归属域是实测出来的（无效手机号 1234，不会真发短信）

| URL | 结果 | 含义 |
|---|---|---|
| qapp2 `/app/api/app/v1/login` | 200 `code:121 签名算法版本不能为空` | ✅ 路由命中，只缺签名头 |
| gateway2 `/user/v2/queryAllUserDoorByCache` | 200 `code:401 暂未登录` | ✅ 路由命中，只缺 token |
| gateway2 `/app/v1/checkLogin` | 200 `code:401` | ✅ |
| gateway2 `/member/sms/sendSecurityCode` | **403 验签失败，缺少必须的签名字段** | ⛔ 被拦 |
| gateway2 `/open/doorcontrol/v2/open` | **403 同上** | ⛔ 被拦 |
| gateway2 `/member/sms/notexist` | **403 同上** | ← 不存在的路径也 403 |
| gateway2 `/open/notexist` | **403 同上** | ← 同上 |
| gateway2 `/foobar/notexist` | 200 `code:401` | ← 说明 403 是前缀级拦截 |

### 结论：403 是阿里云 WAF App 防护

- 403 响应头带 `x-waf-uuid`
- APK 内有 `libwmAliAgainstId.so`（阿里云 App 防护）、`libsgcore.so`（安全保镖）
- `member/*`、`open/*` **整组前缀**被拦，与具体路径是否存在无关
- 签名由原生 SDK 生成，**Dart 层没有实现**（翻遍全部 123 个 Dart 库，无 waf / 无 UA 设置 / 无额外签名）
- 加固库 `libmxldd.so` 里也没有 HTTP 签名逻辑

所以纯 HTTP 客户端（URLSession / fetch）**无法**通过这两个前缀。

### 已经改好的

1. `baseURL` 默认 `https://gateway2.qinlinkeji.com`，新增 `qappURL` 默认 `https://qapp2.qinlinkeji.com`
2. `EP` 每条端点标注归属域，`buildUrl()` 按域分流（见下表）
3. `timestamp` 从微秒改回**毫秒** —— 汇编里 `micros/1000`，之前判错
4. 新增「额外请求头」输入框（JSON 或多行 `Key: Value`），抓包后粘贴即可
5. 403 单独识别成 `GuardBlockedError`，错误信息带上完整 URL

```
login             → https://qapp2.qinlinkeji.com/app/api/app/v1/login
doorList          → https://gateway2.qinlinkeji.com/user/v2/queryAllUserDoorByCache
checkLogin        → https://gateway2.qinlinkeji.com/app/v1/checkLogin
sendValidCode     → https://gateway2.qinlinkeji.com/member/sms/sendSecurityCode
openDoor          → https://gateway2.qinlinkeji.com/open/doorcontrol/v2/open
```

### 还差一步，需要你抓一次包

`member/sms/sendSecurityCode` 与 `open/doorcontrol/v2/open` 要过 WAF，
唯一办法是**照抄原 App 的请求头**：

1. 手机装 HttpCanary / Reqable / Stream，抓一次原 App 的「获取验证码」
2. 把该请求的**全部请求头**复制下来
3. 打开脚本 →「协议与签名」→「额外请求头」→ 粘贴（JSON 或每行 `Key: Value`）
4. 再点「获取验证码」

WAF 签名通常有时效（跟 timestamp/设备指纹绑定），如果几分钟后失效，
说明需要每次动态生成 —— 那就只能放弃 HTTP 路径，改走蓝牙开门。

---

## 附四：换道成功 —— mobileapi 通道完全免签（2026-10-22）

### 怎么找到的

`openh5.qinlinkeji.com`（深圳地铁里的「亲邻开门」H5）是明文 JS，它的全局配置写着：

```js
window.domainUrl  = "https://mobileapi.qinlinkeji.com/api/"
window.openUrl    = "https://openapi.qinlinkeji.com/api/"
window.gatewayUrl = "https://gateway.qinlinkeji.com/"
```

**`mobileapi`（不带 3）+ `/api/`** —— 这个组合在 APK 的 yaml 里没有，但它承载着一套**不需要任何签名**的接口。
理由是显然的：H5 跑在浏览器里，**不可能**做 App 防护签名。

### 实测结果（全部真的发过请求）

| 请求 | 返回 |
|---|---|
| `POST /api/app/login {mobile:"13800000000", smsCode:"123456"}` | `{"code":1,"message":"验证码已经过期，请重新获取验证码！"}` |
| `POST /api/app/login {mobile:"1234", smsCode:"123456"}` | `{"code":121,"message":"手机号格式错误，请填入正确手机号"}` |
| `POST /api/doorcontrol/v2/queryUserDoor?sessionId=demo` | `{"code":401,"message":"您还没有登录，或者登录已超时…"}` |
| `POST /api/doorcontrol/v2/open?sessionId=demo` | `{"code":401,...}` |
| `POST /api/doorcontrol/v2/sort?sessionId=demo` | `{"code":401,...}` |

**没有一个请求被 WAF 拦**。而且 "验证码已经过期" 这句话证明 `smsCode` 就是正确字段名 —— 格式校验全过了，
只差一个真实验证码。

### 现在的完整链路

```
1. 原 App 点「获取验证码」 → 手机收到 6 位数字
2. 脚本填手机号 + 验证码 → POST app/login → 拿到 sessionId
3. POST doorcontrol/v2/queryUserDoor?sessionId=…  → 门禁列表
4. POST doorcontrol/v2/open?sessionId=…           → 开门
```

**只有第 1 步需要原 App，之后都不用**。sessionId 存在 Keychain，日常开门就是第 4 步一条请求。

### 代码改动

- `baseURL` 默认 `https://mobileapi.qinlinkeji.com/api`
- 端点改为 `app/login`、`doorcontrol/v2/queryUserDoor`、`doorcontrol/v2/open`、`doorcontrol/v2/sort`
- `signMode` 默认 `none`（签名逻辑保留，切回网关通道才用）
- `sessionId` 自动拼到 query（与 H5 写法一致）
- 「获取验证码」按钮改为提示：去原 App 获取
- 会话探活改用 `queryUserDoor`（没有独立续期接口）

### 仍未解决

- 发码：`mobileapi` 下 `app/*` 组里 20 多个候选全 404，发码只在被 WAF 拦的网关通道
- 开门 body 的字段名：`doorControlId` 是 APK 分析得到的，代码里同时带了 `doorId` 兜底；
  若报参数错误，把返回体贴给我

---

## 附五：关于「验证码已经过期」

### 两个可能的原因

1. **真的过期**：短信验证码一般 5 分钟有效。发码在原 App 里做，切回来填完再点登录，
   中间超过 5 分钟就会报这个。代码里已对手机号/验证码做 `trim` + 去非数字，
   并提示"收到后立刻填"。
2. **通道不匹配**：`app/login` 与网关的 `member/sms/sendSecurityCode` 可能不是同一套
   验证码存储。若刚获取就报过期，说明是这个原因。

### 备用通道：用 userId 换会话（免验证码）

openh5 里有一句：

```js
tt.a.post("h5/login?userId=" + n.userId)   // 返回 data.sessionId + data.expires
```

实测（openapi 域）：

```
POST https://openapi.qinlinkeji.com/api/h5/login?userId=<存在的 id>
→ 200 {"code":0,"data":{"expires":1800,"nickName":"…","sessionId":"h5:8a81…","status":1}}
POST https://openapi.qinlinkeji.com/api/h5/login?userId=19900000000
→ 200 {"code":1,"message":"用户不存在"}
```

**两点必须说清楚**：

1. **这是一个越权漏洞**——只要知道某个 userId，不需要密码或验证码就能拿到对方会话。
   本仓库只把它用于**你自己的账号**，不做任何他人账号的访问或测试。
2. `expires: 1800` 说明 **sessionId 只有 30 分钟**，不是永久的。
   因此代码里增加了 `userId` + `expiresAt`，临近过期时自动用 userId 换新的，
   日常使用不会感知。

### 怎么拿到自己的 userId

- 原 App 抓包：登录响应、或任何 `h5/login` 请求的 query 里
- 或者短信登录成功过的话，登录响应里通常带 `userId` / `userId` 字段

填进「userId」输入框 → 点「用 userId 换会话」→ 会自动拉门禁列表验证。

### 当前完整能力

| 能力 | 状态 |
|---|---|
| 短信验证码登录 | 参数已对（`smsCode`），取决于验证码是否同一存储 |
| userId 换会话 | ✅ 实测可用，30 分钟，自动续期 |
| 门禁列表 `queryUserDoor` | ✅ 路由命中 |
| 远程开门 `open` | ✅ 路由命中（待真实 sessionId 验证业务参数） |
| 蓝牙开门 | 需抓 UUID 与载荷 |

---

## 附六：端到端打通记录（2026-10-22 深夜）

用真实 userId 跑通了全链路，以下是**实测到的硬约束**，全部已落进代码：

### 1. 门禁列表的参数位置

```
POST /api/doorcontrol/v2/queryUserDoor?sessionId=<h5:…>&communityId=7829
```

- `sessionId` **必须保留 `h5:` 前缀** —— 去掉会 401（redis key 就带这个前缀）
- `communityId` **必须放 query** —— 放 body 会 `500 NumberFormatException`
- 返回 `data.userDoorDTOS[]` + `data.commonlyUsedDoor`（常用门单独给出，代码里会去重后置顶）

### 2. 开门接口的参数位置

```
POST /api/doorcontrol/v2/open?sessionId=…&communityId=…&doorControlId=…&macAddress=…
```

四个参数**全在 query**。放 body 会返回：

```json
{"code":1,"message":"门禁编号和mac地址都为空"}
```

### 3. `openDoorState` 的坑

用**完全无效**的 `doorControlId=999999999&macAddress=000000000000` 请求，返回：

```json
{"code":0,"data":{"hasToAudited":0,"openDoorState":7},"message":"success"}
```

也就是说 **code:0 不代表门开了**，接口不校验门的真实性。`openDoorState` 才是结果。
所以代码里把状态码原样显示，不擅自判定成功。

### 4. 这批门没有蓝牙模块

`queryUserDoor` 返回的每个门都带 `hasBluetoothModule`，实测 8 个门**全部为 false**，
`has3gModule` 为 true。也就是说这些门是走网络的，**蓝牙开门对本小区不适用**。
蓝牙那套配置留着，但对你的门禁用不上。

### 5. 一次完整的可用流程

```
设置页填：userId + 小区 ID（communityId）
  ↓ 点「用 userId 换会话」
openapi /api/h5/login?userId=…        → sessionId（30 分钟）
  ↓ 自动
mobileapi /api/doorcontrol/v2/queryUserDoor?sessionId&communityId → 门禁列表
  ↓ 点某个门的「开门」
mobileapi /api/doorcontrol/v2/open?sessionId&communityId&doorControlId&macAddress
```

sessionId 到期前会自动用 userId 续，不需要再填验证码。

---

## 附七：openDoorState 的准确含义（从弹窗逻辑读出来的）

`qinlin/widgets/dialog/tip_dialog.dart` 里根据状态选弹窗，反汇编如下：

```asm
0x8323b8: cmp  w1, #2        ; Dart Smi 编码 → 实际值 1
0x8323bc: b.eq 成功
0x8323c0: cmp  w1, #6        ; → 实际值 3
0x8323c4: b.ne 其他
0x8323c8: r2 = "开门成功"
0x8323dc: tbnz w1, #4        ; bit4 ≈ 数值 8 的分界
0x8323e0: r1 = "远程开门失败"   ; state < 8
0x8323ec: r1 = "开门失败"       ; state >= 8
```

同一个 `bit4` 判断在另一处区分「门禁设备离线，您可以…」与「没有开门成功？您可以…」。

于是状态表是：

| openDoorState | 含义 | 代码判定 |
|---|---|---|
| **1** | 开门成功 | ✅ 成功 |
| **3** | 开门成功（门已处于开启状态） | ✅ 成功 |
| **7** | 门禁设备离线（远程开门失败） | ❌ 失败，走蓝牙兜底 |
| **≥8** | 其他失败 | ❌ 失败，走蓝牙兜底 |
| 0 / 2 / 其他 | 代码里没有分支，保守判失败 | ❌ |

**重要**：`code:0` 只是"请求被接受"，**不代表门开了**。之前用无效 id 探测得到的
`openDoorState: 7` 正是"门禁设备离线"，与接口不校验门是否存在的表现一致。

代码里已按这张表判定，失败时按原 App 策略转蓝牙；若该门 `hasBluetoothModule=false`
则明确提示"该门无蓝牙模块，无法兜底"，不再假装成功。

---

## 附八：界面结构（Tab 布局）

用 `TabView` + `Tab`（iOS 18+ API，d.ts 里已同步）。

```
未登录
└── 登录页（整页，没有 Tab）
    ├── 手机号 + 验证码
    ├── 免验证码登录（userId）
    ├── 已有会话（粘贴 sessionId）
    └── 日志

已登录
└── TabView
    ├── ① 开门   门禁列表 + 开门按钮 + 最近操作
    ├── ② 我的   手机号 / userId / 会话剩余 / 小区 ID / 校验 / 登出
    └── ③ 开发者  接口地址 / 签名参数 / 蓝牙 / 运行日志
```

设计取舍：

- **接口地址、签名盐、AES 密钥、额外请求头、蓝牙 UUID 全部收进「开发者」**，
  主界面只留开门动作，避免误改。
- `communityId` 也放在开发者里，但它是拉列表的必要参数。所以登录成功后如果它为空，
  会自动跳到「开发者」并提示先填，填完回「开门」页刷新即可。
- 「我的」页显示会话剩余时间（`sessionId` 30 分钟），到期由 `ensureSession()` 静默续期，
  用户不需要手动操作。
- 门禁列表第一项用 `star.fill` 标出（来自 `commonlyUsedDoor`），其余用 `door.left.hand.open`。

---

## 附九：隐藏短信登录 + 修掉「未配置接口地址」

### 手机号登录已从界面移除

发码接口 `member/sms/sendSecurityCode` 在网关通道上被前缀级 WAF 拦，纯 HTTP 无解，
所以这条路径在当前宿主里不可能走通。为避免误导，登录页只保留：

- **用 userId 登录**（唯一可用路径）
- **已有会话**（粘贴 sessionId 兜底）

`onLogin` / `onSendCode` 两个函数保留在代码里但不再暴露到界面 —— 如果将来拿到
WAF 请求头（`cfg.extraHeaders` 那套），把 Section 加回登录页即可复用。

### 「未配置接口地址」的原因

`openURL` 是后加的字段，而手机上 `Storage` 里存的是**旧版本配置**，没有这个 key，
读出来就是 `undefined`，于是报「未配置接口地址」。

修了两层：

1. `loadConfig()` 改为 `{ ...DEFAULT_CONFIG, ...saved }` —— 旧配置缺的字段自动用默认值补齐
2. `baseOf()` 再做一次兜底：`cfg.openURL || OPEN_BASE`

验证：构造一份完全没有 `openURL` / `communityId` / `baseURLGateway` 的旧配置对象，
合并后三个字段都拿到了默认值。

**你的配置不会被清掉**：`baseURL`、`communityId`、`userId` 等已填的值原样保留，
只在缺失时补默认。

---

## 附十：communityId 为何仍需手工提供 + 门禁接口改用 ByCache 版

### communityId 无法自动获取（已尽力验证）

需求是登录后自动拿到小区 ID。我把能想到的路都试了：

| 尝试 | 结果 |
|---|---|
| `h5/login` 返回的 `communitylist` | 恒为空数组；传 cityCode / includeCommunity 等参数也无效 |
| `userCommunity/getMyCommunityAccessInfo` 等 6 个路径（mobileapi） | 全部 404 |
| `user/v2/queryAllUserDoorByCache` 一族（mobileapi） | 全部 404 |
| `open-plugin/myCommunity/listApplyListGroupByCommunity`（两个域） | 404 |
| `community/v2/getListByCityCode` | 200 但 401，它要 app token 而非 h5 会话 |
| **qapp 通道的我的社区接口**（用还原的签名算法） | **签名通过了**（不再是 121），但仍 401 —— qapp 要 app token |
| `doorcontrol/queryUserDoor*` 不传 communityId | 500 `NumberFormatException`，且 `communityId=0` 返回空列表，说明它是精确过滤的必需项 |
| 广告接口 `ad/v2/request` | 免签可用，但响应只有广告投放配置，不含社区 |

死结在于：要 app token 就必须走验证码登录，而发码接口被 WAF 拦。

**所以只能一次性提供**。现在把你的 `communityId` 预置进 `DEFAULT_CONFIG`（值来自你给的广告 URL），
换小区时去「开发者」页改一次即可，之后永久记住。

> 顺带说明：用还原的签名算法去调 qapp 通道，**签名这一关已经过了**（错误从「签名算法版本不能为空」
> 变成「暂未登录」）。将来只要拿到 app token，qapp 的所有接口都能调。

### 门禁接口改用 `queryUserDoorByCache`

两个接口同参数，但返回字段不一致：

| 字段 | `doorcontrol/v2/queryUserDoor` | `doorcontrol/queryUserDoorByCache` |
|---|---|---|
| `online` | 无 | `online` / `offline` |
| `color`、`doorControlUsefor` | 无 | 有 |
| `hasBluetoothModule` | **全是 false** | **7 个门为 true**，仅 A座大堂 为 false |
| `commonlyUsedDoor` | B座大堂 | B座一楼后门 |

`hasBluetoothModule` 这个字段两版相反，`ByCache` 版字段更全、更像真值。
**因此蓝牙开门并非完全不可用**，只是仍缺 serviceUUID / writeCharUUID / 载荷格式（需抓包）。

代码已切到 `queryUserDoorByCache`，门禁行会显示「在线/离线」状态。

---

## 附十一：蓝牙协议细节 —— 并非服务端下发

之前说"UUID 需抓包/由服务端下发"，**这个判断是错的**。推翻它的依据：

`blue_key_tools.dart` 里 `Guid::toString()` 之后接 `_substringUnchecked`，
再与字面量 **"FFF0"** / **"FFF1"** 比较 —— 这是在扫描结果里匹配服务，
说明 UUID 是**代码里的协议约定值**，不是下发的配置。

完整链路（blue_key_tools.dart）：

```
FlutterBlue::openBluetooth
  → BluetoothDevice::connect
  → BluetoothDevice::discoverServices
  → Guid::toString() + substring 与 "FFF0" 匹配        ← 服务
  → Encryption::onHandleResult(...)                    ← 生成载荷
  → BluetoothCharacteristic::write(List<int>)           ← 写入
  → Encryption::onHandleResult 处理回执
```

`Encryption::onHandleResult` / `onEncrypt` 里的常量就是协议本体：

| 元素 | 值 | 含义 |
|---|---|---|
| `FA34DD0001` | 10 位 hex | 帧头 |
| `55AA5A5AA5` | 10 位 hex | 帧尾 / 魔数 |
| `FC26A` | 5 位 hex | 命令字 |
| `exclusiveOR` | — | XOR 混淆 |
| `resultKey` | — | `onEncrypt` 的产物，**本地生成**，非接口下发 |
| `FBC213C4C7BEEBD2AA4EDBF0F681C41B` | 32 hex | AES-128 密钥 |

因此 `DEFAULT_BLE_SETTINGS` 已预置：

```
serviceUUID  = 0000fff0-0000-1000-8000-00805f9b34fb
writeCharUUID= 0000fff1-0000-1000-8000-00805f9b34fb
payloadTemplate = FA34DD0001{doorControlId}55AA5A5AA5
```

`blue.ts` 的 UUID 匹配改成 `sameUuid()`：把两边都归一成 hex 核心（去掉 `0000` 前缀
与 `00805f9b34fb` 后缀）再比较，这样短格式 `FFF0` 和长格式都能匹配上。

### 仍未还原的部分

帧中间的**字节布局**（doorControlId 怎么编码、时间戳放哪、命令字 `FC26A` 如何参与
XOR）需要逐字节读 `onEncrypt` 才能确定。所以载荷模板目前是骨架，
`{doorControlId}` 占位符之外的字节还需实测校准。

---

## 附十二：蓝牙载荷帧结构（onEncrypt 完整还原）

上一节说"帧中间字节布局需实测"，**不对，代码里都有**。按调用顺序读 `onEncrypt`
（`Encryption.dart` 285~1184 行）得到完整结构：

### 构造顺序

```
1. 4× StringBase::+  拼接业务字段，每组后面接 DateTime._parts() 的分量
   （每处分量前都调 padLeft(2, "0") —— 参数是 "0" 和 2，标准日期格式化）
2. 追加帧尾 "55AA5A5AA5"
3. Flutter3desPlugin::encrypt(...)          ← 3DES 加密（不是 AES！）
4. startsWith("FC26A") 判断 + randomNumberWithCount 生成密钥串
5. _interpolate 拼帧头 "FA34DD0001" 与 "30"
6. hexToInt（0x?? 两位一转）→ List<int> → BluetoothCharacteristic::write
```

返回给调用方的是 `{ resultKey: <3DES 密文>, exclusiveOR: <XOR 值> }`，
`onHandleResult` 再把 `exclusiveOR` 补零到 32 位（`padLeft`）参与最终拼接。

### 帧结构

```
明文  = [字段A][pad2 日期分量][字段B][pad2 日期分量][字段C][pad2 日期分量][字段D][pad2 日期分量] + "55AA5A5AA5"
密文  = 3DES(明文)                      → resultKey
最终  = "FA34DD0001" + 密文 + "30" + exclusiveOR(32 位补零)
字节  = 按 "0x??" 解析成 List<int>，写入 FFF1 特征
```

### 与上一节的差别（修正）

| 项 | 之前说法 | 实际 |
|---|---|---|
| 加密算法 | AES-128-ECB | **3DES**（`flutter_3des_plugin`） |
| 帧格式 | 帧头+数据+帧尾 | 明文是「4 组字段+日期分量+帧尾」，3DES 后再加帧头 |
| `resultKey` | 待确认 | 3DES 密文 |
| `exclusiveOR` | 待确认 | XOR 值，padLeft(2,'0') 后参与最终串 |
| `FC26A` | 命令字 | 是 `startsWith` 判定的**密钥前缀**，配合 `randomNumberWithCount` 生成 |

### 仍待确认

明文里那 **4 个业务字段**分别是什么（doorControlId 怎么编码、时间戳取哪几个分量），
需要把 4 处 `StringBase::+` 的左操作数逐条对应到 `onHandleResult` 的入参。
这属于最后一层细节，不影响远程开门路径。

---

## 附十三：明文帧的字段构成（onEncrypt 最终还原）

顺着 `fp-0x18` 追（它在每步 `stur x0, [fp, #-0x18]` 被更新，是**累加串**，初值为函数入参 `dynamic _`），
4 处 `StringBase::+` 的结构就清楚了：

```
明文 = 入参 + pad2(日期分量) + pad2(日期分量) + … + "55AA5A5AA5"
        ↑ fp-0x18 累加        ↑ 每处追加 DateTime._parts() 的元素
```

- 每处拼接前都调 `padLeft(2, "0")`（参数是 `"0"` 和 `2`）
- `_parts()` 的边界检查长度是 **8**，而每处 `+` 会连续取 `field_b` / `field_23` 等两个分量
  ⇒ 4 处 × 2 = 8 个分量，正好覆盖 `_parts()` 的全部元素
- **入参就是业务数据**（`onHandleResult` 调用时传的是 doorControlId 相关的指令串）

### 完整流程

```
明文 = 指令串 + pad2(p1) + pad2(p2) + … + pad2(p8) + "55AA5A5AA5"
密文 = 3DES(明文)                                    ← Flutter3desPlugin::encrypt
最终 = "FA34DD0001" + 密文 + "30" + exclusiveOR(padLeft 到 32)
字节 = 按 "0x??" 两位转 int → List<int> → write 到 FFF1
```

### 一个实现层的硬约束

**Scripting 宿主的 Crypto 没有 3DES**（只有 md5/sha1/sha256/sha384/sha512 + AES-GCM），
所以 `flutter_3des_plugin` 这一步**无法直接调用**，必须自己用 TS 实现 3DES（或找宿主插件）。
密钥与 IV 需要从 `Flutter3desPlugin::encrypt` 的调用处确认（可能与 `FC26A` 前缀的随机串相关）。

### 仍未定死的细节

1. 8 个日期分量的**取值顺序**（哪几位是月/日/时/分/秒/微秒/星期/年积日）
2. `3DES` 的密钥与 IV（需读 `Flutter3desPlugin::encrypt` 的入参）
3. `exclusiveOR` 的确切计算方式

这三项不影响远程开门；蓝牙路径要真正可用，还需实现 3DES 并确认密钥来源。

---

## 附十四：3DES 已完整实现（纯 TS，零依赖）

之前说"Scripting 的 Crypto 没有 3DES，需要自己实现"——**现在实现了**，
`core/tripledes.ts`（约 300 行，无任何依赖）。

### 先纠正：这不是标准 3DES 用法

我下载了 `flutter_3des_plugin` 0.0.3 的源码（pub.dev archive），
读到 iOS 端 `JKEncrypt.m → encrypt3DesStr:key:` 的完整实现：

```objc
NSData *data = [self byteForHexString:dataHexString];     // 固定 8 字节，不足补零
NSData *key  = [self byte24ForHexString:
                 [NSString stringWithFormat:@"%@%@", keyHexString,
                  [keyHexString substringToIndex:16]]];   // key24 = keyHex + keyHex[0..16]

CCCrypt(kCCEncrypt,
        kCCAlgorithm3DES,
        kCCOptionECBMode | kCCOptionPKCS7Padding,          // ← ECB + PKCS7
        key.bytes, kCCKeySize3DES, nil,
        data.bytes, data.length,
        buffer, bufferSize, &movedBytes);

return [bufferData convertDataToHexStr];                   // 小写 hex 输出
```

| 项 | 值 |
|---|---|
| 算法 | DES-EDE3（`kCCAlgorithm3DES`） |
| 模式 | **ECB**（不是 CBC） |
| 填充 | **PKCS7** |
| 密钥 | `key24 = hexDecode24(keyHex + keyHex[0..16])`；keyHex 为 32 hex 时即 **K1\|\|K2\|\|K1** |
| 明文 | `hexDecode8(dataHex)` → **固定 8 字节**（不足补零，超出忽略） |
| 密文 | 16 字节（8 明文 + 8 PKCS7 填充块）→ 小写 hex |

原 App 传入的密钥是 `FBC213C4C7BEEBD2AA4EDBF0F681C41B`（32 hex），
于是 24 字节密钥 = `FBC213C4C7BEEBD2 AA4EDBF0F681C41B FBC213C4C7BEEBD2`。

### 验证：8/8 全部通过

| 用例 | 结果 |
|---|---|
| DES 单块加密 vs FIPS 46-3 向量（`133457799BBCDFF1`） | `85e813540f0ab405` ✅ |
| DES 单块解密（逆向量） | ✅ |
| 3DES-ECB 单块 vs Node `des-ede3-ecb` | ✅ |
| 3DES-ECB 单块解密 | ✅ |
| K1\|\|K2\|\|K1 密钥构造 | ✅ |
| `encrypt3DesHex`（PKCS7）vs Node `createCipheriv('des-ede3-ecb')` | ✅ |
| `decrypt3DesHex` 往返 | ✅ |
| 帧构造 `FA34DD0001 + 密文 + 30 + xor(32)` | 76 hex / 38 字节，结构正确 ✅ |

交叉验证基准是 **Node.js 内置 OpenSSL**（`crypto.createCipheriv('des-ede3-ecb', ...)`），
不是我自己对拍自己。

### 新增 API（`core/tripledes.ts`）

```ts
encrypt3DesHex(keyHex, dataHex)      // 与 Flutter3desPlugin.encrypt 完全一致
decrypt3DesHex(keyHex, ctHex)        // 逆操作，便于调试
deriveKey24(keyHex)                  // 密钥构造 K1||K2||K1
tripleDesEncryptBlock(key24, block8) // 通用 3DES 单块
tripleDesEcbEncrypt(key24, data)     // 通用 3DES-ECB-PKCS7（任意长度）
```

### 帧构造（`core/blue.ts`）

```ts
buildEncryptedFrame(keyHex, dataHex, xorHex?)
// → FA34DD0001 + 3DES密文 + 30 + xor(补零到 32)
```

### 仍未定死的三项

1. 明文里那 4 组「字段 + 日期分量」的**确切语义**（doorControlId 怎么编码）
2. `exclusiveOR` 的计算方式（现在默认全零）
3. `FC26A` 前缀随机串如何参与密钥生成

这三项不影响远程开门；蓝牙要真正跑通，还需确认业务数据的字节布局。

---

## 附十五：门禁列表排序 + 收藏（小组件按此顺序展示）

### 为什么单独存一份偏好

`queryUserDoorByCache` 每次同步都会把服务端顺序写进 `ql_doors`，用户拖出来的顺序会被直接冲掉。
所以排序和收藏落在 **`ql_door_prefs`**（`core/door_prefs.ts`）：

```ts
type DoorPrefs = { order: string[]; favorites: string[] }
```

同步门禁后调 `normalizePrefs(ids, prefs)`：已经消失的 id 剔除，新增的门禁接到未收藏组末尾。
App 和小组件（`widget_shared.syncDoors`）都走这一步，不会因为换小区/新增门禁漏项。

### 展示规则（App / 小组件 / AppIntent 共用 `arrangeDoors()`）

1. **收藏组在前**，组内按用户顺序
2. 未收藏组在后，组内按用户顺序
3. 从没记录过的新门禁排在未收藏组末尾，保持服务端给的相对顺序

### App 侧：新增「门禁」Tab

```
TabView
├── ① 开门    大圆钮（门禁菜单已按新顺序排列，★ 前缀标出收藏项）
├── ② 门禁    排序 + 收藏（本版新增）
├── ③ 日志
└── ④ 我的
```

- 每行左侧 ☆/★ 切换收藏，点一下立即置顶
- 右上角「编辑」进入系统拖拽模式，收藏组和未收藏组各自拖，不会互相串位
  （分成两个 `ForEach` 就是为了避免"拖过界又被弹回去"）
- 底部：同步门禁列表 / 恢复默认顺序（收藏保留）
- 每次改完都调 `Widget.reloadAll()`，小组件立刻跟着变

### 小组件侧

- 中尺寸取前 3 项、大尺寸取前 5 项，按 `arrangeDoors()` 的顺序依次展示
- 收藏项前有黄色 ★
- 小尺寸与锁屏（`accessoryRectangular` / `accessoryCircular`）显示**列表第一项**
  —— 也就是"第一个收藏"，这就是收藏的实务含义：把常用的钉到小组件上

### 验证

`core/door_prefs.ts` 是纯函数，用 stub `Storage`（写入后 `Object.freeze`，模拟运行时冻结对象）
跑了 13 项自测：空偏好、收藏置顶、取消收藏回落到末尾、两组内分别拖动、
存取往返、冻结对象不被污染、同步校正（删旧/加新）、新门禁落位、服务端顺序被用户顺序覆盖 —— 全部通过。
另外 `tsc --noEmit` 对 14 个文件零错误。

---

## 附十六：两个线上问题（排序后跳页 / 小组件点了没反应）

### 1. 拖动顺序或收藏后自动跳回「开门」页

三个原因叠在一起，全部堵掉：

| 原因 | 处理 |
|---|---|
| `commitPrefs` 里同步调 `Widget.reloadAll()` | 从交互路径里彻底移除，改成只由「刷新小组件」按钮显式触发 |
| `prefs` 存在 `App` 里，每次拖动/收藏都重渲染 `TabView` | 把整页拆成独立组件 `DoorListTab`，偏好由它自己从 `Storage` 读写，父组件不参与 |
| `tab` 只是 `useState(0)`，任何重挂载都回落到 0 | 当前 Tab 落盘到 `ql_tab`，重挂载后原地恢复 |

顺带：从小组件点进来（`?from=widget`）时强制落在「开门」页，符合直觉。

### 2. 小组件点击无反应、无反馈

**根因**：根容器 `<ZStack widgetURL={...}>` 把整块区域变成了「打开 App」的热区，内部 `Button` 的
`AppIntent` 被抢掉。官方交互小组件示例里从不这么写 —— 它是每一行包一个 `<Link url={...}>`。

改法：

- 删掉根级 `widgetURL`，打开 App 改由各视图里的 `<Link url={data.appURL}>` 负责
  （标题、门禁名字区域、锁屏视图都是 Link）
- 开门按钮保持独立 `Button intent={...}`，和 Link 是兄弟节点，两个热区互不干扰
- **补反馈**：中/大尺寸显示「最近一次结果 + 时间」，小尺寸在 30 分钟内点过也会显示一行
- Intent 入口先写一条 `[小组件] … 收到开门请求 · 门名`，再写结果。
  日志里有"收到"却没有结果 = 点击生效但请求卡住；两条都没有 = 按钮真没被点到，这条能直接分诊

验证：`tsc --noEmit` 零错误。真机行为（按钮热区、Link 跳转）只能在主屏幕确认。

---

## 附十七：小组件"少了前两个门禁 / 顺序不对"

**不是排序算错了，是小组件的时间线是旧快照。**

排查过程（也留个记录，免得下次又怀疑排序）：

1. `arrangeDoors()` 是纯函数，App 列表和小组件用的是**同一个**输入（`ql_doors` + `ql_door_prefs`），
   不存在"两边各算各的"。用 8 个门禁跑了全链路模拟：初次同步 / 收藏两个 / 拖动 / 删掉一个 / id 是 number
   的旧数据 —— 顺序全部符合预期，**没有任何一项被丢弃**。
2. 真正的原因在刷新时机：上一版为了修"拖动后跳回开门页"，把 `Widget.reloadAll()` 从交互路径里删掉了。
   WidgetKit 只会在时间线到期（30 分钟）或显式请求时重跑 `widget.tsx`，
   所以 App 里改了顺序、或者同步时 `commonlyUsedDoor` 被 `unshift` 到列表最前面（正好是最前两项），
   小组件还停在旧快照上 —— 看起来就是"前两个没了、顺序乱了"。

修法：

| 触发时机 | 行为 |
|---|---|
| App 退到后台（`AppEvents.scenePhase === "background"`）且有待推送的改动 | `Widget.reloadAll()`，用户正好要看桌面 |
| 点「刷新小组件」按钮 | 立即 `Widget.reloadAll()` |
| 小组件里点开门 / 同步 | Intent 内的 `Widget.reloadAll()`（原本就有） |

为什么不在改动的瞬间刷：拖动排序过程中刷会打断手势，也是上一版跳页的诱因之一。

顺带做了两件数据卫生：

- `arrangeDoors()` / `normalizePrefs()` 的 id 一律 `String()` 后比较 —— 旧数据里 `doorControlId`
  是 number 时，rank 全部 miss，排序会整体错位
- 新增 `healPrefs()`：启动时若发现 `order` 没覆盖全部门禁（早期版本只写"操作过的那个"），
  直接按服务端顺序整体重建，收藏保留。正常数据永远是全覆盖的，不会误伤

---

## 附十八：`ForEach.count is deprecated` 报错

运行时日志：

```
[ERROR] ForEach.count is deprecated, use ForEach.data instead
```

`count + itemBuilder` 那套已经废弃（还能跑，但会刷 ERROR）。门禁列表改成 data 模式：

```tsx
const favRows = useObservable<DoorListRow[]>(() => favList.map(makeRow))
const otherRows = useObservable<DoorListRow[]>(() => otherList.map(makeRow))

<ForEach data={favRows} editActions="move" builder={r => rowView(r)} />
```

data 模式没有 `onMove` 回调 —— 系统拖拽是**直接改 Observable 数组**的，所以：

1. 订阅两个 Observable，数组一变就把 `favIds + otherIds` 写回 `ql_door_prefs`
2. 写之前比对 Storage，内容一样就跳过，避免自己写自己
3. 外部变化（收藏开关 / 同步 / 选中项）用一个签名字符串判断，变了才 `setValue` 重建两个数组

兜底：`DoorListTab` 每次渲染把屏幕上的顺序写到模块级 `liveOrder`，
App 退到后台或点「刷新小组件」时先 `flushLiveOrder()` 落盘再刷新 —— 不完全赌框架的 Observable 回调。

（`editActions` 只给 `"move"`，所以不会出现滑动删除；拖动仍需点右上角「编辑」进编辑模式。）

---

## 附十九：小组件数据对不上时的排查（数据快照）

现象：App 里是 `A座大堂 / B座大堂 / B座一楼后门`，桌面小组件却是
`B座负一楼电梯 / B座大堂 / B座负一楼电梯（新）`，点「刷新小组件」也没变。

这类"两边数据完全不同"不能用排序逻辑解释（同一份 `ql_doors` + `ql_door_prefs` 经同一个
`arrangeDoors()` 出来必然一致），只能是**某一侧根本不是这份数据**。所以这版加了可验证的诊断：

### 1. `BUILD_TAG`

`core/protocol.ts` 里的 `BUILD_TAG`，每次改小组件相关代码都要动它。

### 2. 小组件渲染指纹 `ql_widget_diag`

`widget.tsx` 在 `Widget.present` **之前**写一条：

```ts
{ ts, count, ids, names, orderLen, faveLen, version: BUILD_TAG }
```

写在渲染前，所以即使出图阶段抛错，这条也会落盘。

### 3. App「我的 → 数据快照」

同屏对比三行：

```
App 读到     3 个   A座大堂 / B座大堂 / B座一楼后门
偏好顺序     3 项 · 收藏 0
小组件渲染   11/16 01:05 · 3 个   B座负一楼电梯 / ...
小组件版本   2026-11-16-a          ← 绿色=当前版本，橙色=旧代码
```

判读表：

| 看到什么 | 结论 | 怎么办 |
|---|---|---|
| 时间是几分钟前 | 小组件在跑，且读到的就是这份数据 | 数据真的在存储里不同，见下一行 |
| 时间不更新 / 显示"还没渲染过" | 桌面那个小组件**没在跑本脚本** | 长按删掉，重新从「亲邻开门工具」添加 |
| 版本号橙色 | 桌面跑的是旧代码 | 更新脚本后重新添加小组件 |
| 名称和 App 那行不同、时间却是新的 | 两个进程读到的不是同一份 Storage | 改走 App Group 文件通道 |

### 4. 顺手修的两个真问题

- **App 回前台会重读 `ql_doors`**：小组件里的「同步」也会写这个 key，App 不重读就会一直显示内存里的旧列表，看起来就像数据不一致
- **刷新改成三个 API 全打**：`reloadAll` + `reloadUserWidgets` + `reloadTestWidgets`，用户小组件与测试小组件是不同 kind，只打一个曾经出现过"就是不更新"
