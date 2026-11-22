import { Device, Path, Script } from 'scripting'
import {
  AppItem,
  BASE_PATH,
  BUTTONS_PATH,
  CLOUD_STORE_ID,
  CONFIG_PATH,
  Config,
  FILE_PATH,
  FOLDERS_PATH,
  Folder
} from './constants'

/**
 * iCloud backing for Launch's data, kept in an iCloud shared data store.
 *
 * The store lives in CloudKit, not in the iCloud Drive folder the app used to
 * mirror files into, so a backup no longer shows up as a pile of JSON files in
 * the Files app. A store is created once (Settings → iCloud Shared Data) and is
 * addressed by `CLOUD_STORE_ID`; scripts can read and write it but not create
 * one.
 *
 * The working copy still lives in the App Group directory: a widget extension
 * renders synchronously and cannot wait for a CloudKit round trip, so whatever
 * the widget reads must already be on the device. The store is therefore the
 * durable, cross-device mirror, reconciled when the app launches and updated
 * after every save.
 *
 * The whole snapshot is a single entry on purpose. Binary attachments make
 * CloudKit stall for tens of seconds and leave the following write hanging, so
 * icons are not mirrored: they are either re-downloaded from their URL or, for a
 * hand-picked image, picked again on the new device.
 */

/** Bumped when the document layout changes, so an old store can be upgraded. */
const DOCUMENT_VERSION = 2

/**
 * The store entry holding the whole snapshot. One key keeps the app's state
 * atomic: every save replaces it, and a pull is a single read.
 */
const DOCUMENT_KEY = 'launch'

/** Local marker holding the timestamp of the newest local or synced state. */
const SYNC_STAMP_PATH = Path.join(BASE_PATH, 'launch_sync.json')

/** Storage key remembering the last failed store round trip. */
const FAILED_AT_KEY = 'launch_store_failed_at'
/** How long a generic failure holds off automatic retries. */
const RETRY_AFTER_FAILURE = 60 * 1000
/** A timeout is often a slow network, so give it a little longer. */
const RETRY_AFTER_TIMEOUT = 2 * 60 * 1000
/** An offline device is not retried every minute; a reconnect clears this. */
const RETRY_AFTER_OFFLINE = 5 * 60 * 1000

/** The longest a store round trip may take before it is abandoned. */
const STORE_TIMEOUT = 15000

/** Files that used to be mirrored into iCloud Drive, kept for migration only. */
const LEGACY_FILES = [
  'launcher_apps.json',
  'launcher_folders.json',
  'launcher_config.json'
]

type ButtonCodeMap = Record<string, string>

interface CloudDocument {
  version: number
  updatedAt: number
  apps?: AppItem[]
  folders?: Folder[]
  config?: Partial<Config>
  buttons?: ButtonCodeMap
}

interface SyncStamp {
  updatedAt: number
}

type FailureKind = 'offline' | 'timeout' | 'error'

/** Remembers why the last round trip failed, so the retry wait can vary. */
interface FailureState {
  at: number
  kind: FailureKind
}

let cachedStore: CloudSharedData | null = null

/**
 * The shared data store, or `null` when iCloud is unavailable. Constructing the
 * object is cheap; the per-script access prompt appears on the first call.
 */
export function cloudStore(): CloudSharedData | null {
  try {
    if (!FileManager.isiCloudEnabled) return null
    if (!cachedStore) cachedStore = new CloudSharedData(CLOUD_STORE_ID)
    return cachedStore
  } catch (error) {
    console.error('iCloud store unavailable', error)
    return null
  }
}

/** Whether iCloud is usable at all; the store itself is verified on sync. */
export function isiCloudReady(): boolean {
  try {
    return FileManager.isiCloudEnabled
  } catch (error) {
    console.error(error)
    return false
  }
}

export function ensureBaseDirectory() {
  if (!FileManager.existsSync(BASE_PATH)) {
    FileManager.createDirectorySync(BASE_PATH, true)
  }
}

function readFailure(): FailureState | null {
  try {
    // Older versions stored a bare timestamp. Keep reading it as a generic
    // failure so updating the app does not lose the hold-off.
    const stored = Storage.get<number | FailureState>(FAILED_AT_KEY)
    if (typeof stored === 'number') return { at: stored, kind: 'error' }
    if (stored && typeof stored === 'object' && typeof stored.at === 'number') {
      const kind = stored.kind
      return {
        at: stored.at,
        kind: kind === 'offline' || kind === 'timeout' ? kind : 'error'
      }
    }
  } catch (error) {
    console.warn('read iCloud failure state failed', error)
  }
  return null
}

/** Whether the last attempt failed recently enough to skip an automatic retry. */
function recentFailure(): boolean {
  const failure = readFailure()
  if (!failure) return false
  const hold =
    failure.kind === 'offline'
      ? RETRY_AFTER_OFFLINE
      : failure.kind === 'timeout'
        ? RETRY_AFTER_TIMEOUT
        : RETRY_AFTER_FAILURE
  return Date.now() - failure.at < hold
}

function clearFailure() {
  try {
    Storage.remove(FAILED_AT_KEY)
  } catch (error) {
    console.warn('clear iCloud failure state failed', error)
  }
}

/** Remembers a failure so a blocked store is not retried on every save. */
function recordOutcome(ok: boolean, kind: FailureKind = 'error') {
  if (ok) {
    clearFailure()
    return
  }
  try {
    const state: FailureState = { at: Date.now(), kind }
    Storage.set(FAILED_AT_KEY, state)
  } catch (error) {
    console.warn('record iCloud failure state failed', error)
  }
}

/** Classifies a store error so an offline device backs off for longer. */
function storeErrorKind(error: unknown): FailureKind {
  const message = String(
    (error as { message?: unknown } | undefined)?.message ?? error ?? ''
  ).toLowerCase()
  if (
    message.includes('網絡不可用') ||
    message.includes('网络不可用') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('not connected') ||
    message.includes('no connection') ||
    message.includes('internet connection') ||
    message.includes('connect')
  ) {
    return 'offline'
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout'
  }
  return 'error'
}

function reportStoreFailure(label: string, error: unknown): FailureKind {
  const kind = storeErrorKind(error)
  if (kind === 'offline') {
    // Being offline is expected and recoverable; do not flood the console with
    // error-level entries for it.
    console.warn(`${label}: network unavailable, will retry later`)
  } else {
    console.error(`${label} failed`, error)
  }
  return kind
}

/**
 * The system's last known path state. `null` means no snapshot has arrived
 * yet, in which case a store call is still worth attempting.
 */
let networkOnline: boolean | null = null
let networkReady: Promise<void> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Subscribes to the system path monitor once. The first callback carries an
 * initial snapshot; startup waits for it briefly so an offline launch does not
 * spend fifteen seconds timing out a store read.
 */
function startNetworkMonitoring(): Promise<void> {
  if (networkReady) return networkReady
  networkReady = new Promise<void>(resolve => {
    let done = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = () => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      resolve()
    }
    try {
      Device.addNetworkChangeListener(state => {
        const online = state.status === 'satisfied'
        const wasOffline = networkOnline === false
        networkOnline = online
        if (online) {
          // A restored connection should not stay blocked by the old hold-off.
          clearFailure()
          if (wasOffline) scheduleSyncAfterReconnect()
        }
        finish()
      })
    } catch (error) {
      // The widget extension never imports this file, but keep the app safe if
      // the API is unavailable for any reason.
      console.warn('network state listener unavailable', error)
      finish()
    }
    // Do not hold up the app when the first path update is slow.
    timer = setTimeout(finish, 800)
  })
  return networkReady
}

function networkBlocked(): boolean {
  return networkOnline === false
}

/** Reconciles once the connection is back, without waiting for a relaunch. */
function scheduleSyncAfterReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void syncWithiCloud()
  }, 1200)
}

function readJSONFile<T>(path: string): T | undefined {
  try {
    if (!FileManager.existsSync(path)) return undefined
    return JSON.parse(FileManager.readAsStringSync(path)) as T
  } catch (error) {
    console.error(error)
    return undefined
  }
}

function writeJSONFile(path: string, value: unknown) {
  ensureBaseDirectory()
  FileManager.writeAsStringSync(path, JSON.stringify(value))
}

function readStamp(): number {
  const stamp = readJSONFile<SyncStamp>(SYNC_STAMP_PATH)
  return typeof stamp?.updatedAt === 'number' ? stamp.updatedAt : 0
}

function writeStamp(updatedAt: number) {
  writeJSONFile(SYNC_STAMP_PATH, { updatedAt })
}

/**
 * Records that the local data changed. The stamp is what makes a save survive a
 * failed upload: the next launch sees local as newer and pushes it again.
 */
export function markLocalChange() {
  writeStamp(Date.now())
}

let pushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Coalesces the saves that arrive in a burst — typing a profile name, tapping a
 * stepper — into a single upload. The local change is stamped immediately, so
 * an upload that never happens still gets retried on the next launch.
 */
export function schedulePushToiCloud(delay = 1200) {
  markLocalChange()
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushToiCloud()
  }, delay)
}

function readButtons(): ButtonCodeMap {
  const map: ButtonCodeMap = {}
  try {
    if (!FileManager.existsSync(BUTTONS_PATH)) return map
    for (const entry of FileManager.readDirectorySync(BUTTONS_PATH)) {
      const name = entry.split('/').pop()
      if (!name || !name.endsWith('.js')) continue
      map[name.slice(0, -3)] = FileManager.readAsStringSync(
        Path.join(BUTTONS_PATH, name)
      )
    }
  } catch (error) {
    console.error(error)
  }
  return map
}

/**
 * Writes the button code files, dropping any whose item no longer exists. A
 * pulled document is the whole truth, so a stale local file must not survive it.
 */
function writeButtons(buttons?: ButtonCodeMap) {
  if (!buttons) return
  try {
    if (!FileManager.existsSync(BUTTONS_PATH)) {
      FileManager.createDirectorySync(BUTTONS_PATH, true)
    }
    for (const [id, code] of Object.entries(buttons)) {
      FileManager.writeAsStringSync(Path.join(BUTTONS_PATH, `${id}.js`), code)
    }
    for (const entry of FileManager.readDirectorySync(BUTTONS_PATH)) {
      const name = entry.split('/').pop()
      if (!name || !name.endsWith('.js')) continue
      if (buttons[name.slice(0, -3)] !== undefined) continue
      FileManager.removeSync(Path.join(BUTTONS_PATH, name))
    }
  } catch (error) {
    console.error(error)
  }
}

/** Snapshots the local working copy, which is what a widget reads. */
export function readLocalDocument(): CloudDocument {
  return {
    version: DOCUMENT_VERSION,
    updatedAt: readStamp(),
    apps: readJSONFile<AppItem[]>(FILE_PATH),
    folders: readJSONFile<Folder[]>(FOLDERS_PATH),
    config: readJSONFile<Partial<Config>>(CONFIG_PATH),
    buttons: readButtons()
  }
}

/** Replaces the local working copy with a document pulled from the store. */
export function writeLocalDocument(doc: CloudDocument) {
  ensureBaseDirectory()
  if (doc.apps) writeJSONFile(FILE_PATH, doc.apps)
  if (doc.folders) writeJSONFile(FOLDERS_PATH, doc.folders)
  if (doc.config) writeJSONFile(CONFIG_PATH, doc.config)
  writeButtons(doc.buttons)
  writeStamp(doc.updatedAt ?? 0)
}

type AttemptResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: FailureKind }

/**
 * Runs a store call and reports how it ended. The native promise keeps running
 * after a timeout, so callers must not start a second identical call while it
 * is still in flight; `activeWrite` below does that for pushes.
 */
function attempt<T>(
  promise: Promise<T>,
  label: string
): Promise<AttemptResult<T>> {
  return new Promise<AttemptResult<T>>(resolve => {
    let done = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (result: AttemptResult<T>) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    timer = setTimeout(() => {
      console.warn(`${label} timed out`)
      finish({ ok: false, kind: 'timeout' })
    }, STORE_TIMEOUT)
    promise.then(
      value => finish({ ok: true, value }),
      error => finish({ ok: false, kind: reportStoreFailure(label, error) })
    )
  })
}

/** Writes the local working copy up to the store. */
export function pushToiCloud(force = false): Promise<boolean> {
  // A store call can stall on its first-use approval prompt, so a second push
  // waits for the one already in flight instead of starting another.
  if (pushTask) return pushTask
  pushTask = writeDocument(force).finally(() => {
    pushTask = null
  })
  return pushTask
}

let pushTask: Promise<boolean> | null = null

/**
 * The native put that is still running. A timeout only abandons our wait, not
 * the CloudKit request, so stacking another put would turn a slow network into
 * a burst of timeouts.
 */
let activeWrite: Promise<void> | null = null
/** When the tracked native put started, so a truly hung one can be abandoned. */
let activeWriteAt = 0
/** A put this old is presumed dead and may be superseded. */
const ACTIVE_WRITE_STALE = 60 * 1000

/** A read result that tells an empty store apart from an unreachable one. */
type ReadOutcome =
  | { ok: true; doc: CloudDocument | null }
  | { ok: false; kind: FailureKind }

async function readDocument(store: CloudSharedData): Promise<ReadOutcome> {
  const result = await attempt(store.get(DOCUMENT_KEY), 'store.get(document)')
  if (!result.ok) return { ok: false, kind: result.kind }
  const entry = result.value
  return {
    ok: true,
    doc: (entry?.value as CloudDocument | undefined) ?? null
  }
}

async function writeDocument(force = false): Promise<boolean> {
  // A store seeded from a fresh local copy still needs a stamp. An existing
  // stamp is the edit time and must not be advanced at upload time, otherwise
  // a remote edit made in between would lose the newest-wins comparison.
  if (readStamp() === 0) markLocalChange()
  await startNetworkMonitoring()

  if (!force && networkBlocked()) {
    // No point asking CloudKit to fail; the local stamp keeps the change for
    // the next online launch or save. A manual backup still tries, so it can
    // succeed immediately after the connection comes back.
    recordOutcome(false, 'offline')
    return false
  }
  if (!force && recentFailure()) return false
  const store = cloudStore()
  if (!store) return false
  // A timed-out put is still running inside CloudKit. Wait for it to settle
  // instead of stacking another request and multiplying the timeouts. A put
  // that has been hanging far longer than CloudKit's own failure window is
  // treated as dead so the app cannot be locked out until a relaunch.
  if (activeWrite && Date.now() - activeWriteAt < ACTIVE_WRITE_STALE) {
    recordOutcome(false, networkBlocked() ? 'offline' : 'timeout')
    return false
  }

  try {
    const doc: CloudDocument = {
      ...readLocalDocument(),
      version: DOCUMENT_VERSION,
      updatedAt: Date.now()
    }
    const native = store.put(DOCUMENT_KEY, doc)
    activeWrite = native
    activeWriteAt = Date.now()
    native
      .finally(() => {
        if (activeWrite === native) activeWrite = null
      })
      // `attempt` already reports the rejection; this branch only keeps the
      // tracking chain from becoming an unhandled rejection.
      .catch(() => {})

    const result = await attempt(native.then(() => true), 'store.put(document)')
    if (!result.ok) {
      recordOutcome(false, networkBlocked() ? 'offline' : result.kind)
      return false
    }
    writeStamp(doc.updatedAt)
    recordOutcome(true)
    return true
  } catch (error) {
    recordOutcome(false, reportStoreFailure('iCloud store backup', error))
    return false
  }
}

/** Replaces the local working copy with the store's document. */
export async function pullFromiCloud(force = false): Promise<boolean> {
  await startNetworkMonitoring()
  if (!force && networkBlocked()) {
    recordOutcome(false, 'offline')
    return false
  }
  if (!force && recentFailure()) return false
  const store = cloudStore()
  if (!store) return false
  try {
    const read = await readDocument(store)
    if (!read.ok) {
      recordOutcome(false, networkBlocked() ? 'offline' : read.kind)
      return false
    }
    if (!read.doc) return false
    writeLocalDocument(read.doc)
    recordOutcome(true)
    return true
  } catch (error) {
    recordOutcome(false, reportStoreFailure('iCloud store restore', error))
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

/** The pre-store iCloud Drive mirror, or `null` when iCloud is unavailable. */
function legacyMirrorPath(): string | null {
  try {
    return Path.join(FileManager.iCloudDocumentsDirectory, Script.name)
  } catch (error) {
    return null
  }
}

/**
 * Imports what the old iCloud Drive mirror holds and the local copy does not.
 * The previous version reconciled the two at every launch, so the local copy is
 * normally at least as fresh; only a fresh device needs the mirror's data.
 */
async function importLegacyMirror(): Promise<boolean> {
  const root = legacyMirrorPath()
  if (!root || !FileManager.existsSync(root)) return false
  let imported = false
  ensureBaseDirectory()

  for (const name of LEGACY_FILES) {
    const remote = Path.join(root, name)
    const local = Path.join(BASE_PATH, name)
    if (!FileManager.existsSync(remote) || FileManager.existsSync(local)) continue
    try {
      // A placeholder that has not been downloaded yet cannot be read.
      if (
        FileManager.isFileStoredIniCloud(remote) &&
        !FileManager.isiCloudFileDownloaded(remote)
      ) {
        await withTimeout(
          FileManager.downloadFileFromiCloud(remote),
          5000,
          false
        )
      }
      FileManager.copyFileSync(remote, local)
      imported = true
    } catch (error) {
      console.error(`Legacy import failed: ${name}`, error)
    }
  }

  const legacyButtons = Path.join(root, 'buttons')
  if (FileManager.existsSync(legacyButtons)) {
    if (!FileManager.existsSync(BUTTONS_PATH)) {
      FileManager.createDirectorySync(BUTTONS_PATH, true)
    }
    try {
      for (const entry of FileManager.readDirectorySync(legacyButtons)) {
        const name = entry.split('/').pop()
        if (!name || !name.endsWith('.js')) continue
        const local = Path.join(BUTTONS_PATH, name)
        if (FileManager.existsSync(local)) continue
        FileManager.copyFileSync(Path.join(legacyButtons, name), local)
        imported = true
      }
    } catch (error) {
      console.error('Legacy button import failed', error)
    }
  }

  if (imported) markLocalChange()
  return imported
}

/** Drops the old iCloud Drive mirror once the store holds the data. */
function removeLegacyMirror() {
  const root = legacyMirrorPath()
  if (!root) return
  try {
    if (FileManager.existsSync(root)) FileManager.removeSync(root)
  } catch (error) {
    console.error('Legacy mirror cleanup failed', error)
  }
}

/**
 * Reconciles the local working copy with the store on launch.
 *
 * The first run migrates whatever the old iCloud Drive mirror still holds, then
 * seeds the store from the local data. After that the newer side wins: a device
 * that edited more recently is never overwritten by a stale copy.
 */
export function syncWithiCloud(): Promise<iCloudSyncResult> {
  // A startup sync and a reconnect sync can overlap; both should observe the
  // same round trip instead of reading and pushing at the same time.
  if (syncTask) return syncTask
  syncTask = runSync().finally(() => {
    syncTask = null
  })
  return syncTask
}

let syncTask: Promise<iCloudSyncResult> | null = null

async function runSync(): Promise<iCloudSyncResult> {
  await startNetworkMonitoring()
  const store = cloudStore()
  if (!store) return 'none'
  if (networkBlocked()) return 'none'
  // A store the user has not approved, or a network that just failed, would
  // only stall every launch; wait a while before trying again.
  if (recentFailure()) return 'none'

  try {
    const migrated = await importLegacyMirror()
    const read = await readDocument(store)

    if (!read.ok) {
      // The store could not be reached; pushing into it would only stall again.
      recordOutcome(false, networkBlocked() ? 'offline' : read.kind)
      return 'none'
    }
    // The read worked, so the previous failure is over even if this device
    // still has to push its newer copy below.
    recordOutcome(true)

    if (!read.doc) {
      // Empty store: this is the migration, everything local becomes durable.
      // A fresh install has nothing to seed yet; the app writes its defaults
      // first and pushes them on the next save.
      if (!FileManager.existsSync(FILE_PATH)) return 'none'
      const pushed = await pushToiCloud()
      if (pushed) removeLegacyMirror()
      return pushed ? 'pushed' : 'none'
    }

    const remote = read.doc
    const remoteUpdatedAt =
      typeof remote.updatedAt === 'number' ? remote.updatedAt : 0
    const localUpdatedAt = readStamp()

    if (remoteUpdatedAt > localUpdatedAt) {
      writeLocalDocument(remote)
      return 'pulled'
    }
    if (remoteUpdatedAt === localUpdatedAt && !migrated) return 'none'

    const pushed = await pushToiCloud()
    if (pushed) removeLegacyMirror()
    return pushed ? 'pushed' : 'none'
  } catch (error) {
    recordOutcome(false, reportStoreFailure('iCloud sync', error))
    return 'none'
  }
}
