import {
  AbortController, Button, HStack, List, Navigation, NavigationStack, Path,
  Script, Section, Text, Toggle, useEffect, useRef, useState,
} from "scripting"

const zh = Device.systemLocales[0]?.startsWith("zh") ?? false
const t = (en: string, cn: string) => zh ? cn : en
let currentSession: ScreenCaptureSession | null = null
let currentController: AbortController | null = null

function Recorder() {
  const dismiss = Navigation.useDismiss()
  const [phase, setPhase] = useState("idle")
  const [systemAudio, setSystemAudio] = useState(true)
  const [showMic, setShowMic] = useState(true)
  const [micEnabled, setMicEnabled] = useState(false)
  const [duration, setDuration] = useState(0)
  const [bytes, setBytes] = useState(0)
  const [file, setFile] = useState<ScreenCaptureFileResult | null>(null)
  const [message, setMessage] = useState("")
  const mounted = useRef(true)
  const working = useRef(false)
  const [workingUI, setWorkingUI] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const clearTimer = () => { if (timer.current !== null) clearInterval(timer.current); timer.current = null }
  useEffect(() => () => {
    mounted.current = false
    clearTimer()
    currentController?.abort()
    void currentSession?.stop().catch(console.error)
  }, [])

  const report = (error: unknown) => {
    if (mounted.current) {
      setMessage(error instanceof Error ? error.message : String(error))
      setPhase("error")
    }
  }
  async function begin() {
    if (working.current || currentSession) return
    working.current = true; setWorkingUI(true)
    setPhase("starting"); setFile(null); setMessage(""); setDuration(0); setBytes(0)
    const controller = new AbortController()
    currentController = controller
    let owned: ScreenCaptureSession | null = null
    try {
      const folder = Path.join(FileManager.documentsDirectory, "Screen Recordings")
      await FileManager.createDirectory(folder, true)
      owned = await ScreenCapture.createSession({
        scope: "display", signal: controller.signal,
        picker: { showsMicrophoneControl: showMic },
        configuration: { capturesAudio: systemAudio },
      })
      currentSession = owned
      if (!mounted.current) { await owned.stop(); return }
      setMicEnabled(owned.selection.isMicrophoneEnabled)
      const recording = await owned.addRecordingOutput({
        filePath: Path.join(folder, `screen-${Date.now()}.mp4`),
        mixesAudioWithMicrophone: true,
      })
      recording.onStateChanged = state => {
        if (!mounted.current) return
        if (state === "recording") setPhase("recording")
        if (state === "finishing") setPhase("stopping")
      }
      // A recording may finish before the stream (for example, a disk write failure).
      // Observe both outcomes immediately so the demo never leaves capture running.
      const active = owned
      const completion = recording.finished.then(
        async result => { await active.stop(); return result },
        async error => { try { await active.stop() } catch (cleanup) { console.error(cleanup) }; throw error },
      )
      completion.catch(() => {})
      await owned.start()
      timer.current = setInterval(() => {
        if (!mounted.current) return
        setDuration(recording.recordedDuration)
        setBytes(recording.recordedFileSize)
      }, 500)
      const end = await owned.closed
      clearTimer()
      if (end.error) throw end.error
      const result = await completion
      if (mounted.current) {
        setFile(result); setDuration(result.duration); setBytes(result.fileSize)
        setPhase("finished")
      }
    } catch (error) {
      if ((error as ScreenCaptureError)?.code === "userCancelled" || (error as ScreenCaptureError)?.code === "aborted") {
        if (mounted.current) setPhase("idle")
      } else report(error)
    } finally {
      clearTimer()
      if (owned) {
        try { await owned.stop(); if (currentSession === owned) currentSession = null }
        catch (error) { report(error) } // Keep the handle so Stop can retry.
      }
      if (currentController === controller) currentController = null
      working.current = false
      if (mounted.current) setWorkingUI(false)
    }
  }
  async function stop() {
    if (currentSession) {
      setPhase("stopping")
      const owned = currentSession
      try {
        const end = await owned.stop()
        if (!working.current) {
          if (currentSession === owned) currentSession = null
          const result = end.recordings.find(item => item.result)?.result
          if (mounted.current) { setFile(result ?? null); setPhase(result ? "finished" : "idle") }
        }
      } catch (error) { report(error) }
    } else currentController?.abort()
  }
  const busy = workingUI || currentSession !== null
  const labels: Record<string, string> = {
    idle: t("Ready", "准备就绪"), starting: t("Waiting for sharing and recording", "等待共享与录制开始"),
    recording: t("Recording", "正在录制"), stopping: t("Finishing the file", "正在完成文件写入"),
    finished: t("Recording saved", "录制已保存"), error: t("Unable to complete recording", "录制未能完成"),
  }
  return <NavigationStack><List navigationTitle={t("Screen Recording", "屏幕录制")} toolbar={{
    cancellationAction: <Button title={t("Close", "关闭")} action={dismiss} />,
  }}>
    <Section header={<Text>{t("Capture", "采集")}</Text>}>
      <Text>{t("Requires iOS 27 or later. Choose Share Entire Screen in the system picker, then switch to another app. Stop here or from the system recording indicator.", "需要 iOS 27 或更新系统。在系统选择器中选择共享整个屏幕，然后可切换到其他 App。返回此处停止，或使用系统录制指示器停止。")}</Text>
      <Toggle title={t("Include system audio", "包含系统声音")} value={systemAudio} onChanged={setSystemAudio} disabled={busy} />
      <Toggle title={t("Show microphone option", "显示麦克风选项")} value={showMic} onChanged={setShowMic} disabled={busy} />
      <Text>{t("Enable the microphone in the system picker if you want narration. This script saves a local file and does not upload it.", "如需录制讲解，请在系统选择器中启用麦克风。本脚本仅保存本地文件，不会上传。")}</Text>
      <HStack>
        <Button title={t("Start recording", "开始录制")} action={() => { void begin() }} disabled={busy || !ScreenCapture.isSupported} />
        <Button title={t("Stop / Cancel", "停止 / 取消")} action={() => { void stop() }} disabled={!busy} />
      </HStack>
    </Section>
    <Section header={<Text>{t("Status", "状态")}</Text>}>
      <Text>{labels[phase]}</Text>
      <Text>{`${duration.toFixed(1)} s · ${(bytes / 1048576).toFixed(2)} MB`}</Text>
      <Text>{micEnabled ? t("Microphone enabled by system selection", "系统选择已启用麦克风") : t("Microphone not enabled", "麦克风未启用")}</Text>
      {message ? <Text>{message}</Text> : null}
    </Section>
    {file ? <Section header={<Text>{t("Saved recording", "已保存的录制")}</Text>}>
      <Text>{file.filePath}</Text>
      <Button title={t("Preview recording", "预览录制")} action={() => {
        void ScreenCapture.presentRecordingEditor(file.filePath).catch(report)
      }} />
    </Section> : null}
  </List></NavigationStack>
}

async function main() {
  try { await Navigation.present({ element: <Recorder /> }) }
  finally {
    currentController?.abort()
    try { await currentSession?.stop() } catch (error) { console.error(error) }
    Script.exit()
  }
}
void main()
