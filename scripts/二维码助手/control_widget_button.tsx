import { ControlWidget, ControlWidgetButton } from "scripting";
import { OpenScanCameraIntent } from "./app_intents";

// 控制中心圆形/方形按钮：点按后打开主应用并直达相机
ControlWidget.present(
  <ControlWidgetButton
    intent={OpenScanCameraIntent()}
    label={{ title: "扫码", systemImage: "qrcode.viewfinder" }}
  />
);
