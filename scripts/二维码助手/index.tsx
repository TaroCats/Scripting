import { useState, TabView, Tab, NavigationStack, Navigation, Script } from "scripting";
import { QrRecord, AppSettings, RedirectRule } from "./types/types";
import { loadRecords, persistRecords, loadSettings, persistSettings } from "./types/storage";
import { ScanView } from "./page/ScanView";
import { GenerateView } from "./page/GenerateView";
import { HistoryView } from "./page/HistoryView";
import { CameraScanView } from "./page/CameraScanView";
import { resolveRedirectTarget } from "./utils/redirectRules";
import { ScanApiRequest, parseScanApiRequest, scanApiSuccess, scanApiCancelled, scanApiError } from "./utils/scanApi";

type LaunchIntent = {
  initialTabIndex: number;
  autoLaunchScan: boolean;
  directCamera: boolean;
};

// 解析小组件/快捷指令通过 scripting://run/... 传入的深链参数，
// 以及小组件可配置的 Parameter 字段（点击后写入 Script.widgetParameter）。
function parseLaunchIntent(): LaunchIntent {
  const params = Script.queryParameters ?? {};
  const tab = typeof params.tab === "string" ? params.tab : "";
  const action = typeof params.action === "string" ? params.action : "";
  const widgetParam = (Script.widgetParameter ?? "").trim().toLowerCase();
  const controlParam = ((Script as any).controlWidgetParameter ?? "").trim().toLowerCase();

  let initialTabIndex = 0;
  if (tab === "generate") initialTabIndex = 1;
  else if (tab === "history") initialTabIndex = 2;

  // 主屏小组件 Parameter 或控制中心控件的 Parameter 配置为 camera/scan 时，等价于 action=camera 直接拉起相机。
  const cameraParam =
    ["camera", "scan", "扫码", "扫一扫"].includes(widgetParam) ||
    ["camera", "scan", "扫码", "扫一扫"].includes(controlParam);

  return {
    initialTabIndex,
    autoLaunchScan: action === "scan",
    directCamera: action === "camera" || cameraParam,
  };
}

function MainApp({ initialTabIndex, autoLaunchScan }: LaunchIntent) {
  const [records, setRecords] = useState<QrRecord[]>(() => loadRecords());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [tabIndex, setTabIndex] = useState(initialTabIndex);

  const [isScanConfigOpen, setIsScanConfigOpen] = useState(false);
  const [historySelectionMode, setHistorySelectionMode] = useState(false);

  const saveRecords = async (list: QrRecord[]) => {
    setRecords(list);
    persistRecords(list);
  };

  const handleAdd = (r: QrRecord) => saveRecords([r, ...records]);
  const handleDelete = (id: string) => saveRecords(records.filter((r) => r.id !== id));
  const handleDeleteMultiple = (ids: string[]) => saveRecords(records.filter((r) => !ids.includes(r.id)));

  const handleClear = async () => {
    await saveRecords([]);
  };

  const handleAutoScanChange = (value: boolean) => {
    const next = { ...settings, autoScanOnOpen: value };
    setSettings(next);
    persistSettings(next);
  };

  const handleAutoRedirectChange = (value: boolean) => {
    const next = { ...settings, autoRedirect: value };
    setSettings(next);
    persistSettings(next);
  };

  const handleRedirectRulesChange = (rules: RedirectRule[]) => {
    const next = { ...settings, redirectRules: rules };
    setSettings(next);
    persistSettings(next);
  };

  const handleFallbackEnabledChange = (value: boolean) => {
    const next = { ...settings, fallbackEnabled: value };
    setSettings(next);
    persistSettings(next);
  };

  const handleFallbackUrlSchemeChange = (value: string) => {
    const next = { ...settings, fallbackUrlScheme: value };
    setSettings(next);
    persistSettings(next);
  };

  const handleSubscriptionUrlChange = (value: string) => {
    const next = { ...settings, subscriptionUrl: value };
    setSettings(next);
    persistSettings(next);
  };

  return (
    <TabView tabIndex={tabIndex} onTabIndexChanged={setTabIndex}>
      <Tab
        title="扫码"
        systemImage="qrcode.viewfinder"
        value={0}
        tabBarVisibility={isScanConfigOpen ? "hidden" : "visible"}
      >
        <NavigationStack tabBarVisibility={isScanConfigOpen ? "hidden" : "visible"}>
          <ScanView
            onAddRecord={handleAdd}
            autoScanOnOpen={settings.autoScanOnOpen}
            onAutoScanChange={handleAutoScanChange}
            autoLaunch={autoLaunchScan}
            autoRedirect={settings.autoRedirect}
            redirectRules={settings.redirectRules}
            onAutoRedirectChange={handleAutoRedirectChange}
            onRedirectRulesChange={handleRedirectRulesChange}
            fallbackEnabled={settings.fallbackEnabled}
            onFallbackEnabledChange={handleFallbackEnabledChange}
            fallbackUrlScheme={settings.fallbackUrlScheme}
            onFallbackUrlSchemeChange={handleFallbackUrlSchemeChange}
            subscriptionUrl={settings.subscriptionUrl}
            onSubscriptionUrlChange={handleSubscriptionUrlChange}
            isConfigOpen={isScanConfigOpen}
            onConfigToggle={setIsScanConfigOpen}
          />
        </NavigationStack>
      </Tab>

      <Tab title="生成" systemImage="plus.app" value={1}>
        <NavigationStack>
          <GenerateView onAddRecord={handleAdd} />
        </NavigationStack>
      </Tab>

      <Tab
        title="历史"
        systemImage="clock.fill"
        value={2}
        tabBarVisibility={historySelectionMode ? "hidden" : "visible"}
      >
        <NavigationStack tabBarVisibility={historySelectionMode ? "hidden" : "visible"}>
          <HistoryView
            records={records}
            onClear={handleClear}
            onDelete={handleDelete}
            onDeleteMultiple={handleDeleteMultiple}
            selectionMode={historySelectionMode}
            onEnterSelectionMode={() => setHistorySelectionMode(true)}
            onExitSelectionMode={() => setHistorySelectionMode(false)}
          />
        </NavigationStack>
      </Tab>
    </TabView>
  );
}

function makeScanRecord(content: string): QrRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    timestamp: Date.now(),
    type: "SCAN",
  };
}

// 小组件 accessory 直达扫码：直接写历史并跳转，不经过主界面。
async function handleQuickScanResult(content: string) {
  const records = loadRecords();
  persistRecords([makeScanRecord(content), ...records]);

  const settings = loadSettings();
  if (!settings.autoRedirect) return;

  const target = resolveRedirectTarget(content, settings.redirectRules, settings.fallbackEnabled, settings.fallbackUrlScheme);
  if (!target) return;

  try {
    await Safari.openURL(target.url);
  } catch {}
}

// 对外暴露的扫码函数：打开相机扫码，把识别结果直接返回给调用方（Script.run）。
// 返回体统一为 { ok, code, message }，调用方只需判断 ok。
async function runScanApi(request: ScanApiRequest) {
  // 结果通过闭包收集：CameraScanView 是单次模式，识别后会自行关闭页面。
  const collected: string[] = [];

  try {
    await Navigation.present({
      element: (
        <CameraScanView
          scanMode="single"
          onScanResult={(content) => {
            collected.push(content);
          }}
        />
      ),
      modalPresentationStyle: "fullScreen"
    });
  } catch (error: any) {
    Script.exit(scanApiError(String(error?.message ?? error ?? "打开相机失败")));
    return;
  }

  if (collected.length === 0) {
    Script.exit(scanApiCancelled());
    return;
  }

  const content = collected[0];
  const record = makeScanRecord(content);

  if (request.save) {
    persistRecords([record, ...loadRecords()]);
  }

  let redirected = false;
  let redirectTarget: string | undefined;

  if (request.redirect) {
    const settings = loadSettings();
    const target = resolveRedirectTarget(
      content,
      settings.redirectRules,
      settings.fallbackEnabled,
      settings.fallbackUrlScheme
    );
    if (target) {
      redirectTarget = target.url;
      try {
        await Safari.openURL(target.url);
        redirected = true;
      } catch {}
    }
  }

  Script.exit(
    scanApiSuccess({
      content,
      timestamp: record.timestamp,
      saved: request.save,
      redirected,
      redirectTarget,
    })
  );
}

const run = async () => {
  // 最高优先级：被其它脚本以 Script.run 调起（fn=scan），进入「扫码并返回结果」模式。
  const apiRequest = parseScanApiRequest(Script.queryParameters);
  if (apiRequest) {
    await runScanApi(apiRequest);
    return;
  }

  const intent = parseLaunchIntent();

  // accessory 小组件（锁屏）直达：直接全屏打开相机，扫完即退出，更快更便捷。
  if (intent.directCamera) {
    await Navigation.present({
      element: <CameraScanView scanMode="single" onScanResult={handleQuickScanResult} />,
      modalPresentationStyle: "fullScreen"
    });
    Script.exit();
    return;
  }

  await Navigation.present({
    element: <MainApp {...intent} />,
    modalPresentationStyle: "fullScreen"
  });
  Script.exit();
};

run();
