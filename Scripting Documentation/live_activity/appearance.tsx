// Save this UI registration as live_activity.tsx in your script.
// In index.tsx, import { KeylineDemo } from "./live_activity";
// const activity = KeylineDemo();
// await activity.start({ tint: "systemGreen", margin: 0 });
// await activity.update({ tint: "systemRed", margin: 4 });
// await activity.end({ tint: null, margin: 4 }, { dismissTimeInterval: 0 });
import { Color, Image, LiveActivity, LiveActivityUI, LiveActivityUIExpandedCenter, Text } from "scripting"

type State = { tint: Color | null; margin: number }

export const KeylineDemo = LiveActivity.register<State>("KeylineDemo", state =>
  <LiveActivityUI
    keylineTint={state.tint}
    dynamicIslandContentMargins={{
      compactLeading: { all: state.margin },
      compactTrailing: { all: state.margin },
    }}
    content={<Text>Dynamic Island appearance demo</Text>}
    compactLeading={<Image systemName="bolt.fill" />}
    compactTrailing={<Text>80%</Text>}
    minimal={<Image systemName="bolt.fill" />}
  >
    <LiveActivityUIExpandedCenter>
      <Text>System keyline tint</Text>
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>
)
