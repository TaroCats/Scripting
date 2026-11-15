# VPN HTTP API

可从其他 App、命令行工具或局域网设备调用。Scripting 扩展通过全局 [VPN JS API](../local_dev_vpn/) 使用同一服务，自动取得有效地址和密钥。App 脚本继续使用原生 VPN 服务。

## 配置与连接

在当前配置中加入以下设置，或在 **Network → 功能 → HTTP API** 中编辑：

```ini
[General]
http-api = examplekey@127.0.0.1:6171
http-api-tls = false
```

请将 `examplekey` 换成自己的密钥。密钥支持 1–256 个可见 ASCII 字符，不含空白、`@`、逗号、分号、`#`、`=`、方括号、引号和反斜杠。端口范围为 1–65535。无效或重复声明会被拒绝。省略 `http-api` 则关闭服务；`http-api-tls` 默认为 false。

连接 Scripting VPN 后，有效声明会自动生效。配置切换和更新会同步更新服务，移除声明会停止服务，无需再单独开启或应用参数。设置页保存会修改当前配置。远程配置保持只读，请修改源配置，或复制为本地配置后编辑。启用服务不会启动 VPN。

`127.0.0.1` 仅供本机访问；`0.0.0.0` 允许局域网访问，也可指定本机已分配的 IPv4 地址。使用 `0.0.0.0` 时，内置客户端连接 `127.0.0.1`，外部客户端使用本机 Wi-Fi 或以太网地址。暂不支持主机名或 IPv6 监听地址。

```sh
curl --http1.1 -H 'X-Key: examplekey' \
  http://127.0.0.1:6171/v1/outbound
```

HTTP 明文传输密钥。如需加密，将 `http-api-tls` 设为 true，通过“分享服务证书”导出 `server.pem` 并使用 HTTPS。独立服务证书包含 `localhost` 和回环地址。通过局域网连接时，保留证书主机名进行验证：

```sh
curl --http1.1 --cacert server.pem \
  --resolve localhost:6171:192.168.1.20 \
  -H 'Authorization: Bearer examplekey' \
  https://localhost:6171/v1/outbound
```

请替换示例 IP、端口和密钥。证书导出不含私钥或 MITM 证书。内置客户端固定验证服务证书及其回环身份，传输地址可以是配置中的本机地址；HTTPS 失败不会降级为 HTTP。

## 鉴权与隐私

所有端点使用同一个 API 密钥，通过 `X-Key` 或 `Authorization: Bearer` 二选一传入。URL 中的密钥会被拒绝。一个密钥同时允许读取和控制。修改并保存后，更新后的配置发布时，旧密钥对后续请求失效。

VPN 管理方法无需脚本权限授权。扩展要求 HTTP 服务已配置且 VPN 正在运行，键盘还需要“允许完全访问”。`VPN.localDevVPN` 和 RSD 保留独立访问规则，仅供 App 使用。

请妥善保管配置导出和密钥。普通配置导出包含声明的密钥；脱敏导出会省略 HTTP API 声明。API 响应只含名称、ID、状态和聚合指标，不含节点地址或凭据、订阅 URL、配置原文、文件路径、流量正文和私钥。不提供管理密钥、启停 VPN、展示配置面板、执行脚本或安装证书的 HTTP 端点。拒绝浏览器来源和 CORS 请求。

## 请求和响应

GET 用于读取，POST 修改时使用 `Content-Type: application/json`。成功响应为状态 200 和 JSON。不支持的参数和多余字段会被拒绝。每个选择器传入名称或 ID 二者之一。名称在当前配置中精确匹配，不存在或有歧义时拒绝。

节点、策略组和成员请使用对应列表最新返回的 ID。修改配置或重启服务可能使这些 ID 失效。扩展脚本使用 HTTP 的 ID，主 App 脚本使用当前脚本上下文的节点、策略组和成员 ID。

访问同一台 VPN 设备时，HTTP 客户端、App 脚本和扩展取得相同的脚本和模块 ID。活动配置、发布版本及条目修订相同时，脚本重跑或服务重启后仍可使用同一个 ID。写入或从使用会话 ID 的旧版升级后，请刷新对应列表。遇到 `stale` 时，重新读取列表并确认目标，再决定是否重试。

| 路由模式 | HTTP `mode` | JS `VPN.setRoutingMode` |
| --- | --- | --- |
| 规则 | `rule` | `rules` |
| 全局代理 | `proxy` | `global` |
| 直连 | `direct` | `direct` |

| 请求 | 输入 | JSON 响应 |
| --- | --- | --- |
| GET `/v1/status` | — | `status`、`active`、选中配置 ID/名称、`providerBundleId`、`effectiveConfigurationId`、`operation`、`problem`。 |
| GET `/v1/traffic/rate` | — | `{uploadBytesPerSecond, downloadBytesPerSecond}`；两次采样之间等待约 1.25 秒。无可用样本时为 `null`，有效空闲样本为零。 |
| GET `/v1/traffic/totals` | 可选 `period=session`（默认）或 `today`。 | `{uploadedBytes, downloadedBytes, incomplete}` 或 `null`；今日使用设备日历和时区。 |
| GET `/v1/outbound` | — | `{mode}`：`direct`、`proxy`（全局代理）或 `rule`。 |
| POST `/v1/outbound` | `{mode, policy?}` 或 `{mode, nodeId?}`；只有 `proxy` 可带节点。 | `{mode}`；模式与可选节点一起保存。 |
| GET `/v1/outbound/global` | — | `{policy: 名称|null, id: ID|null}`，任意路由模式均可读取。 |
| POST `/v1/outbound/global` | `{policy: 名称}` 或 `{nodeId}`。 | `{policy, id}`；修改全局节点，保留路由模式。 |
| GET `/v1/policies` | — | `{proxies: [{id, name}]}`。 |
| POST `/v1/policies/test` | `{policy_names: [名称, …]}` 或 `{ids: [ID, …]}`，1–128 个节点。 | 测速结果数组；使用配置中的测试设置。 |
| GET `/v1/policy_groups` | — | `{policy_groups: [{id, name, selectable, members: [{id, name}]}]}`。 |
| GET `/v1/policy_groups/select` | 查询参数 `group_name` 或 `groupId`。 | `{policy: 名称|null, id: ID|null}`，仅手动选择组。 |
| POST `/v1/policy_groups/select` | `{group_name, policy}` 或 ID 选择器 `groupId`、`memberId`。 | 已保存直接成员的 `{policy, id}`。 |
| POST `/v1/policy_groups/update` | `group_name` 或 `groupId`，加 `patch`。 | 更新后的组 `{id, name}`。 |
| POST `/v1/policy_groups/test` | `{group_name}` 或 `{groupId}`。 | `{available: [可达名称], results: [测速结果]}`，至多 128 个直接成员。 |
| GET `/v1/scripting` | — | `[{id, name, status, editable, ownership, moduleId?}]`。 |
| POST `/v1/scripting` | `{ids: [ID, …], enabled: boolean}`，1–128 项。 | `null`；独立 Network 脚本的一次原子批量修改。 |
| GET `/v1/modules` | — | `{enabled: [名称], available: [名称], modules: [{id, name, status}]}`；`available` 表示已配置的模块，不表示下载或测速成功。 |
| POST `/v1/modules` | `{名称: boolean, …}`，或 `{ids: [ID, …], enabled: boolean}`，1–128 项。 | `null`；全部校验后一次原子保存。 |
| GET/POST `/v1/features/mitm` | POST：`{enabled: boolean}`。 | `{enabled}`；开启前需要已受信任的 MITM 证书。 |
| GET/POST `/v1/features/rewrite` | POST：`{enabled: boolean}`。 | 当前配置重写的 `{enabled}`。 |
| GET/POST `/v1/features/scripting` | POST：`{enabled: boolean}`。 | 设备级流量脚本开关的 `{enabled}`。 |
| GET/POST `/v1/features/capture` | POST：`{enabled: boolean}`。 | 新抓包记录的 `{enabled}`。 |

`selectable: true` 表示策略组支持手动选择成员。组补丁支持 `hidden`、`category`、`iconURL` 和 `noAlert`。传入 `null` 可清除字段。

脚本列表包含独立 Network 脚本和模块声明的脚本。`ownership` 为 `"standalone"`（独立脚本）或 `"module"`（模块脚本）。在同一配置修订下，模块脚本的 `moduleId` 与 `GET /v1/modules` 中所属模块的 ID 一致。独立脚本省略 `moduleId`。内容状态为 `enabled`、`disabled` 或 `unattached`。如需单独启停脚本，请筛选 `editable: true` 的条目。模块内脚本通过所属模块控制。远程子模块为只读。批量中含有只读或过期脚本 ID 时整批拒绝。库中的模块需要先关联配置才能启用。模块启停同样整批保存。

```sh
curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"Module A":true,"Module B":false}' \
  http://127.0.0.1:6171/v1/modules

curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"mode":"proxy","policy":"Node A"}' \
  http://127.0.0.1:6171/v1/outbound

curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"group_name":"Proxy","policy":"Node A"}' \
  http://127.0.0.1:6171/v1/policy_groups/select
```

每项测速结果为 `{id, name, status, latencyMs, metric}`。状态为 `reachable`、`failed`、`unavailable` 或 `skipped`；延迟单位为毫秒，也可能是 `null`。指标为 `warm_http_response_head`、`warm_https_response_head` 或 `cold_http_response_head_fallback`。测速成功与当前组选择相互独立。

## 错误和限制

HTTP 错误为 `{error:{code,message}}`。请按 `code` 处理，`message` 仅供说明。

| 状态 | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `invalidRequest` | HTTP 格式、方法或 JSON 无效，包括同时发送两个鉴权头或把 Key 放在 URL 中。 |
| 400 | `invalidInput` | 接口参数、字段或选择器值无效。 |
| 403 | `accessDenied` | 缺少 Key、Key 错误，或监听器已撤销对此请求的授权。 |
| 403 | `readOnly` | 内容不支持该项修改。 |
| 404 | `unsupported` | 未知接口。 |
| 409 | `stale`、`busy`、`notSelectable` | 引用失效、已有测速进行，或策略组不支持手动选择。 |
| 413 | `requestTooLarge` | 超出 HTTP 请求大小限制。 |
| 500 | `invalidResponse` | 服务生成了无效响应。 |
| 503 | `unavailable`、`writeFailed`、`conflict` 等操作错误 | 操作未能完成，具体原因见错误码。 |

旧版可能没有 `editable` 和 `selectable` 字段，缺 Key 时可能返回 `400 invalidRequest`，`readOnly` 和 `notSelectable` 可能返回 503。扩展 JS 调用通过 Promise reject 报告错误，包括超时和完全访问限制。服务停止时客户端收到连接错误。

请求使用 HTTP/1.1，每连接一个请求。头部不超过 16 KiB，POST 正文不超过 64 KiB，批量不超过 128 项。响应上限 1 MiB，服务最多同时处理 8 项请求。不支持流水线、分块请求、WebSocket 升级、重定向和浏览器来源访问。

本机串行调用 `GET /v1/traffic/rate` 实测约 1.4 秒。设置客户端超时时，请为采样间隔、样本读取和请求处理留出时间。

请求超时或取消时，修改可能已经生效。例如，提交 `POST /v1/features/rewrite` 和 `{"enabled":false}` 后超时，请先调用 `GET /v1/features/rewrite`。若已返回 `{"enabled":false}`，目标状态已设置。否则再决定是否重试，并重新读取写入所需的 ID。测速请求耗时包含准备与执行。比较节点延迟时，使用相同 `metric` 下的 `latencyMs`。
