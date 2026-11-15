# Spatial audio

Connect individual mono sources to an `AVAudioEnvironmentNode`, then connect the environment to the main mixer. Each source uses an available input bus. Set source position and rendering algorithm through `setMixing()`. Read `getMixing().supported` and the environment's `applicableRenderingAlgorithms`; available algorithms depend on output format and device route.

`configure()` controls listener position/orientation, distance attenuation, reverb, output type and output volume. Use either vector orientation or angular orientation in one update. Positions use meters. Distance and algorithm determine the spatial effect; headphones and speakers can sound different. The API does not enable head tracking by itself.

Source mixing also exposes supported obstruction, occlusion, reverb blend and source/head modes. The returned supported list describes which controls apply to the node. Do not assume every ordinary node supports every 3D mixing control.

## Runnable index.tsx

The example generates two quiet mono tones locally and places them to the listener's left/right. Buttons move the listener; position and source frequencies are displayed as text, so the controls can also be understood without hearing the scene. Stop/Close release the graph and buffers. Run without another script using the shared device-audio session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
