// 对外暴露的扫码函数（供其它脚本通过 Script.run 调起相机并拿到识别结果）
//
// 调用方：
//   const res = await Script.run({
//     name: "二维码助手",
//     queryParameters: { fn: "scan" },
//   });
//   // res: { ok: true, code: "ok", content: "https://…", timestamp, saved, redirected, redirectTarget? }
//   // 取消：{ ok: false, code: "cancelled" }
//
// 也可用 URL scheme：scripting://run/二维码助手?fn=scan
//
// 参数：
//   fn       必填。"scan" | "scanCamera" | "扫码"，命中即进入「扫码并返回结果」模式
//   redirect 选填。true 时识别成功后会按跳转规则打开 App（默认 false，把控制权留给调用方）
//   save     选填。false 时不写入历史记录（默认 true）

export const SCAN_API_SCRIPT_NAME = "二维码助手";

export type ScanApiRequest = {
  redirect: boolean;
  save: boolean;
};

export type ScanApiFailureCode = "cancelled" | "error" | "bad-request";

export type ScanApiSuccess = {
  ok: true;
  code: "ok";
  message: string;
  content: string;
  timestamp: number;
  type: "SCAN";
  saved: boolean;
  redirected: boolean;
  redirectTarget?: string;
};

export type ScanApiFailure = {
  ok: false;
  code: ScanApiFailureCode;
  message: string;
};

export type ScanApiResult = ScanApiSuccess | ScanApiFailure;

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "是"].includes(text)) return true;
  if (["0", "false", "no", "off", "否"].includes(text)) return false;
  return fallback;
}

/** 从 queryParameters 中识别「扫码 API」调用；不是则返回 null，交给普通启动流程。 */
export function parseScanApiRequest(params: Record<string, any> | null | undefined): ScanApiRequest | null {
  const raw = params?.fn;
  if (typeof raw !== "string") return null;

  const fn = raw.trim().toLowerCase();
  if (!["scan", "scancamera", "扫码", "扫一扫"].includes(fn)) return null;

  return {
    redirect: toBool(params?.redirect, false),
    save: toBool(params?.save, true),
  };
}

/** 生成调用参数，方便其它脚本拼装 Script.run 的入参。 */
export function createScanApiQuery(options?: { redirect?: boolean; save?: boolean }): Record<string, string> {
  const query: Record<string, string> = { fn: "scan" };
  if (options?.redirect !== undefined) query.redirect = options.redirect ? "1" : "0";
  if (options?.save !== undefined) query.save = options.save ? "1" : "0";
  return query;
}

export function scanApiSuccess(args: {
  content: string;
  timestamp: number;
  saved: boolean;
  redirected: boolean;
  redirectTarget?: string;
}): ScanApiSuccess {
  return {
    ok: true,
    code: "ok",
    message: "识别成功",
    content: args.content,
    timestamp: args.timestamp,
    type: "SCAN",
    saved: args.saved,
    redirected: args.redirected,
    ...(args.redirectTarget ? { redirectTarget: args.redirectTarget } : {}),
  };
}

export function scanApiCancelled(): ScanApiFailure {
  return { ok: false, code: "cancelled", message: "用户取消了扫码" };
}

export function scanApiError(message: string): ScanApiFailure {
  return { ok: false, code: "error", message };
}
