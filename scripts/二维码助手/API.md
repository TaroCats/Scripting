# 二维码助手 · 对外 API

其它脚本/app 可以通过 `Script.run` 调起「二维码助手」，直接打开相机扫码，并把识别结果作为返回值拿回去。

## 打开相机扫码并返回结果

```tsx
import { Script } from "scripting";

const res = await Script.run({
  name: "二维码助手",
  queryParameters: { fn: "scan" },
});

if (res?.ok) {
  console.log("扫码内容：", res.content);
} else if (res?.code === "cancelled") {
  console.log("用户取消了扫码");
} else {
  console.log("失败：", res?.message);
}
```

等价 URL scheme：`scripting://run/二维码助手?fn=scan`

## 参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `fn` | 是 | `scan` / `scanCamera` / `扫码`，命中即进入「扫码并返回结果」模式 |
| `redirect` | 否 | `1` 时识别成功后按跳转规则直接打开对应 App（默认 `0`，把控制权留给调用方） |
| `save` | 否 | `0` 时不写入历史记录（默认 `1`） |

## 返回值

成功：

```json
{
  "ok": true,
  "code": "ok",
  "message": "识别成功",
  "content": "https://example.com",
  "timestamp": 1763744000000,
  "type": "SCAN",
  "saved": true,
  "redirected": false
}
```

- `redirected` 为 `true` 时附带 `redirectTarget`（实际打开的 URL）。
- 取消：`{ "ok": false, "code": "cancelled", "message": "用户取消了扫码" }`
- 异常：`{ "ok": false, "code": "error", "message": "..." }`

调用方只需判断 `ok`；`message` 用于展示给用户。

## 说明

- 首次使用需要在 设置 → 脚本权限 → 脚本调用 中允许。
- 该模式下只呈现相机界面，不会进入主应用的三栏界面；识别成功或用户取消后立即 `Script.exit(result)` 返回。
- 相机权限沿用系统对「二维码助手」的授权。
