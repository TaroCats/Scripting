# Node API 兼容性与导入说明

Scripting 在 JavaScriptCore 上提供 Node 兼容层。本文列出实际注册的内置模块、可用 API 子集与限制。App Shell 中的 `node` 命令也使用这个环境，不会启动桌面版 Node 可执行文件。`process.version` / `process.versions.node` 是兼容基线，不代表完整支持对应版本。小组件、键盘、Safari、隔离 `vm` context 的能力可能不同；本文链接的网络示例面向 App 普通脚本。

## 应该从哪里导入

| 来源 | 例子 | 使用方式 |
| --- | --- | --- |
| Node 内置模块 | `node:net`、`node:tls`、`node:crypto`、`node:buffer`、`node:timers/promises` | `import { createServer } from "node:net"` 或 `require("node:net")`；无需 npm 安装 |
| 运行时全局对象/函数 | `crypto`、`Buffer`、`process`、`console`、`TextEncoder`、`TextDecoder`、`AbortController`、`setTimeout`、`setInterval`、`setImmediate`、`clearTimeout`、`clearInterval`、`clearImmediate`、`queueMicrotask`、`Bonjour` | 直接使用，无需 import；Bonjour 网络操作需要 App 完整运行时 |
| Scripting SDK 导出 | `Script`、`Text`、`VStack` | 按各自文档从 `"scripting"` 导入；Node 模块和 WebCrypto 不从这里导入 |
| 第三方 npm 包 | 已安装的包及其依赖 | 先用 Scripting npm 工具安装，再按真实包名导入 |

已注册内置模块的 `"net"` 与 `"node:net"` 指向同一模块。子路径需要单独注册：支持 `"stream"` 不代表支持 `"stream/web"`。ES import 和 CommonJS require 都可使用，但模块经过宿主转译后采用 CommonJS 风格加载，不是完整的 Node 原生 ESM 加载器。入口脚本支持顶层 await，任意被 require 的模块不支持模块顶层 await。

下方链接的新 API 页中，每个代码块都是独立的 App 普通脚本，导入写在顶部，异步示例会等待工作结束。过早调用 `Script.exit()` 会关闭脚本自有资源并取消定时器。

### 只用内置模块的完整示例

无需安装包、启动服务器或准备文件。短暂延时后输出 `hello` 及其 SHA-256 十六进制摘要。

```ts
import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"

// process 和 console 是全局对象，不从 scripting 导入。
const message = Buffer.from("hello", "utf8")
await sleep(10)
console.log(message.toString("utf8"))
console.log(createHash("sha256").update(message.toString("utf8")).digest("hex"))
console.log(process.version, process.platform, process.cwd())
```

## 有实际功能的模块与 API 子集

“子集”表示下列操作可用，同时遵循本页及详细文档的限制，不代表完整兼容最新版 Node。表中的模块名均可加 `node:` 前缀。

| 模块 | 支持入口 / 用途 | 主要限制与详细说明 |
| --- | --- | --- |
| `assert` | 断言、相等/深度比较、通过 `.strict` 使用严格断言 | 浏览器兼容实现；未单独注册 `assert/strict` |
| `buffer` | `Buffer.from/alloc/concat/isBuffer`、编码、字节视图 | 同时提供全局 Buffer；与 Data API 不同 |
| `string_decoder` | StringDecoder.write/end，分段文本解码 | 基于 JavaScript Buffer 的实现 |
| `events` | EventEmitter 的 on/once/off/emit、监听器管理 | JavaScript 事件机制，不是系统事件服务 |
| `path` | POSIX join/resolve/dirname/basename/extname/relative 等 | 路径计算不授予文件访问权限；未注册 path/posix、path/win32 子路径 |
| `url`、`querystring`、`punycode` | URL/查询串解析与格式化、punycode 转换 | 浏览器兼容实现；另有全局 URL/URLSearchParams |
| `util`、`util/types` | 格式化/inspect、promisify/callbackify、类型判断、styleText | styleText 格式化不会创建真实 TTY；不覆盖所有新版 Node 工具函数 |
| `stream` | Readable/Writable/Duplex/Transform/PassThrough、pipe、回调 pipeline/finished | JS 流实现，不等于系统流句柄或完整 Web Streams 互操作 |
| `stream/promises` | Promise 版 pipeline/finished | 基于当前 JS 流；不保证全部新版 Node 重载 |
| `stream/consumers` | buffer/text/json/arrayBuffer/blob 消费流 | blob 还需当前环境有全局 Blob；未注册 stream/web |
| `crypto` | Hash/HMAC/PBKDF2、随机字节、支持的 AES/签名辅助方法、webcrypto | 浏览器兼容 Node crypto 子集与 Scripting WebCrypto，不保证全部 Node 算法或 KeyObject 功能 |
| `zlib` | gzip/gunzip/deflate/inflate 与 raw 变体，sync/回调/stream 形式 | 纯 JS 压缩，不支持 Brotli、Zstd |
| `fs`、`fs/promises` | 文件读写、目录、stats、逻辑文件句柄、流、opendir/Dir | 遵循沙箱与宿主权限。回调/Promise 可能封装同步工作，不保证后台线程 I/O。watch 不监听真实变更，chmod/chown/时间设置含兼容空操作 |
| `os` | homedir/tmpdir、CPU 数量、内存、uptime 与系统信息 | homedir 对应 App 文档目录，freemem 为 App 可用内存；逐核速度/时间及部分 Unix 字段为占位 |
| `http` | request/get、请求响应事件、缓冲式 createServer 适配器 | 服务端依赖 Scripting HttpServer；缓冲请求/响应，Agent/socket 字段简化，不提供 Node 原始 Socket/upgrade 契约 |
| `https` | request/get，使用系统 HTTPS 网络栈 | https.createServer 共享 HTTP 适配器，**不会配置证书 TLS**；需要托管 HTTPS 时使用 Scripting 独立 HttpServer TLS API |
| `net` | TCP Socket/connect/createConnection、流、Server/createServer、数字 IPv4/IPv6 监听 | 服务端需 App 主 context，有资源上限，无 Unix Socket/UDP/cluster。[完整回显示例](../node_tcp/zh.md) |
| `tls` | 验证证书的 TLS 客户端 connect、secureConnect、流、SNI/ALPN/自定义 CA | 无 TLS 服务端、STARTTLS/Socket 包装、PSK 或跳过证书验证。[完整 HTTPS 示例](../node_tls/zh.md) |
| `timers`、`timers/promises` | Timeout/Immediate handle、可取消延时、异步 interval、scheduler.wait/yield | 全局定时器返回数字，模块定时器返回 handle；不保证实时性或 iOS 后台持续运行。[完整示例](../script_timers/zh.md) |
| `process` | 全局元数据/env/argv/cwd、nextTick、hrtime，宿主提供的 Shell I/O 适配 | 不管理系统进程；nextTick 使用 JSC 微任务队列，不是 V8 的独立优先队列 |
| `vm` | Script、createContext/isContext、runInContext/runInNewContext/runInThisContext | 同一 VM 内隔离全局作用域，不是安全边界或 Worker；不支持 compileFunction |
| `module` | createRequire，按文件位置解析依赖及使用缓存 | 最小加载辅助；builtinModules 不是完整能力清单 |
| `console`、`constants` | 宿主日志、兼容常量 | 不提供真实终端，Unix 常量不代表对应系统操作可用 |

大写全局 `Crypto` 使用 Scripting Data，小写全局 `crypto` 是 WebCrypto。HKDF 与显式 ChaCha20-Poly1305 扩展应通过 `crypto.subtle` / `crypto.chacha20Poly1305` 使用，或从 node:crypto 导入 webcrypto；不要据此推断存在 `createCipheriv("chacha20-poly1305", ...)` 或 Node hkdfSync。见 [HKDF/ChaCha](../crypto_hkdf_chacha/zh.md)、[Curve25519](../web_crypto/zh.md)。

Bonjour 是 Scripting 全局 API，不是 Node 内置模块，见[发布/浏览/解析完整示例](../bonjour/zh.md)。web-globals 是内部提供全局对象的辅助资源，脚本直接使用已文档化的全局 API 即可。

## 能加载但主要用于兼容探测的占位模块

这些模块可被导入，让包的可选依赖路径有机会继续执行；**能导入不代表有真实功能**。有些调用会抛错，有些只返回空值或不产生实际效果。

| 模块 | 实际行为 |
| --- | --- |
| `dns` | lookup 返回错误，查询/Resolver 不执行真实 DNS。原生 TCP/HTTP/TLS 仍会自行解析主机名。dns/promises 未独立注册，require("dns").promises 也只是占位 |
| `http2` | session/connect/server 方法抛错，constants/settings 为占位值；没有 Node HTTP/2 session API |
| `child_process` | spawn/exec/execFile/fork 及 sync 形式抛错，不创建子进程 |
| `cluster` | 单进程标志与管理空操作，fork 抛错 |
| `worker_threads` | 主线程标志；构造 Worker 抛错，MessageChannel/MessagePort 是占位 |
| `async_hooks` | hook 无实际效果；AsyncLocalStorage 会调用回调，但不传播 store，getStore 返回 undefined |
| `diagnostics_channel` | 无真实订阅/发布，tracing 包装直接调用传入函数 |
| `perf_hooks` | 基本计时；观察器/entries 主要为占位，不采集完整 PerformanceObserver 记录 |
| `tty` | isatty 为 false；ReadStream/WriteStream 为占位 |
| `readline`、`readline/promises` | 不读取交互式终端输入；回调 question 不收到用户输入，Promise question 返回空字符串。App 弹窗使用全局 Dialog |
| `v8` | 部分空值/默认值，序列化、堆快照等 V8 操作抛错 |

`dgram`、`inspector`、`repl`、`wasi` 在加载时拒绝。其他未注册的 Node 名称和内部模块也不支持，包括 domain、sys、trace_events、inspector/promises、assert/strict、path/posix、path/win32、stream/web。解析器保留了名称或编辑器出现补全，都不能当作已有实现。

## 第三方 npm 包如何判断能否运行

可通过“工具 → npm 包”或在 App Shell 执行 `npm install <真实包名>` 安装。解析、格式化、校验和数据处理等纯 JavaScript 包，在依赖都使用上表实际能力时通常适合。兼容性取决于**包版本、依赖树和实际执行路径**，没有通用的 npm 全版本白名单。仅 import/require 成功不能证明网络、子进程或原生路径可用。

采用一个包前：

1. 核对直接和间接依赖使用的 Node 模块，尤其是占位表。真正依赖 AsyncLocalStorage 上下文、DNS 查询、Worker 或子进程的路径需要替代实现。
2. 优先选择纯 JS 分发。`.node` 原生扩展、下载的可执行文件、浏览器自动化引擎和系统构建工具无法通过兼容层运行。
3. 依赖安装的 preinstall/install/postinstall/prepare 脚本会跳过，optionalDependencies 不自动安装；安装成功可能仍缺少可选原生功能。
4. 实际执行目标操作，检查响应/结果、错误处理和清理；不要只验证 require 成功、版本号匹配或 typeof fn 为 function。
5. 继续遵循网络/文件授权和 iOS 前后台限制；第三方包不会获得宿主脚本没有的能力。

完整调用签名请以 App 随附 TypeScript 声明与详细 API 页为准。本文描述 Scripting 的实际实现，不承诺桌面 Node 文档中的全部接口。
