# Sample Buffer Playback

Render native audio and video samples on a shared timeline in main App scripts on iOS/iPadOS 17 or later. `AVSampleBufferDisplayLayer` displays video through `SampleBufferView`; `AVSampleBufferAudioRenderer` plays audio; `AVSampleBufferRenderSynchronizer` coordinates their timestamps.

Playback does not request camera or microphone access. File access follows the document picker / existing AVAsset rules. Audio uses the shared audio session: configure its category deliberately and avoid deactivating a session another feature is using. The demo activates the current session and does not deactivate other owners on exit.

Choose a local movie or audio file in the runnable demo. Both audio and video start from the earliest source timestamp. The page supplies Pause, Resume and Stop controls and releases readers, samples, renderers and clock on exit. Native media codecs and device output depend on the system.

## index.tsx

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
