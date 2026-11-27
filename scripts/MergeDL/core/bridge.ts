import type { InboxJob } from "./types"

/**
 * Safari userscripts cannot read this script's Keychain, and the Safari
 * extension denies Scripting.FileManager paths other than its own storage.
 * The reliable bridge is GM storage: the userscript writes a queue under this
 * key and the app reads the JSON files from safariBrowserStorageDirectory.
 */
const GM_QUEUE_KEY = "mergedl.queue"
const RELATIVE_PATH = "/MergeDL/inbox.jsonl"

function candidateRoots(): string[] {
  const roots: string[] = []
  try {
    if (FileManager.appGroupDocumentsDirectory) {
      roots.push(FileManager.appGroupDocumentsDirectory)
    }
  } catch {
    // Some hosts do not expose the shared container.
  }
  try {
    if (FileManager.safariBrowserStorageDirectory) {
      roots.push(FileManager.safariBrowserStorageDirectory)
    }
  } catch {
    // Ignore unavailable Safari storage.
  }
  return Array.from(new Set(roots))
}

export function inboxPaths(): string[] {
  return candidateRoots().map(root => `${root}${RELATIVE_PATH}`)
}

function parseLine(line: string): InboxJob | null {
  try {
    const value = JSON.parse(line) as InboxJob
    if (!value || typeof value.url !== "string" || !value.url) return null
    return {
      id: String(value.id || `${Date.now()}-${Math.random()}`),
      url: value.url,
      filename: typeof value.filename === "string" ? value.filename : undefined,
      pageUrl: typeof value.pageUrl === "string" ? value.pageUrl : undefined,
      createdAt: Number(value.createdAt) || Date.now(),
    }
  } catch {
    return null
  }
}

type StorageFile = { path: string; data: Record<string, any> }

function gmStorageFiles(): StorageFile[] {
  let root = ""
  try {
    root = FileManager.safariBrowserStorageDirectory || ""
  } catch {
    return []
  }
  if (!root || !FileManager.existsSync(root)) return []
  let files: string[] = []
  try {
    files = FileManager.readDirectorySync(root) || []
  } catch {
    return []
  }
  const result: StorageFile[] = []
  for (const entry of files) {
    const path = entry.indexOf("/") === 0 ? entry : `${root}/${entry}`
    if (!path.toLowerCase().endsWith(".json")) continue
    try {
      const data = JSON.parse(FileManager.readAsStringSync(path))
      if (data && typeof data === "object") result.push({ path, data })
    } catch {
      // Ignore non-JSON or unreadable GM storage files.
    }
  }
  return result
}

function takeGmQueue(): InboxJob[] {
  const jobs: InboxJob[] = []
  for (const file of gmStorageFiles()) {
    const queue = file.data[GM_QUEUE_KEY]
    if (!Array.isArray(queue)) continue
    for (const item of queue) {
      const job = parseLine(JSON.stringify(item))
      if (job) jobs.push(job)
    }
    file.data[GM_QUEUE_KEY] = []
    try {
      FileManager.writeAsStringSync(file.path, JSON.stringify(file.data))
    } catch {
      // The next poll retries; dedupe avoids duplicate pushes.
    }
  }
  return jobs
}

function gmQueueCount(): number {
  let count = 0
  for (const file of gmStorageFiles()) {
    const queue = file.data[GM_QUEUE_KEY]
    if (Array.isArray(queue)) count += queue.length
  }
  return count
}

/** Re-queue a job (for example when its push failed). */
export function appendInbox(job: InboxJob): void {
  const path = inboxPaths()[0]
  if (!path) return
  try {
    const directory = path.slice(0, path.lastIndexOf("/"))
    FileManager.createDirectorySync(directory, true)
    FileManager.appendTextSync(path, JSON.stringify(job) + "\n")
  } catch {
    // The next poll will retry; do not crash the UI on a storage error.
  }
}

/** Read and clear all pending jobs from both GM storage and the JSONL fallback. */
export function takeInbox(): InboxJob[] {
  const jobs = takeGmQueue()
  for (const path of inboxPaths()) {
    let text = ""
    try {
      if (!FileManager.existsSync(path)) continue
      text = FileManager.readAsStringSync(path)
    } catch {
      continue
    }
    const lines = text.split("\n").filter(line => line.trim().length > 0)
    for (const line of lines) {
      const job = parseLine(line)
      if (job) jobs.push(job)
    }
    try {
      FileManager.writeAsStringSync(path, "")
    } catch {
      // Leave the file untouched if it cannot be cleared.
    }
  }
  const seen = new Set<string>()
  return jobs.filter(job => {
    const key = `${job.url}|${job.createdAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function pendingInboxCount(): number {
  let count = gmQueueCount()
  for (const path of inboxPaths()) {
    try {
      if (!FileManager.existsSync(path)) continue
      count += FileManager.readAsStringSync(path)
        .split("\n")
        .filter(line => line.trim().length > 0).length
    } catch {
      // Ignore unreadable bridge files.
    }
  }
  return count
}
