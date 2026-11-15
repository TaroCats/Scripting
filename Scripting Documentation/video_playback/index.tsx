import { Button, Navigation, NavigationStack, Script, ScrollView, Text, useEffect, useMemo, useRef, useState, VideoPlaybackPlayer, VStack } from "scripting"

function Example() {
  const dismiss = Navigation.useDismiss()
  const player = useMemo(() => new VideoPlaybackController(), [])
  const [message, setMessage] = useState("Choose a local movie or audio file.")
  const alive = useRef(true)
  const report = (value: string) => { if(alive.current) setMessage(value) }
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { alive.current=false; void player.dispose() }, [player])
  async function choose() {
    setBusy(true)
    try {
      const files = await DocumentPicker.pickFiles({ types: ["public.data"], allowsMultipleSelection: false })
      if (!files.length || !alive.current) return
      await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
      await SharedAudioSession.setActive(true)
      const info = await player.open(files[0])
      report(`Backend: ${info.backend}`)
      await player.play()
    } catch (error) { report(String(error)) }
    finally { if(alive.current) setBusy(false) }
  }
  async function subtitles() {
    try {
      const files = await DocumentPicker.pickFiles({ types: ["public.data"], allowsMultipleSelection: false })
      if (files.length && alive.current) await player.loadSubtitleFile(files[0])
    } catch (error) { report(String(error)) }
  }
  return <NavigationStack><ScrollView><VStack spacing={12} padding navigationTitle="Video Playback">
    <VideoPlaybackPlayer controller={player} title="Video Playback" frame={{height:260}} onError={error=>report(String(error))} />
    <Text>{message}</Text>
    <Button title="Choose media" disabled={busy} action={choose} />
    <Button title="Load subtitles" disabled={busy} action={subtitles} />
    <Button title="Add danmaku" action={async()=>{
      try { await player.injectDanmaku([{time:player.position+1,text:"Hello",mode:"scroll"}]) }
      catch(error) { report(String(error)) }
    }} />
    <Button title="Done" action={async()=>{await player.dispose();dismiss()}} />
  </VStack></ScrollView></NavigationStack>
}
async function run() {
  await Navigation.present(<Example />)
  Script.exit()
}
run()
