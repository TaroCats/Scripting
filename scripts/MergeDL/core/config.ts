import type {
  Aria2Config,
  CloudreveConfig,
  CloudreveToken,
  DownloaderMode,
} from "./types"

/**
 * Credentials and endpoints are stored in the script-scoped Keychain.
 * Keychain is isolated per script, so the Safari extension cannot read these
 * values; the bridge file in core/bridge.ts is the only cross-context channel.
 */
const K = {
  mode: "mergedl.mode",
  aria2Rpc: "mergedl.aria2.rpc",
  aria2Secret: "mergedl.aria2.secret",
  cloudBase: "mergedl.cloudreve.base",
  cloudEmail: "mergedl.cloudreve.email",
  cloudDst: "mergedl.cloudreve.dst",
  cloudAccess: "mergedl.cloudreve.access",
  cloudRefresh: "mergedl.cloudreve.refresh",
  cloudAccessExpiry: "mergedl.cloudreve.access_expires",
  cloudRefreshExpiry: "mergedl.cloudreve.refresh_expires",
} as const

function read(key: string): string {
  return Keychain.get(key) ?? ""
}

function write(key: string, value: string): void {
  Keychain.set(key, value)
}

function readNumber(key: string): number {
  const n = Number(read(key))
  return Number.isFinite(n) ? n : 0
}

export function loadMode(): DownloaderMode {
  return read(K.mode) === "cloudreve" ? "cloudreve" : "aria2"
}

export function saveMode(mode: DownloaderMode): void {
  write(K.mode, mode)
}

export function loadAria2Config(): Aria2Config {
  return { rpcUrl: read(K.aria2Rpc).trim(), secret: read(K.aria2Secret) }
}

export function saveAria2Config(config: Aria2Config): void {
  write(K.aria2Rpc, config.rpcUrl.trim())
  write(K.aria2Secret, config.secret)
}

export function loadCloudreveConfig(): CloudreveConfig {
  const accessToken = read(K.cloudAccess)
  const refreshToken = read(K.cloudRefresh)
  const token: CloudreveToken | null =
    accessToken && refreshToken
      ? {
          accessToken,
          refreshToken,
          accessExpires: readNumber(K.cloudAccessExpiry),
          refreshExpires: readNumber(K.cloudRefreshExpiry),
        }
      : null
  return {
    baseUrl: read(K.cloudBase).trim(),
    email: read(K.cloudEmail),
    dst: read(K.cloudDst).trim() || "cloudreve://my",
    token,
  }
}

export function saveCloudreveEndpoint(baseUrl: string, email: string, dst: string): void {
  write(K.cloudBase, baseUrl.trim())
  write(K.cloudEmail, email)
  write(K.cloudDst, dst.trim() || "cloudreve://my")
}

export function saveCloudreveDst(dst: string): void {
  write(K.cloudDst, dst.trim() || "cloudreve://my")
}

export function saveCloudreveToken(token: CloudreveToken): void {
  write(K.cloudAccess, token.accessToken)
  write(K.cloudRefresh, token.refreshToken)
  write(String(K.cloudAccessExpiry), String(token.accessExpires))
  write(String(K.cloudRefreshExpiry), String(token.refreshExpires))
}

export function clearCloudreveToken(): void {
  Keychain.remove(K.cloudAccess)
  Keychain.remove(K.cloudRefresh)
  Keychain.remove(K.cloudAccessExpiry)
  Keychain.remove(K.cloudRefreshExpiry)
}
