export function isProbablyURL(value: string) {
  const trimmed = value.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) return true;
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/i.test(trimmed) && !/\s/.test(trimmed)) return true;
  return false;
}

export function getValidURL(value: string) {
  const trimmed = value.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export type ContentType = "url" | "wifi" | "phone" | "email" | "text";

export function detectContentType(value: string): ContentType {
  const t = value.trim();
  if (!t) return "text";
  if (/^WIFI:/i.test(t)) return "wifi";
  if (/^tel:/i.test(t) || /^\+?\d[\d\s-]{5,}$/.test(t)) return "phone";
  if (/^mailto:/i.test(t) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "email";
  if (isProbablyURL(t)) return "url";
  return "text";
}
