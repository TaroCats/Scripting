import {
  type DashboardData,
  type AgendaItem,
  loadDashboardData,
  formatEventTime,
} from "./shared/shared";
import {
  Text,
  Widget,
  useState,
  useEffect,
  Navigation,
  NavigationStack,
  List,
  Script,
  ProgressView,
  ContentUnavailableView,
  HStack,
  VStack,
  Image,
  Spacer,
  ScrollView,
  Divider,
  ZStack,
  Circle,
  RoundedRectangle,
  TabView,
  Tab,
  Section,
} from "scripting";

// 天气图标用轻微阴影增加层次感
function WeatherIcon({
  symbolName,
  size = 56,
}: {
  symbolName: string;
  size?: number;
}) {
  return (
    <Image
      systemName={symbolName}
      font={size}
      symbolRenderingMode="multicolor"
      shadow={{ color: "systemGray", radius: 4, y: 2 }}
    />
  );
}

// 液态玻璃卡片容器
function GlassCard({
  children,
  padding = 16,
}: {
  children: any;
  padding?: number;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={12}
      padding={padding}
      glassEffect={{ type: "rect", cornerRadius: 20 }}
      listRowInsets={{ top: 8, bottom: 8, leading: 16, trailing: 16 }}
      listRowSeparator="hidden"
    >
      {children}
    </VStack>
  );
}

function WeatherHero({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather;
  if (!w) {
    return (
      <ContentUnavailableView
        title="天气不可用"
        systemImage="cloud.slash"
        description={dashboard.warnings?.join(" ") || "无法获取天气信息"}
      />
    );
  }

  return (
    <VStack alignment="center" spacing={8} frame={{ maxWidth: "infinity" }}>
      <Text font="title3" foregroundStyle="secondaryLabel">
        {dashboard.locationName}
      </Text>
      <WeatherIcon symbolName={w.symbolName} size={64} />
      <HStack alignment="top" spacing={4} offset={{ x: 10, y: 0 }}>
        <Text font={72} bold>
          {w.temperature}
        </Text>
        <Text
          font={40}
          bold
          foregroundStyle="secondaryLabel"
          offset={{ x: 0, y: 6 }}
        >
          °
        </Text>
      </HStack>
      <Text font="title3" bold>
        {w.condition}
      </Text>
      <HStack alignment="center" spacing={12}>
        <HStack alignment="center" spacing={4}>
          <Image systemName="arrow.up" font={12} foregroundStyle="systemRed" />
          <Text font="subheadline" bold foregroundStyle="secondaryLabel">
            {w.highTemperature}°
          </Text>
        </HStack>
        <Divider frame={{ height: 12 }} />
        <HStack alignment="center" spacing={4}>
          <Image
            systemName="arrow.down"
            font={12}
            foregroundStyle="systemBlue"
          />
          <Text font="subheadline" bold foregroundStyle="secondaryLabel">
            {w.lowTemperature}°
          </Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

function HourlyStrip({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather;
  if (!w || w.hourlyForecast.length === 0) return null;

  return (
    <GlassCard>
      <Text font="headline" bold>
        逐时预报
      </Text>
      <ScrollView axes="horizontal">
        <HStack spacing={10}>
          {w.hourlyForecast.map((h, i) => (
            <VStack
              key={i}
              alignment="center"
              spacing={6}
              padding={{ vertical: 12, horizontal: 14 }}
              background={
                <RoundedRectangle
                  cornerRadius={14}
                  fill={i === 0 ? "tintColor" : "secondarySystemFill"}
                  opacity={i === 0 ? 0.18 : 1}
                />
              }
            >
              <Text
                font="footnote"
                foregroundStyle={i === 0 ? "label" : "secondaryLabel"}
              >
                {h.time}
              </Text>
              <Image
                systemName={h.symbolName}
                font={22}
                symbolRenderingMode="multicolor"
                shadow={{ color: "systemGray", radius: 4, y: 2 }}
                frame={{ width: 28, height: 28, alignment: "center" }}
              />
              <Text
                font="subheadline"
                bold
                foregroundStyle={i === 0 ? "label" : "secondaryLabel"}
              >
                {h.temperature}°
              </Text>
            </VStack>
          ))}
        </HStack>
      </ScrollView>
    </GlassCard>
  );
}

function WeatherDetails({ dashboard }: { dashboard: DashboardData }) {
  const w = dashboard.weather;
  if (!w) return null;

  const items: { icon: string; label: string; value: string }[] = [
    { icon: "thermometer.medium", label: "体感", value: w.apparentTemperature },
    { icon: "humidity", label: "湿度", value: w.humidity },
    { icon: "wind", label: "风向", value: w.wind },
  ];
  if (w.dailySummary) {
    items.push({ icon: "calendar", label: "明日", value: w.dailySummary });
  }

  return (
    <GlassCard>
      <Text font="headline" bold>
        天气详情
      </Text>
      <VStack spacing={10}>
        {items.map((row) => (
          <HStack
            key={row.label}
            alignment="center"
            spacing={10}
            padding={{ vertical: 10, horizontal: 12 }}
            background={
              <RoundedRectangle cornerRadius={12} fill="secondarySystemFill" />
            }
          >
            <Image
              systemName={row.icon}
              font={16}
              foregroundStyle="tintColor"
              frame={{ width: 24, height: 24, alignment: "center" }}
            />
            <Text font="subheadline" foregroundStyle="secondaryLabel">
              {row.label}
            </Text>
            <Spacer />
            <Text font="subheadline" bold lineLimit={1}>
              {row.value}
            </Text>
          </HStack>
        ))}
      </VStack>
    </GlassCard>
  );
}

function AgendaRow({ event }: { event: AgendaItem }) {
  const isReminder = event.type === "reminder";
  return (
    <HStack alignment="center" spacing={12} padding={{ vertical: 8 }}>
      <ZStack>
        <Circle
          fill={isReminder ? "systemOrange" : "systemBlue"}
          opacity={0.15}
          frame={{ width: 34, height: 34 }}
        />
        <Image
          systemName={isReminder ? "bell.fill" : "calendar"}
          font={14}
          foregroundStyle={isReminder ? "systemOrange" : "systemBlue"}
        />
      </ZStack>
      <VStack alignment="leading" spacing={2}>
        <Text font="body" bold lineLimit={1}>
          {event.title}
        </Text>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          {formatEventTime(event)}
        </Text>
      </VStack>
      <Spacer />
    </HStack>
  );
}

function AgendaTab({ dashboard }: { dashboard: DashboardData }) {
  const events = dashboard.upcomingEvents;
  return (
    <Section>
      <Text font="headline" bold>
        最近行程
      </Text>
      {events.length === 0 ? (
        <ContentUnavailableView title="最近无事发生" systemImage="calendar" />
      ) : (
        <VStack spacing={4}>
          {events.map((event) => (
            <AgendaRow key={event.identifier} event={event} />
          ))}
        </VStack>
      )}
    </Section>
  );
}

function WeatherTab({ dashboard }: { dashboard: DashboardData }) {
  return (
    <Section>
      <WeatherHero dashboard={dashboard} />
      <HourlyStrip dashboard={dashboard} />
      <WeatherDetails dashboard={dashboard} />
    </Section>
  );
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState(0);

  const refreshDashboard = async () => {
    try {
      const nextDashboard = await loadDashboardData();
      setDashboard(nextDashboard);
      Widget.reloadAll();
    } catch (error) {
      setDashboard(null);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  const loadingView = <ProgressView title="加载中..." />;

  return (
    <NavigationStack>
      <TabView
        tabIndex={tab}
        onTabIndexChanged={setTab}
        tabViewStyle="tabBarOnly"
      >
        <Tab title="天气" systemImage="cloud.sun.fill" value={0}>
          <List navigationTitle="天气日程助手">
            {!dashboard ? loadingView : <WeatherTab dashboard={dashboard} />}
          </List>
        </Tab>
        <Tab title="行程" systemImage="calendar" value={1}>
          <List navigationTitle="天气日程助手">
            {!dashboard ? loadingView : <AgendaTab dashboard={dashboard} />}
          </List>
        </Tab>
      </TabView>
    </NavigationStack>
  );
}

async function runApp() {
  await Navigation.present({
    element: <App />,
  });

  Script.exit();
}

runApp();
