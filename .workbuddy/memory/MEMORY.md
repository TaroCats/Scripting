# 项目长期记忆 — Scripting Scripts

## 版本号：不要手动改

`scripts/*/script.json` 的 `version` **由云端 CI 自动递增并提交**。
改动代码时**不要**手动改 `version` 字段，也不要为了"标记版本"而编辑它。
只改功能相关的字段（如 `localizedDescriptions`）；版本交给 CI。

## 项目结构

- `scripts/Launch/` — 启动台小组件（React/TSX on Scripting App）。详见 `2026-11-18.md`。
- `dts/` — Scripting 运行时类型声明（`global.d.ts` 提供 FileManager 等全局，`scripting.d.ts` 提供组件）。
- 仓库内**没有** `node_modules` / 本地 tsc。类型检查需要临时安装：
  ```
  mkdir -p /tmp/tscheck && cd /tmp/tscheck && npm install typescript@5.6.3
  # 写 tsconfig.check.json，paths 映射 "scripting" -> dts/scripting.d.ts
  ./node_modules/.bin/tsc -p tsconfig.check.json
  ```
  已知 3 个既有 `noUnusedLocals` 告警（AppEditor/SharedViews 的 `Spacer`、intent.tsx 的 `presentIntentView`），不是回归。

## Scripting 平台注意点

- `FileManager.readDirectorySync(dir)` 返回**裸文件名**，不是完整路径。
- `FileManager.iCloudDocumentsDirectory` 在 iCloud 未开启时会**抛错**，必须先查 `FileManager.isiCloudEnabled`。
- 只有 `appGroupDocumentsDirectory` 明确「widget 可访问」；`documentsDirectory` widget 不可访问。
- `Fragment` 是全局，不从 `scripting` 导入。
- 组件（`Stepper`/`Picker`）**没有** `disabled` 属性。
- **`NavigationLink` 的 destination 在 push 时被捕获**，父组件 state 变化不会更新已推入页面的 props。任何编辑页必须用本地 `useState` 驱动 UI，否则步进器/选择器看起来"点了没反应"。
