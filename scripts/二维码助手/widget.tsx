import { VStack, HStack, Text, Image, Link, Widget, Spacer, ZStack, RoundedRectangle, Script } from "scripting";
import { loadRecords } from "./types/storage";
import { QrRecord } from "./types/types";

// 与 script.json 的品牌色保持一致
const BRAND = "#4766C2";

function runURL(params: Record<string, string>) {
  return Script.createRunURLScheme(Script.name, params);
}

// 判断小组件可配置的 Parameter 字段是否要求“直接打开相机”
function isCameraParam(p: string | null | undefined) {
  const v = (p ?? "").trim().toLowerCase();
  return ["camera", "scan", "扫码", "扫一扫"].includes(v);
}

function shortTime(t: number) {
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function IconBadge({ size = 40, font = 17 }: { size?: number; font?: number }) {
  return (
    <ZStack frame={{ width: size, height: size }} alignment="center">
      <RoundedRectangle cornerRadius={size * 0.26} fill={BRAND} frame={{ width: size, height: size }} />
      <Image systemName="qrcode.viewfinder" font={font} foregroundStyle="white" fontWeight="semibold" />
    </ZStack>
  );
}

// 横向图标+文字按钮，用于中/大尺寸小组件
function ActionLink({ label, icon, tab, action }: { label: string; icon: string; tab: string; action?: string }) {
  return (
    <Link url={runURL({ tab, ...(action ? { action } : {}) })} frame={{ maxWidth: Infinity }}>
      <HStack
        spacing={6}
        padding={{ horizontal: 12, vertical: 8 }}
        frame={{ maxWidth: Infinity, alignment: "center" }}
        background={<RoundedRectangle cornerRadius={12} style="continuous" fill="secondarySystemGroupedBackground" />}
      >
        <Image systemName={icon} font={14} foregroundStyle="accentColor" fontWeight="semibold" />
        <Text font={14} fontWeight="semibold" foregroundStyle="accentColor">{label}</Text>
      </HStack>
    </Link>
  );
}

// systemSmall 专用：纵向图标+文字的紧凑按钮，避免横向文字挤压导致错位
function SmallAction({ label, icon, tab, action }: { label: string; icon: string; tab: string; action?: string }) {
  return (
    <Link url={runURL({ tab, ...(action ? { action } : {}) })} frame={{ maxWidth: Infinity }}>
      <VStack
        spacing={3}
        padding={{ vertical: 8 }}
        alignment="center"
        frame={{ maxWidth: Infinity }}
        background={<RoundedRectangle cornerRadius={12} style="continuous" fill="secondarySystemGroupedBackground" />}
      >
        <Image systemName={icon} font={14} foregroundStyle="accentColor" fontWeight="semibold" />
        <Text font={11} fontWeight="semibold" foregroundStyle="accentColor">{label}</Text>
      </VStack>
    </Link>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <VStack spacing={2} alignment="center" frame={{ maxWidth: Infinity }}>
      <Text font={20} fontWeight="bold" monospacedDigit={true}>{value}</Text>
      <Text font={11} foregroundStyle="secondaryLabel">{label}</Text>
    </VStack>
  );
}

function WidgetView() {
  const records: QrRecord[] = loadRecords();
  const total = records.length;
  const scanCount = records.filter((r) => r.type === "SCAN").length;
  const generateCount = records.filter((r) => r.type === "GENERATE").length;
  const lastRecord = records[0];

  const family = Widget.family;
  const widgetParam = Widget.parameter;
  // 默认点按（空白区域）：当用户在小组件上配置了 Parameter 为 camera/scan 时，直接打开相机。
  const defaultURL = isCameraParam(widgetParam)
    ? runURL({ action: "camera" })
    : runURL({ tab: "scan" });

  if (family === "accessoryCircular") {
    return (
      <Link url={runURL({ action: "camera" })}>
        <ZStack frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
          <Image systemName="qrcode.viewfinder" font={20} foregroundStyle="white" />
        </ZStack>
      </Link>
    );
  }

  if (family === "accessoryRectangular") {
    return (
      <Link url={runURL({ action: "camera" })}>
        <HStack spacing={6} alignment="center" frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
          <Image systemName="qrcode.viewfinder" font={18} foregroundStyle="white" />
          <VStack spacing={1} alignment="leading">
            <Text font={15} fontWeight="semibold" foregroundStyle="white">扫码识别</Text>
            <Text font={11} foregroundStyle="rgba(255,255,255,0.72)">{total > 0 ? `${total} 条记录` : "扫码 · 生成 · 历史"}</Text>
          </VStack>
        </HStack>
      </Link>
    );
  }

  if (family === "accessoryInline") {
    return (
      <Link url={runURL({ action: "camera" })}>
        <HStack spacing={4} alignment="center">
          <Image systemName="qrcode.viewfinder" font={12} />
          <Text font={14} fontWeight="semibold">扫码识别</Text>
        </HStack>
      </Link>
    );
  }

  // 主屏幕小组件：systemSmall / systemMedium / systemLarge
  if (family === "systemLarge") {
    return (
      <VStack
        spacing={12}
        padding={16}
        alignment="leading"
        frame={{ maxWidth: Infinity, maxHeight: Infinity }}
        widgetURL={defaultURL}
      >
        <HStack spacing={10} alignment="center" frame={{ maxWidth: Infinity }}>
          <IconBadge size={38} font={16} />
          <VStack spacing={2} alignment="leading">
            <Text font={16} fontWeight="bold">二维码助手</Text>
            <Text font={11} foregroundStyle="secondaryLabel">扫一扫 · 生成 · 历史记录</Text>
          </VStack>
          <Spacer />
          <VStack spacing={0} alignment="trailing">
            <Text font={28} fontWeight="bold" monospacedDigit={true}>{total}</Text>
            <Text font={10} foregroundStyle="secondaryLabel">条记录</Text>
          </VStack>
        </HStack>

        <HStack spacing={10} frame={{ maxWidth: Infinity }}>
          <StatItem value={total} label="全部" />
          <StatItem value={scanCount} label="扫码" />
          <StatItem value={generateCount} label="生成" />
        </HStack>

        <HStack spacing={10} frame={{ maxWidth: Infinity }}>
          <ActionLink label="扫码" icon="qrcode.viewfinder" tab="scan" action="camera" />
          <ActionLink label="生成" icon="plus.app" tab="generate" />
        </HStack>

        {records.length > 0 ? (
          <VStack spacing={8} alignment="leading" frame={{ maxWidth: Infinity }}>
            <Text font={12} fontWeight="semibold" foregroundStyle="secondaryLabel">最近记录</Text>
            {records.slice(0, 5).map((r) => (
              <HStack key={r.id} spacing={8} alignment="center" frame={{ maxWidth: Infinity }}>
                <Image
                  systemName={r.type === "SCAN" ? "qrcode.viewfinder" : "plus.app"}
                  font={12}
                  foregroundStyle="secondaryLabel"
                />
                <Text font={13} lineLimit={1} truncationMode="tail" frame={{ maxWidth: Infinity, alignment: "leading" }}>
                  {r.content}
                </Text>
                <Text font={11} foregroundStyle="secondaryLabel">{shortTime(r.timestamp)}</Text>
              </HStack>
            ))}
          </VStack>
        ) : (
          <Spacer />
        )}
      </VStack>
    );
  }

  if (family === "systemMedium") {
    return (
      <HStack
        spacing={12}
        padding={16}
        alignment="center"
        frame={{ maxWidth: Infinity, maxHeight: Infinity }}
        widgetURL={defaultURL}
      >
        <VStack spacing={8} alignment="leading" frame={{ width: 150 }}>
          <IconBadge size={42} font={18} />
          <Text font={16} fontWeight="bold">二维码助手</Text>
          <Text font={11} foregroundStyle="secondaryLabel" lineLimit={2}>
            {lastRecord ? `最近：${lastRecord.content}` : "扫码、生成与历史记录"}
          </Text>
        </VStack>

        <VStack spacing={12} alignment="center" frame={{ maxWidth: Infinity }}>
          <HStack spacing={12} frame={{ maxWidth: Infinity }}>
            <StatItem value={total} label="全部" />
            <StatItem value={scanCount} label="扫码" />
            <StatItem value={generateCount} label="生成" />
          </HStack>
          <ActionLink label="扫码识别" icon="qrcode.viewfinder" tab="scan" action="camera" />
          <ActionLink label="生成二维码" icon="plus.app" tab="generate" />
        </VStack>
      </HStack>
    );
  }

  // systemSmall
  return (
    <VStack
      spacing={10}
      padding={14}
      alignment="leading"
      frame={{ maxWidth: Infinity, maxHeight: Infinity }}
      widgetURL={defaultURL}
    >
      <HStack spacing={7} alignment="center" frame={{ maxWidth: Infinity }}>
        <IconBadge size={24} font={10} />
        <VStack spacing={1} alignment="leading" frame={{ maxWidth: Infinity }}>
          <Text font={12} fontWeight="bold">二维码助手</Text>
          <Text font={10} foregroundStyle="secondaryLabel">{total} 条历史记录</Text>
        </VStack>
      </HStack>

      <Spacer />

      <HStack spacing={8} frame={{ maxWidth: Infinity }}>
        <SmallAction label="扫码" icon="qrcode.viewfinder" tab="scan" action="camera" />
        <SmallAction label="生成" icon="plus.app" tab="generate" />
      </HStack>
    </VStack>
  );
}

Widget.present(<WidgetView />);
