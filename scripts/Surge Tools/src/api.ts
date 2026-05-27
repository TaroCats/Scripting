/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-27 17:47:55
 * @Description: Surge工具API
 */
const { Storage, fetch } = globalThis as any;

export interface SurgeConfig {
  address: string;
  port: string;
  key: string;
}

export function getSurgeConfig(): SurgeConfig {
  return Storage.get("surge_config") || { address: "127.0.0.1", port: "6166", key: "Cats" };
}

export function setSurgeConfig(config: SurgeConfig) {
  Storage.set("surge_config", config);
}

export async function fetchTraffic(config: SurgeConfig) {
  const { address, port, key } = config;
  const url = `http://${address}:${port}/v1/traffic`;
  const headers: Record<string, string> = {};
  if (key) {
    headers["X-Key"] = key;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status}`);
  }
  return res.json();
}
