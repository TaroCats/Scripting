import { AppIntentManager, AppIntentProtocol, Script } from "scripting";

// 控制中心「扫码」按钮背后的意图。
// AppIntent 运行在扩展进程，无法直接 present UI。
// 正确做法：通过 scripting://run/... URL scheme 唤起 Scripting 主应用，
// 主应用处理该 scheme 运行 index.tsx，读到 action=camera 后直达相机。
// 这与 widget.tsx 里 Link 的机制完全一致，是系统已验证能唤起前台的通道。
export const OpenScanCameraIntent = AppIntentManager.register<void>({
  name: "OpenScanCameraIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    const url = Script.createRunURLScheme(Script.name, { action: "camera" });
    await Safari.openURL(url);
  },
});
