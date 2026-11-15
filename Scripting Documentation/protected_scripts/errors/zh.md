# 错误处理与安全重试

## 处理响应

成功的 JSON 响应包含 `ok: true`。API 错误通常为：

```json
{"ok":false,"error":"invalid_credential"}
```

网关响应、错误的 JSON 或传输故障不一定符合此结构。请先检查 HTTP 状态，再解析响应体。撤销令牌成功的 `204` 没有 JSON 响应体。不要把认证头、激活码、完整生成结果或凭证导出文件写入日志。

| HTTP | 处理方式 |
|---|---|
| 400 | 修正请求，不要原样重试错误字段 |
| 401 | 更换到期/撤销令牌，或修正认证配置 |
| 403 | 检查权限和账号状态，重复请求不会取得权限 |
| 404 | 检查 ID、归属、服务地址和服务端版本，不要视为空列表 |
| 409 | 核对生成或授权状态，并检查错误码 |
| 429 | 等待并使用有上限、逐步增加的间隔，不要立即循环请求 |
| 500/502/503/504 或超时 | 结果可能不明，按对应操作的规则重试 |

`storage_unavailable`、`protected_api_disabled`、`activation_api_disabled` 可能表示服务问题。不要因为存储暂时不可用就更换令牌或重新生成客户许可证。

## 各操作的重试规则

- **GET 列表/资料：** 暂时故障可有限退避重试。分页游标原样传回，不能把查询失败当作成功的空列表。
- **POST 批量生成：** 所有重试必须保持相同脚本包、请求体和 `Idempotency-Key`，重放窗口为 10 分钟。`idempotency_payload_mismatch` 需要核对请求，`idempotency_result_expired` 需要核对原生成记录，都不代表可以自动换键再生成。
- **PATCH 许可证状态：** 可重复设置同一目标状态，之后检查返回的当前许可证。
- **POST 撤销绑定：** 可重复撤销同一个许可证/绑定，结果不明时不要换成其他绑定 ID。
- **POST 创建管理令牌：** 不要自动重试。明文仅交付一次，不能从列表找回；应先刷新 App 列表检查新增记录，再处理不确定的令牌。
- **DELETE 管理令牌：** 可重复撤销同一个本人令牌，`404 credential_not_found` 不代表可以改为操作其他令牌。

请设置有限次数和间隔。超时不能证明写入失败，应明确报告未解决的结果，而不是静默多生成许可证。

## TypeScript 单次请求封装

示例在自己的工具/服务器中使用标准 `fetch`，每次只发送一个请求，不记录秘密，也不隐式重试写入。`SCRIPTING_LICENSE_TOKEN` 应来自私有配置。

```ts
const base = "https://protected-api.scripting.fun/v1/protected"

async function licenseRequest(
  token: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: object; requestKey?: string } = {}
) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error("Invalid API path")
  }
  const response = await fetch(base + path, {
    method: options.method ?? "GET",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.requestKey ? { "Idempotency-Key": options.requestKey } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  })
  const text = await response.text()
  let result: any
  try { result = JSON.parse(text) } catch { throw new Error(`API HTTP ${response.status}`) }
  if (!response.ok || result?.ok !== true) {
    const knownErrors = new Set([
      "invalid_credential", "insufficient_scope", "developer_disabled",
      "invalid_body", "invalid_field", "invalid_id", "invalid_query", "invalid_state",
      "package_not_found", "license_not_found", "activation_not_found",
      "idempotency_key_required", "idempotency_payload_mismatch", "idempotency_result_expired",
      "rate_limited", "storage_unavailable", "protected_api_disabled", "activation_api_disabled"
    ])
    const code = knownErrors.has(result?.error) ? result.error : "unavailable"
    throw new Error(`API HTTP ${response.status}: ${code}`)
  }
  return result
}
```

批量生成时，请先确定订单/请求键，再把它与目标请求体、返回结果共同保存；不要在重试循环内部生成新键。激活码及导出的 API 凭证应保存在源码仓库和共享日志之外。

## 接入验证清单

使用自己的测试包和许可证，确认只读令牌不能生成/撤销、相同批次重放得到相同激活码、列表不泄露原激活码、不能访问无关脚本包/许可证、撤销 API 令牌后调用被拒绝，以及撤销设备释放名额而已交付的离线授权仍可使用。测试后撤销测试令牌，并禁用或核对自己创建的测试许可证。
