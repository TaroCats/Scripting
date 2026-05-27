import { Settings } from "./src/Settings";
import { fetchTraffic, getSurgeConfig } from "./src/api";

import { NavigationStack, NavigationLink, List, Section, Chart, LineChart, Script, useEffect, useState, Text, Navigation } from "scripting";

function Main() {
  const [inSpeed, setInSpeed] = useState<number[]>([0]);
  const [outSpeed, setOutSpeed] = useState<number[]>([0]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let lastIn = -1;
    let lastOut = -1;
    
    const interval = setInterval(async () => {
      try {
        const config = getSurgeConfig();
        if (!config.address || !config.port) {
          setError("请在设置中配置 Surge 地址和端口");
          return;
        }

        const data = await fetchTraffic(config);
        
        // Surge /v1/traffic 的 connector 对象包含了总流量
        const currentIn = data?.connector?.in ?? 0;
        const currentOut = data?.connector?.out ?? 0;
        
        if (lastIn !== -1) {
          const inDiff = currentIn - lastIn;
          const outDiff = currentOut - lastOut;
          
          setInSpeed((prev: number[]) => [...prev.slice(-29), inDiff]);
          setOutSpeed((prev: number[]) => [...prev.slice(-29), outDiff]);
          setError("");
        }
        
        lastIn = currentIn;
        lastOut = currentOut;
        
      } catch (err: any) {
        setError(err.message || "获取数据失败，请检查配置或 Surge 状态");
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const inMarks = inSpeed.map((val, index) => ({
    label: index.toString(),
    value: val / 1024 // 转换为 KB/s
  }));

  const outMarks = outSpeed.map((val, index) => ({
    label: index.toString(),
    value: val / 1024 // 转换为 KB/s
  }));

  return (
    <List navigationTitle="Surge 控制面板" navigationBarTitleDisplayMode="inline">
      <Section title="设置">
        <NavigationLink destination={<Settings />} title="API 配置" />
      </Section>

      {error ? (
        <Section title="错误">
           <Text>{error}</Text>
        </Section>
      ) : null}

      <Section title="下载速度 (KB/s)">
        <Chart>
          <LineChart
            labelOnYAxis={true}
            marks={inMarks}
          />
        </Chart>
      </Section>
      
      <Section title="上传速度 (KB/s)">
        <Chart>
          <LineChart
            labelOnYAxis={true}
            marks={outMarks}
          />
        </Chart>
      </Section>
    </List>
  );
}

async function run() {
  await Navigation.present({
    element: (
      <NavigationStack>
        <Main />
      </NavigationStack>
    )
  });

  Script.exit();
}

run();
