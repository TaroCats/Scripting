# 远程更新 HTTP API

基础地址：`https://push.scripting.fun/v1/remote-updates`。请求携带 `Authorization: Bearer <credential>` 和 `Content-Type: application/json`。日期采用 UTC ISO 8601，JSON 字段采用 snake_case。

## 凭据

主密钥管理目标和发送密钥，不能直接启动、更新或刷新目标；允许不带新状态的结束清理。旧普通通知子密钥不能调用这些接口。

通过主密钥调用 `POST /sender-keys` 创建发送密钥：传入 `targets`（明确的目标 ID）、`actions`（下表动作）、可选 `created_from`（启动目标 ID）和 `idempotency_key`。响应包含 `id`、`credential`、`expires_at`，请安全保存凭据。`created_from` 只覆盖该发送密钥自己创建的活动。主密钥可通过 `GET /sender-keys` 查看元数据，通过 `DELETE /sender-keys/:id` 撤销密钥。

也可在远程更新页面对目标执行“创建发送密钥”并复制。不要将主密钥放入小组件代码或业务状态。

## 发送接口

| 方法和路径 | 所需动作 | 请求体 |
|---|---|---|
| GET `/widget-targets/:id/state` | `widgets:read-state` | — |
| PUT `/widget-targets/:id/state` | `widgets:write-state` | `state`、`expected_revision`、`idempotency_key`；可选 `source_version`、`expires_at` |
| POST `/widget-targets/:id/reload` | `widgets:reload` | `idempotency_key`；可选 `expires_at` |
| POST `/start-targets/:id/start` | `activities:start` | `template_version`、`state`、`alert: {title,body}`、`idempotency_key`；可选 `business_key`、`business_generation`、`priority`、`stale_at`、`relevance_score`、`expires_at` |
| GET `/activities/:id/state` | `activities:read-state` | — |
| POST `/activities/:id/update` | `activities:update` | `state`、`expected_revision`、`idempotency_key`；可选 `source_version`、`stale_at`、`relevance_score`、`priority`、`alert`、`expires_at` |
| POST `/activities/:id/end` | `activities:end` | `idempotency_key`；可选 `state`、`expected_revision`、`dismiss_at`、`expires_at` |

提供新结束状态时必须带 `expected_revision`；省略状态表示用最后已提交状态结束。`priority` 为 `normal` 或 `high`，`relevance_score` 为 0–1。投递期限默认五分钟，最长为未来 24 小时。

## 响应与查询

成功 JSON 响应为 `{ok:true,data,timestamp}`。发送返回 HTTP 202，data 为 `{target_id,state_revision,state_committed,launch_request_id?,operation}`。快照包含 `target_id`、`has_state`、`state`、`revision`。GET state 支持 `ETag` / `If-None-Match`，可能返回无响应体的 HTTP 304。

- GET `/operations/:id`：查询操作状态、等待原因、错误和可用的传输 ID。
- GET `/widget-targets`、`/activities`、`/start-targets`：分页元数据（`items`、`next_cursor`），用 `cursor` 请求下一页。可选筛选 `installation_id`、`script_binding_id`；活动另支持 `business_key`、`business_generation`、`lifecycle`。
- GET `/<collection>/:id`：目标元数据。主密钥可查询管理元数据，发送密钥只可读取其权限范围。
- PUT `/<collection>/:id/settings`：主密钥管理，传 `expected_revision` 和可选 `paused`、`alias`（最多 128 个 UTF-16 单元，null 清空）。DELETE `/<collection>/:id` 撤销目标。
- POST `/widget-targets/batch` 或 `/activities/batch`：`{items:[{target_id,action,...}]}`，1–50 项。小组件动作为 `update` / `reload`，活动为 `update` / `end`。逐项检查 `ok`、`http_status` 和回执或错误，允许部分成功。
- GET `/capabilities`：查询协议功能和限制，不代表设备已经就绪。

设置接口使用目标元数据的 `registration_revision` 作为 `expected_revision`；状态写入使用快照的 `revision`。创建发送密钥最多接收 100 个目标 ID 和 100 个 `created_from` ID。

活动元数据可包含 `render_report`：`status` 为 `notReported`、`snapshotBuilt` 或 `snapshotFailed`；已有结果还包含 `stage`、`template_version`、`state_revision`、`received_at`（Unix 毫秒）和 `current`。报告七天后过期，描述原生快照构建结果，不代表系统显示或投递完成。只有原生设备凭据可以上报；受限发送凭据需有 `activities:read-state` 才能读取。报告不改变业务状态、生命周期或额度。

## 最简测试：启动、更新和结束

先准备 [Live Activity 文档](scripting://doc?title=Live%20Activity%20Remote%20Updates)中的两个接收端文件。在远程更新中选择启动目标，创建包含启动、读取状态、更新和结束权限的发送凭据，并包含该凭据创建的活动。在电脑或服务器上将以下代码保存为 `live-activity-test.mjs`（Node.js 18+）。

<!-- example: live-activity-test.mjs -->
```js
// Node.js 18+. Use a scoped sender key, never a master key.
import {readFile, writeFile, rename, open, unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base = process.env.SCRIPTING_PUSH_BASE_URL || 'https://push.scripting.fun';
const key = process.env.SCRIPTING_REMOTE_SENDER_KEY;
const startTargetId = process.env.SCRIPTING_START_TARGET_ID;
const templateVersion = process.env.SCRIPTING_TEMPLATE_VERSION;
const file = process.env.SCRIPTING_REMOTE_TEST_FILE || './remote-activity-test.json';
const action = process.argv[2] || 'status';
const message = process.argv[3] || 'Updated from server';
if (!key || !startTargetId || !templateVersion) throw Error('Configure sender key, start target ID and template version');
if (!['start', 'status', 'update', 'end'].includes(action)) throw Error('Use start, status, update or end');
const lock = await open(file + '.lock', 'wx', 0o600);
try {
let saved;
try { saved = JSON.parse(await readFile(file, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
saved ||= {base, startTargetId, templateVersion, requests: {}, receipts: {}};
if (saved.base !== base || saved.startTargetId !== startTargetId || saved.templateVersion !== templateVersion) throw Error('This test file belongs to another target/template; use a different test file');
async function persist() {
  const temporary = file + '.tmp';
  await writeFile(temporary, JSON.stringify(saved, null, 2), {mode: 0o600});
  await rename(temporary, file);
}
async function remote(path, body) {
  const response = await fetch(new URL('/v1/remote-updates' + path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error(result.code || 'REMOTE_UPDATE_FAILED');
  return result.data;
}
let result;
if (action === 'start') {
  saved.requests.start ||= {template_version: templateVersion, state: {message: 'Preparing'}, alert: {title: 'Live Activity test', body: 'Remote start'}, idempotency_key: randomUUID()};
  await persist();
  result = await remote('/start-targets/' + encodeURIComponent(startTargetId) + '/start', saved.requests.start);
} else {
  const id = saved.receipts.start?.target_id;
  if (!id) throw Error('Run start first; after a timeout rerun start with this same test file');
  const path = '/activities/' + encodeURIComponent(id);
  if (action === 'status') result = await remote(path);
  else {
    const event = action === 'update' ? 'update:' + message : action;
    if (!saved.requests[event]) {
      saved.requests[event] = action === 'update'
        ? {state: {message}, expected_revision: (await remote(path + '/state')).revision, idempotency_key: randomUUID()}
        : {dismiss_at: new Date().toISOString(), idempotency_key: randomUUID()};
    }
    await persist();
    result = await remote(path + '/' + action, saved.requests[event]);
  }
}
saved.receipts[action] = result;
await persist();
console.log(JSON.stringify(result, null, 2));

} finally { await lock.close(); await unlink(file + '.lock'); }
```

在终端设置以下环境变量，使用受限发送凭据，不要使用主密钥：

```sh
export SCRIPTING_REMOTE_SENDER_KEY='YOUR_SENDER_KEY'
export SCRIPTING_START_TARGET_ID='YOUR_START_TARGET_ID'
export SCRIPTING_TEMPLATE_VERSION='YOUR_TEMPLATE_VERSION'
node live-activity-test.mjs start
node live-activity-test.mjs status
node live-activity-test.mjs update
node live-activity-test.mjs status
node live-activity-test.mjs end
```

逐条运行命令。start 后通过 status 等到 `token_registration: "ready"`，再执行 update 或 end；启动状态已提交不代表更新 token 已到达。`start` 后接收设备应显示“Preparing”，`update` 后变为“Updated from server”，`end` 不附加新状态并请求立即移除。同时检查锁屏与灵动岛。保留 `remote-activity-test.json`：请求在发送前保存，重复命令会重试同一次请求，超时后不要删除。程序崩溃后，先确认旧进程退出，再仅移除它的 `.lock` 文件。

检查或修复模板后，使用 `node live-activity-test.mjs update "Retest after check"` 发送新的更新。不同文本代表有意发起的新事件，相同文本沿用原请求。独立测试使用不同的 `SCRIPTING_REMOTE_TEST_FILE`，并先结束旧活动。`SCRIPTING_PUSH_BASE_URL` 可指定自己的服务器，默认 `https://push.scripting.fun`。


## 限制与错误

JSON 请求体最多 64 KiB，小组件状态最多 16 KiB，活动完整转义后的 APNs 载荷最多 4 KiB。状态完整替换；通知和更新共用[每日推送额度](scripting://doc?title=Remote%20Updates%20Overview)。

错误为 `{ok:false,code,error?,details?,request_id?,timestamp?}`。HTTP 400 表示参数/schema/载荷错误，401 表示凭据无效或过期，403 表示权限不足或账户能力不可用，404 表示资源不可见，409 表示版本/幂等冲突或 token 未就绪，410 表示资源已撤销，429 表示额度或请求频率受限。检查 `code`：`VERSION_CONFLICT` 需要重新读取并判断业务，`IDEMPOTENCY_CONFLICT` 需要修正请求持久化，`TOKEN_PENDING` 需要等待登记，`PUSH_LIMIT_EXCEEDED` 需要可用的每日额度。不要因此反复创建新幂等键。

请求接受后查询操作进度。启动为 `unknown` 时使用同一次 launch 对账，不要再创建活动。重试保留相同幂等键和载荷；新业务生命周期才明确采用新的 generation。
