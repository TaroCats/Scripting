import { VStack, HStack, Text, Image, RoundedRectangle, type Color } from "scripting";

export function StatCard({ title, value, icon, tint }: { title: string; value: string; icon: string; tint?: Color }) {
  return (
    <VStack
      spacing={8}
      padding={14}
      alignment="leading"
      frame={{ maxWidth: Infinity, alignment: "leading" }}
      background={<RoundedRectangle cornerRadius={14} style="continuous" fill="secondarySystemGroupedBackground" />}
    >
      <HStack spacing={6} alignment="center">
        <Image systemName={icon} font={13} foregroundStyle={tint ?? "accentColor"} fontWeight="semibold" />
        <Text foregroundStyle="secondaryLabel" font={13}>{title}</Text>
      </HStack>
      <Text font={24} fontWeight="bold" monospacedDigit={true}>{value}</Text>
    </VStack>
  );
}
