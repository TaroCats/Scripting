export type DownloaderMode = "aria2" | "cloudreve"

export type Aria2Config = {
  rpcUrl: string
  secret: string
}

export type CloudreveToken = {
  accessToken: string
  refreshToken: string
  accessExpires: number
  refreshExpires: number
}

export type CloudreveConfig = {
  baseUrl: string
  email: string
  dst: string
  token: CloudreveToken | null
}

export type DownloadTask = {
  id: string
  name: string
  progress: number
  total: number
  downloaded: number
  speed: number
  status: string
  source: DownloaderMode
  phase?: string
}

export type CloudFolder = {
  id: string
  name: string
  path: string
}

export type CloudFolderNode = CloudFolder & {
  children: CloudFolderNode[]
}

export type InboxJob = {
  id: string
  url: string
  filename?: string
  pageUrl?: string
  createdAt: number
  channel?: DownloaderMode
}
