import { RedirectRule } from "../types/types";

export function mergeRemoteRules(localRules: RedirectRule[], remoteRules: RedirectRule[]): RedirectRule[] {
  const merged = localRules.map(r => ({ ...r, source: r.source ?? "local" as const }));
  for (const remote of remoteRules) {
    const exists = merged.some(r =>
      r.keyword.toLowerCase() === remote.keyword.toLowerCase() &&
      r.urlScheme === remote.urlScheme
    );
    if (!exists) {
      merged.push({ ...remote, source: "remote" as const });
    }
  }
  return merged;
}

export function matchRedirectRule(content: string, rules: RedirectRule[]): RedirectRule | null {
  const lower = content.toLowerCase();
  for (const rule of rules) {
    const keywords = rule.keyword.split(/[,，]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.some(kw => lower.includes(kw))) {
      return rule;
    }
  }
  return null;
}

// 根据扫码内容解析出跳转目标 URL（命中规则或兑底），供主界面与小组件直达扫码共用。
export function resolveRedirectTarget(
  content: string,
  rules: RedirectRule[],
  fallbackEnabled: boolean,
  fallbackUrlScheme: string
): { url: string; appName?: string } | null {
  const parseUrl = (scheme: string) =>
    scheme.replace(/{content}/g, encodeURIComponent(content)).replace(/{url}/g, content);

  const rule = matchRedirectRule(content, rules);
  if (rule) {
    return { url: parseUrl(rule.urlScheme), appName: rule.appName };
  }

  if (fallbackEnabled && fallbackUrlScheme.trim()) {
    return { url: parseUrl(fallbackUrlScheme.trim()) };
  }

  return null;
}

export function formatRuleJSON(rule: RedirectRule): string {
  const ordered: Record<string, string> = {
    appName: rule.appName,
    iconUrl: rule.iconUrl ?? "",
    keyword: rule.keyword,
    urlScheme: rule.urlScheme
  };
  return JSON.stringify(ordered, null, 2);
}
