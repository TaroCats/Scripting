# 设备激活记录

以下接口供开发者查询和撤销本人许可证的安装绑定，不暴露安装私钥，也不返回脚本解密密钥。

接收者在 App 中无需账号即可激活。每个安装有自己的身份，它不是硬件 UUID。调用前请从生成收据或许可证列表取得 `licenseID`。

## 查询绑定列表

`GET /licenses/{licenseID}/activations?limit=50&after={cursor}` 需要 `licenses:read`。

| 查询参数 | 约定 |
|---|---|
| `limit` | 可选，1–100 的整数，默认 50 |
| `after` | 可选，原样传入上一页的 `nextCursor` |

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222/activations?limit=50'
```

响应 — `200`：

```json
{"ok":true,"activations":[{"activationID":"33333333-3333-4333-8333-333333333333","installationID":"77777777-7777-4777-8777-777777777777","state":"active","generation":1,"createdAt":1792886400000}],"nextCursor":null}
```

| 字段 | 含义 |
|---|---|
| `activationID` | 用于撤销的绑定 ID |
| `installationID` | 安装身份，不是硬件标识 |
| `state` | `active` 或 `revoked` |
| `generation` | 绑定状态的修订号，不是设备数量 |
| `createdAt` | 首次绑定时间，Unix 毫秒 |

列表包含已撤销记录，按激活 ID 排序。持续翻页至 `nextCursor` 为 `null`。空数组表示此许可证没有列出的绑定。响应不包含原激活码、接收者私钥、授权凭证、设备名或硬件序列号。

## 撤销一个绑定

`POST /licenses/{licenseID}/activations/{activationID}/revoke` 需要 `licenses:write`，请求体必须是空 JSON 对象 `{}`。

```sh
curl --fail-with-body --silent --show-error \
  -X POST -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' --data '{}' \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222/activations/33333333-3333-4333-8333-333333333333/revoke'
```

响应 — `200`：

```json
{"ok":true,"activationID":"33333333-3333-4333-8333-333333333333","state":"revoked"}
```

可安全重复撤销。撤销会释放此绑定的有效设备名额，并阻止该绑定后续在线领取密钥，已撤销历史会保留。重新启用许可证不会恢复该绑定；同一已撤销安装不能简单地用旧激活码重新激活这个绑定。新的安装身份仍需有可用名额。

已交付的离线授权仍然可用，撤销不能删除接收者已获得的密钥。激活码泄露时，若要阻止其后续使用，应禁用许可证；只撤销一个绑定，不会阻止其他新安装在仍有名额时使用此码。

## 错误与范围

`400`：ID、分页不合法、未知字段或撤销请求体非空。`401 invalid_credential`：API 令牌无效/到期/已撤销。`403 insufficient_scope` 或 `developer_disabled`：权限或账号不可用。`404 license_not_found` 或 `activation_not_found`：当前开发者无法访问该对象，或绑定不属于此许可证。`429`：触发限流。`503 activation_api_disabled` 或服务故障：暂不可用。

接收者的激活挑战、证明确认及加密密钥更新由 App 完成。外部许可证管理工具不需要实现该协议、提交硬件标识或获取解密密钥。
