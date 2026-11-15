# 认证与 API 令牌

服务地址：`https://protected-api.scripting.fun/v1/protected`。

通过 HTTPS 正常验证证书，不要携带凭证跟随重定向。令牌只通过 `Authorization` 请求头发送：

```http
Authorization: Bearer <LICENSE_API_TOKEN>
Content-Type: application/json
```

JSON 响应通常包含 `ok: true` 或 `ok: false`。网关错误可能不是 JSON，应先检查 HTTP 状态。

## 领取与管理令牌

在 App 中通过 GitHub 登录，启用开发者身份，再打开“许可证 API 令牌”：

| 选项 | scopes | 可执行操作 |
|---|---|---|
| 许可证管理 | `licenses:read`、`licenses:write` | 查询许可证/绑定、生成或禁用许可证、撤销绑定 |
| 只读 | `licenses:read` | 查询许可证和绑定 |

令牌作用于该开发者名下全部脚本包，有效期为 30 天。不具备发布脚本、创建脚本包，以及创建/列出/撤销其他管理令牌的权限。有效令牌还可查询本人开发者资料及脚本包列表。

创建页仅完整展示一次令牌。复制内容只保留在当前设备，60 秒后失效；发送到 Mac 请主动使用“发送到自己的设备”。关闭页面不会撤销令牌，丢失后应撤销并重新创建。

服务器保存验证摘要，不保留可恢复的内容；App 列表只显示元数据。退出登录会清除 App 本地账号状态，已交付的管理令牌仍有效至到期或明确撤销。换令牌时，先创建新的、更新工具配置并验证，再撤销旧的。

## 查询自己的开发者资料

`GET /developers/me` 接受有效管理令牌，没有请求体或查询参数。

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/developers/me'
```

```json
{"ok":true,"developer":{"developerID":"44444444-4444-4444-8444-444444444444","githubID":"123456","githubLogin":"example-author","enabled":true,"createdAt":1792886400000}}
```

`developerID` 是稳定的 Scripting 身份。`githubID` 是以字符串表示的 GitHub 稳定数字身份，`githubLogin` 可变更。时间字段均为 Unix 毫秒。开发者被停用时返回 `403 developer_disabled`；令牌无效、到期或被撤销时返回 `401 invalid_credential`。

## App 账号管理接口

以下接口要求 App 私有会话凭证。外部工具使用从 App 领取的管理令牌，请勿提取 App 会话或 GitHub OAuth 令牌。

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/developer-tokens?limit=50&after=<cursor>` | 无请求体；`limit` 为 1–100，默认 50 | `200`，如下元数据分页 |
| POST | `/developer-tokens` | `{"scopes":["licenses:read","licenses:write"]}` | `201`，如下仅交付一次的凭证 |
| DELETE | `/developer-tokens/{credentialID}` | 无请求体 | `204`，空响应体 |

创建可选择任一或两个受支持权限，不接受重复、空权限列表或未知权限；省略 scopes 时默认为读写。每次请求创建一个新令牌，没有幂等重放或找回窗口。超时可能表示已创建：请刷新列表检查新记录，撤销不需要的令牌后再创建，不要自动撤销可能由另一台设备并发创建的记录。

元数据响应：

```json
{"ok":true,"credentials":[{"credentialID":"55555555-5555-4555-8555-555555555555","scopes":["licenses:read"],"createdAt":1792886400000,"expiresAt":1795478400000,"state":"active"}],"nextCursor":null}
```

`state` 为 `active`、`expired` 或 `revoked`，由服务器判断。列表包含历史记录，按创建时间从新到旧排列，同一时间以稳定 ID 排序。将 `nextCursor` 原样作为 `after` 传入，该游标属于本人的管理令牌列表。列表不返回令牌内容或摘要。

仅交付一次的创建响应：

```json
{"ok":true,"credential":{"credentialID":"55555555-5555-4555-8555-555555555555","token":"<API_TOKEN_SHOWN_ONCE>","kind":"management","scopes":["licenses:read","licenses:write"],"expiresAt":1795478400000}}
```

可重复 DELETE 同一个本人令牌；未知或他人 ID 返回 `404 credential_not_found`。管理令牌调用上述会话专用接口返回 `403 insufficient_scope`，到期会话返回 `401`。分页/权限参数错误返回 `400`，这些响应不会授予访问其他开发者记录的权限。
