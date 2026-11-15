# 已发布脚本包

`GET /packages` 查询当前认证开发者名下的脚本包身份。只读或许可证管理令牌均可调用。脚本包由 App 发布时创建，生成许可证不会发布脚本。

## 请求

不需要请求体或查询参数。

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${SCRIPTING_LICENSE_TOKEN}" \
  'https://protected-api.scripting.fun/v1/protected/packages'
```

## 响应 — 200

```json
{"ok":true,"packages":[{"packageID":"11111111-1111-4111-8111-111111111111","name":"My Protected Script","createdAt":1792886400000}]}
```

| 字段 | 含义 |
|---|---|
| `packageID` | 标识已发布脚本及其许可证的稳定 UUID |
| `name` | 创建该脚本包时记录的名称 |
| `createdAt` | 创建时间，Unix 毫秒 |

空 `packages` 数组是正常结果。当前接口按 ID 排序，最多返回 100 个脚本包，没有分页游标。请在自己的记录中保存包 ID；账号超过该上限时，此响应不代表完整导出。接口不返回脚本文件、版本解密密钥、激活码或发布私钥。

## 脚本包、版本和许可证

- 脚本包代表一个已发布脚本。同一现有项目发布映射的多次发布，会在同一个脚本包下创建版本。
- 版本代表某次发布的加密内容。接收者导入该文件，许可证 API 不负责交付脚本文件。
- 许可证属于一个脚本包。其他脚本包的激活码不能用于当前脚本包。
- 同一脚本包的有效版本共用包级许可，批量生成接口没有按版本范围授权的参数。

将这里返回的包 ID 用于 `/packages/{packageID}/licenses` 和 `/packages/{packageID}/licenses/batch`，不要使用版本 ID、开发者 ID 或显示名称替代。

## 错误

`401 invalid_credential`：令牌缺失、无效、到期或已撤销。`403 developer_disabled`：开发者账号被停用。存储或服务异常可能返回 `503`，处理方式见“错误处理与安全重试”。令牌不能列出其他开发者的脚本包。

发布公钥登记和加密版本登记由 App 使用内部会话及发布者证明完成，外部管理令牌不能执行这些发布操作。
