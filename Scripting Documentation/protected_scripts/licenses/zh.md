# 许可证与激活码

使用服务地址 `https://protected-api.scripting.fun/v1/protected` 和许可证 API Bearer 令牌。以下 ID 均为 UUID，不接受未知请求字段；时间戳单位为 Unix 毫秒。

## 批量生成

`POST /packages/{packageID}/licenses/batch` 需要 `licenses:write`。

| 请求体字段 | 必填 | 约定 |
|---|---|---|
| `count` | 是 | 1–100 的整数，生成的许可证/激活码数量 |
| `deviceLimit` | 是 | 1–100 的整数，每张许可证允许的有效安装绑定数量 |
| `externalReference` | 否 | 非空字符串，最多 128 个 UTF-8 字节，用于自己的订单/客户标识；不用时省略 |

必须提供 `Idempotency-Key` 请求头，由字母、数字、`.`、`_`、`:`、`-` 组成，长度 8–128。它标识一次生成请求，在同一开发者的所有批次中唯一，包括不同脚本包。

```sh
umask 077
SCRIPTING_LICENSE_RESULT="$(mktemp "${TMPDIR:-/tmp}/scripting-licenses.XXXXXX")"
SCRIPTING_PACKAGE_ID='11111111-1111-4111-8111-111111111111'
curl --fail-with-body --silent --show-error \
  -X POST \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: order-20261025-001' \
  --data '{"count":2,"deviceLimit":1,"externalReference":"order-001"}' \
  --output "${SCRIPTING_LICENSE_RESULT}" \
  "https://protected-api.scripting.fun/v1/protected/packages/${SCRIPTING_PACKAGE_ID}/licenses/batch"
printf 'Response file: %s\n' "${SCRIPTING_LICENSE_RESULT}"
```

命令为本次尝试创建新的私有临时响应文件，不会覆盖之前的收据。请检查 HTTP/错误状态，在临时文件被清理前，把成功结果安全转存到订单系统或持久私有存储。其中含有激活码，不要提交或记录到日志。只有真正的新订单/新批次才使用新请求键，不要用新键来恢复结果不明的请求。

### 响应 — 新批次 201，有效重放 200

```json
{"ok":true,"packageID":"11111111-1111-4111-8111-111111111111","licenses":[{"licenseID":"22222222-2222-4222-8222-222222222222","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…ABCD","externalReference":"order-001","createdAt":1792886400000,"activationCode":"<FIRST_ACTIVATION_CODE>"},{"licenseID":"66666666-6666-4666-8666-666666666666","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…EFGH","externalReference":"order-001","createdAt":1792886400000,"activationCode":"<SECOND_ACTIVATION_CODE>"}],"replayed":false,"resultExpiresAt":1792887000000}
```

批次具有原子性，成功时会生成请求数量的全部许可证。`activationCode` 是接收者的秘密，与 API 令牌不同，不应发给错误的接收者。`codeHint` 只是最后四个字符的提示，不能用于激活。未提供的 `externalReference` 返回 `null`。

### 幂等与激活码找回窗口

10 分钟内，同一开发者以相同脚本包、请求体和请求键重试，会返回原激活码，并标记 `replayed: true`，服务重启后也一样。相同键换成其他请求体或脚本包，返回 `409 idempotency_payload_mismatch`；超过窗口返回 `409 idempotency_result_expired`，不会用该键再生成一批。列表不能找回原激活码，请在分发之前保存原始结果。

重放返回原始生成收据，不代表许可证当前状态，也不会重新启用之后被禁用的许可证。当前状态应通过列表查询。结果不明时，请结合已保存收据和列表核对，不要自动换键生成重复许可证。

## 查询许可证列表

`GET /packages/{packageID}/licenses?limit=50&after={cursor}` 需要 `licenses:read`。

- `limit`：可选的 1–100 整数，默认 50。
- `after`：上一页返回的游标，原样传入。
- 不支持其他查询参数。按许可证 ID 排序，而非创建时间。

```json
{"ok":true,"licenses":[{"licenseID":"22222222-2222-4222-8222-222222222222","packageID":"11111111-1111-4111-8111-111111111111","state":"active","deviceLimit":1,"codeHint":"…ABCD","externalReference":"order-001","createdAt":1792886400000}],"nextCursor":null}
```

持续翻页，直到 `nextCursor` 为 `null`。列表包含有效和禁用的许可证，不返回 `activationCode` 或验证摘要。目前没有按订单标识过滤的查询参数。

## 禁用或重新启用许可证

`PATCH /licenses/{licenseID}` 需要 `licenses:write`，请求体只能是 `{"state":"disabled"}` 或 `{"state":"active"}`。

```sh
curl --fail-with-body --silent --show-error \
  -X PATCH -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  -H 'Content-Type: application/json' --data '{"state":"disabled"}' \
  'https://protected-api.scripting.fun/v1/protected/licenses/22222222-2222-4222-8222-222222222222'
```

成功返回 `200` 和 `{"ok":true,"license":{...}}`，`license` 字段与列表项一致，不含原激活码。可安全重复设置相同状态。重新启用许可证不会恢复单独被撤销的设备绑定。

禁用后会阻止后续在线激活和密钥发放，无法收回已交付的密钥或离线授权。该接口不会变更设备数限制或激活码。此版本没有硬删除、查询原激活码或修改设备上限的接口。

## 错误

| HTTP / error | 含义 |
|---|---|
| 400 `invalid_body`、`invalid_field`、`invalid_id`、`invalid_query`、`invalid_state` | 字段、ID、查询或状态不合法 |
| 400 `idempotency_key_required` | 批量请求键缺失或不合法 |
| 401 `invalid_credential` | 令牌缺失、到期、撤销或无效 |
| 403 `insufficient_scope`、`developer_disabled` | 权限不足或开发者被停用 |
| 404 `package_not_found`、`license_not_found` | 当前开发者无法访问该对象 |
| 409 `idempotency_payload_mismatch`、`idempotency_result_expired` | 需要核对原批次，不能静默生成新批次 |
| 429 / 503 | 触发限流或服务暂不可用，应保持相同批量请求键/请求体并有限重试 |
