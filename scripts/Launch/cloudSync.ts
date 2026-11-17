import { Path, Script } from 'scripting'
import { BASE_PATH, BUTTONS_PATH, CACHE_PATH, FILE_PATH } from './constants'

/**
 * iCloud backing for Launch's data.
 *
 * The working copy has to stay in the App Group directory: a widget extension
 * renders synchronously and cannot wait for an iCloud download, so anything it
 * reads must already be on the device. The iCloud copy therefore acts as the
 * durable, cross-device mirror: the app reconciles the two on launch and pushes
 * changes after every save, which is what survives a reinstall and reaches a
 * second device.
 */

/** The authored JSON files that make up the app's state. */
const DATA_FILES = [
  'launcher_apps.json',
  'launcher_folders.json',
  'launcher_config.json'
]

const BUTTONS_DIR = 'buttons'
const CACHE_DIR = 'cache'

function ensureDir(path: string) {
  if (!FileManager.existsSync(path)) {
    FileManager.createDirectorySync(path, true)
  }
}

/**
 * The iCloud mirror root, or `null` when iCloud is unavailable.
 * `iCloudDocumentsDirectory` throws when iCloud is off or unauthorised, so both
 * the check and the lookup are guarded.
 */
export function iCloudBasePath(): string | null {
  try {
    if (!FileManager.isiCloudEnabled) return null
    return Path.join(FileManager.iCloudDocumentsDirectory, Script.name)
  } catch (error) {
    console.error('iCloud unavailable', error)
    return null
  }
}

export function isiCloudReady(): boolean {
  return iCloudBasePath() !== null
}

function modifiedAt(path: string): number {
  try {
    return FileManager.existsSync(path)
      ? FileManager.statSync(path).modificationDate
      : 0
  } catch (error) {
    return 0
  }
}

/** Copies a file, replacing the destination when it is already present. */
function replaceFile(from: string, to: string, onlyIfNewer = false) {
  try {
    if (!FileManager.existsSync(from)) return
    // Saving one file should not re-upload the other two unchanged ones.
    if (onlyIfNewer && modifiedAt(from) <= modifiedAt(to)) return
    if (FileManager.existsSync(to)) FileManager.removeSync(to)
    FileManager.copyFileSync(from, to)
  } catch (error) {
    console.error(`Copy failed: ${from} -> ${to}`, error)
  }
}

/**
 * Copies only the files the destination does not have yet. Buttons and cached
 * icons are keyed by a stable id, so an existing file is already the right one.
 *
 * `readDirectorySync` yields bare file names, but a full path is tolerated too
 * so this keeps working if the API ever changes.
 */
function copyMissing(fromDir: string, toDir: string) {
  try {
    if (!FileManager.existsSync(fromDir)) return
    ensureDir(toDir)
    for (const entry of FileManager.readDirectorySync(fromDir)) {
      const name = entry.split('/').pop()
      if (!name) continue
      const from = entry.includes('/') ? entry : Path.join(fromDir, name)
      const to = Path.join(toDir, name)
      if (FileManager.existsSync(to)) continue
      FileManager.copyFileSync(from, to)
    }
  } catch (error) {
    console.error(`Directory copy failed: ${fromDir}`, error)
  }
}

/** Writes the local store up to iCloud. Returns whether anything was copied. */
export function pushToiCloud(): boolean {
  const root = iCloudBasePath()
  if (!root) return false
  try {
    ensureDir(root)
    ensureDir(Path.join(root, BUTTONS_DIR))
    ensureDir(Path.join(root, CACHE_DIR))
    for (const name of DATA_FILES) {
      replaceFile(Path.join(BASE_PATH, name), Path.join(root, name), true)
    }
    copyMissing(BUTTONS_PATH, Path.join(root, BUTTONS_DIR))
    copyMissing(CACHE_PATH, Path.join(root, CACHE_DIR))
    return true
  } catch (error) {
    console.error('iCloud backup failed', error)
    return false
  }
}

/** Replaces the local store with the iCloud copy. */
export function pullFromiCloud(): boolean {
  const root = iCloudBasePath()
  if (!root) return false
  try {
    if (!FileManager.existsSync(root)) return false
    ensureDir(BASE_PATH)
    for (const name of DATA_FILES) {
      replaceFile(Path.join(root, name), Path.join(BASE_PATH, name))
    }
    copyMissing(Path.join(root, BUTTONS_DIR), BUTTONS_PATH)
    copyMissing(Path.join(root, CACHE_DIR), CACHE_PATH)
    return true
  } catch (error) {
    console.error('iCloud restore failed', error)
    return false
  }
}

export type iCloudSyncResult = 'pulled' | 'pushed' | 'none'

/** Caps a promise so a stalled network call cannot block app startup. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
  ])
}

/**
 * Reconciles the local store with the iCloud mirror on launch. The newer copy
 * wins, compared on the apps file, so a device that edited more recently is
 * never overwritten by a stale one.
 */
export async function syncWithiCloud(): Promise<iCloudSyncResult> {
  const root = iCloudBasePath()
  if (!root) return 'none'

  try {
    const cloudApps = Path.join(root, 'launcher_apps.json')
    if (!FileManager.existsSync(cloudApps)) {
      // First run with iCloud on: seed the mirror from what is already local.
      return pushToiCloud() ? 'pushed' : 'none'
    }

    // On a fresh device the file can still be a placeholder that has to be
    // pulled down before it can be read.
    if (
      FileManager.isFileStoredIniCloud(cloudApps) &&
      !FileManager.isiCloudFileDownloaded(cloudApps)
    ) {
      const downloaded = await withTimeout(
        FileManager.downloadFileFromiCloud(cloudApps),
        5000,
        false
      )
      // Without the remote copy there is no way to tell which side is newer,
      // so leave the local data untouched rather than overwrite iCloud.
      if (!downloaded) return 'none'
    }

    const local = modifiedAt(FILE_PATH)
    const remote = modifiedAt(cloudApps)
    if (remote > local) {
      return pullFromiCloud() ? 'pulled' : 'none'
    }
    return pushToiCloud() ? 'pushed' : 'none'
  } catch (error) {
    console.error('iCloud sync failed', error)
    return 'none'
  }
}
