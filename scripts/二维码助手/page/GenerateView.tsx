import { useState, useEffect, List, Section, VStack, HStack, ZStack, Text, Button, Image, Navigation, RoundedRectangle, type Color } from "scripting";
import { QrRecord } from "../types/types";
import { GlassCard } from "../components/GlassCard";
import { InputField } from "../components/InputField";
import { getQrImage } from "../utils/qr";
import { isProbablyURL, getValidURL, detectContentType, ContentType } from "../utils/url";

const CONTENT_TYPE_META: Record<ContentType, { label: string; icon: string; color: Color }> = {
  url: { label: "链接", icon: "link", color: "#007AFF" },
  wifi: { label: "WiFi", icon: "wifi", color: "#5856D6" },
  phone: { label: "电话", icon: "phone", color: "#34C759" },
  email: { label: "邮件", icon: "envelope", color: "#FF9500" },
  text: { label: "文本", icon: "text.cursor", color: "#8E8E93" },
};

const TEMPLATES = [
  { label: "网址", icon: "link", value: "https://" },
  { label: "WiFi", icon: "wifi", value: "WIFI:T:WPA;S:你的WiFi名称;P:你的密码;;" },
  { label: "电话", icon: "phone", value: "tel:13800138000" },
  { label: "邮件", icon: "envelope", value: "mailto:name@example.com" },
];

export function GenerateView({ onAddRecord }: { onAddRecord: (record: QrRecord) => void }) {
  const dismiss = Navigation.useDismiss();
  const [content, setContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [previewImage, setPreviewImage] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const notify = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  useEffect(() => {
    const text = content.trim();
    if (!text) {
      setPreviewContent("");
      setPreviewImage(null);
      return;
    }

    let cancelled = false;
    setIsGenerating(true);
    getQrImage(text)
      .then((img) => {
        if (cancelled) return;
        setPreviewContent(text);
        setPreviewImage(img ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [content]);

  const contentType = detectContentType(content);
  const typeMeta = CONTENT_TYPE_META[contentType];

  const handleGenerateAndSave = async () => {
    const text = content.trim();
    if (!text) return;
    Keyboard.hide();
    onAddRecord({ id: Date.now().toString(), content: text, timestamp: Date.now(), type: "GENERATE" });
    setPreviewContent(text);
    setPreviewImage(await getQrImage(text));
    Haptics.transient(0.6, 0.6);
    notify("已保存到历史记录");
  };

  // 保存图片到相册，失败则降级使用系统分享面板
  const handleSaveImage = async () => {
    if (!previewImage) return;
    setIsSaving(true);

    try {
      const imageData = previewImage.toPNGData();
      const ok = await Photos.savePhoto(imageData, {
        fileName: `qr-${Date.now()}.png`
      });

      if (ok) {
        Haptics.transient(0.6, 0.6);
        notify("已保存到相册");
      } else {
        throw new Error("写入系统相册被拒绝");
      }
    } catch (error: any) {
      console.error("相册存储失败：", error);
      notify("保存失败，请使用分享面板存储");

      try {
        await ShareSheet.present([previewImage]);
      } catch (shareError) {
        console.log("用户取消了分享");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!previewImage) return;
    try {
      await ShareSheet.present([previewImage]);
    } catch {}
  };

  const handlePreview = async () => {
    const text = previewContent.trim();
    if (!text) return;
    if (isProbablyURL(text)) {
      await Safari.present(getValidURL(text), true);
      return;
    }
    await Pasteboard.setString(text);
    Haptics.transient(0.4, 0.5);
    notify("不是链接，已复制到剪贴板");
  };

  return (
    <List
      navigationTitle="生成"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        topBarLeading: (
          <Button action={() => dismiss()} buttonStyle="plain">
            <Image systemName="xmark" foregroundStyle="red" fontWeight="semibold" />
          </Button>
        )
      }}
      toast={{
        isPresented: showToast,
        onChanged: setShowToast,
        message: toastMessage,
        position: "top",
        duration: 2,
      }}
    >
      <Section header={<Text>配置</Text>}>
        <GlassCard>
          <VStack spacing={10} alignment="leading" frame={{ maxWidth: Infinity }}>
            <Text fontWeight="semibold">二维码内容</Text>

            <InputField
              title="输入文本或网址..."
              value={content}
              onChanged={setContent}
              onSubmit={handleGenerateAndSave}
              icon="text.cursor"
            />

            {content.trim() ? (
              <HStack
                spacing={6}
                alignment="center"
                padding={{ horizontal: 10, vertical: 6 }}
                frame={{ maxWidth: Infinity, alignment: "leading" }}
                background={<RoundedRectangle cornerRadius={8} style="continuous" fill="tertiarySystemFill" />}
              >
                <Image systemName={typeMeta.icon} font={12} foregroundStyle={typeMeta.color} />
                <Text font={12} foregroundStyle={typeMeta.color} fontWeight="semibold">已识别为{typeMeta.label}</Text>
              </HStack>
            ) : (
              <VStack spacing={8} alignment="leading" frame={{ maxWidth: Infinity }}>
                <Text font={12} foregroundStyle="secondaryLabel">从模板开始</Text>
                <HStack spacing={8} frame={{ maxWidth: Infinity }}>
                  {TEMPLATES.map((t) => (
                    <Button
                      key={t.label}
                      action={() => setContent(t.value)}
                      buttonStyle="bordered"
                      buttonBorderShape="capsule"
                    >
                      <HStack spacing={4} alignment="center" padding={{ horizontal: 10, vertical: 5 }}>
                        <Image systemName={t.icon} font={12} />
                        <Text font={12} fontWeight="medium">{t.label}</Text>
                      </HStack>
                    </Button>
                  ))}
                </HStack>
              </VStack>
            )}

            <Button
              action={handleGenerateAndSave}
              disabled={!content.trim()}
              buttonStyle="borderedProminent"
            >
              <HStack spacing={6} frame={{ maxWidth: Infinity, alignment: "center" }} padding={6}>
                <Image systemName="qrcode" font={16} />
                <Text fontWeight="bold">保存二维码</Text>
              </HStack>
            </Button>
          </VStack>
        </GlassCard>
      </Section>

      {previewContent ? (
        <Section title="实时预览">
          <GlassCard padding={8}>
            <VStack spacing={12} alignment="center" frame={{ maxWidth: Infinity }}>
              <ZStack
                frame={{ width: 200, height: 200, alignment: "center" }}
                background={<RoundedRectangle cornerRadius={14} style="continuous" fill="secondarySystemGroupedBackground" />}
              >
                {previewImage ? (
                  <Image image={previewImage} resizable={true} frame={{ width: 200, height: 200 }} />
                ) : (
                  <VStack spacing={6} alignment="center">
                    <Image systemName="arrow.triangle.2.circlepath" foregroundStyle="gray" font={20} />
                    <Text font={12} foregroundStyle="gray">{isGenerating ? "生成中..." : "暂无预览"}</Text>
                  </VStack>
                )}
              </ZStack>

              <VStack spacing={4} alignment="center">
                <Text font={11} foregroundStyle="gray">当前内容：</Text>
                <Text font={13} fontWeight="medium" lineLimit={3} multilineTextAlignment="center">{previewContent}</Text>
              </VStack>

              <HStack spacing={8} frame={{ maxWidth: Infinity }}>
                <Button action={handleSaveImage} disabled={!previewImage || isSaving} buttonStyle="bordered">
                  <HStack spacing={4} frame={{ maxWidth: Infinity, alignment: "center" }} padding={2}>
                    <Image systemName="square.and.arrow.down" font={14} />
                    <Text font={13}>{isSaving ? "保存中..." : "保存图片"}</Text>
                  </HStack>
                </Button>
                <Button action={handleShare} disabled={!previewImage} buttonStyle="bordered">
                  <HStack spacing={4} frame={{ maxWidth: Infinity, alignment: "center" }} padding={2}>
                    <Image systemName="square.and.arrow.up" font={14} />
                    <Text font={13}>分享</Text>
                  </HStack>
                </Button>
                <Button action={handlePreview} disabled={!previewContent} buttonStyle="bordered">
                  <HStack spacing={4} frame={{ maxWidth: Infinity, alignment: "center" }} padding={2}>
                    <Image systemName="safari" font={14} />
                    <Text font={13}>打开</Text>
                  </HStack>
                </Button>
              </HStack>
            </VStack>
          </GlassCard>
        </Section>
      ) : null}
    </List>
  );
}
