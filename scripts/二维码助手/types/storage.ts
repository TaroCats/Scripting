import { AppSettings, QrRecord } from "./types";
import { DEFAULT_REDIRECT_RULES, DEFAULT_SETTINGS, SETTINGS_KEY, STORAGE_KEY } from "./constants";

// 小组件运行在独立进程中，无法读取脚本私有域存储；
// 因此统一使用 shared 域，让 widget.tsx 与主应用共享同一份历史与设置。
// 同时保留对旧版私有域数据的一次性迁移。

function readLegacy<T>(key: string): T | null {
  try {
    return Storage.get<T>(key);
  } catch {
    return null;
  }
}

export function loadRecords(): QrRecord[] {
  const shared = Storage.get<QrRecord[]>(STORAGE_KEY, { shared: true });
  if (Array.isArray(shared)) return shared;

  const legacy = readLegacy<QrRecord[]>(STORAGE_KEY);
  if (Array.isArray(legacy)) {
    Storage.set(STORAGE_KEY, legacy, { shared: true });
    return legacy;
  }
  return [];
}

export function persistRecords(records: QrRecord[]) {
  Storage.set(STORAGE_KEY, records, { shared: true });
}

export function loadSettings(): AppSettings {
  const shared = Storage.get<AppSettings>(SETTINGS_KEY, { shared: true });
  const stored = shared ?? readLegacy<AppSettings>(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    redirectRules: stored?.redirectRules ?? DEFAULT_REDIRECT_RULES,
  };
}

export function persistSettings(settings: AppSettings) {
  Storage.set(SETTINGS_KEY, settings, { shared: true });
}
