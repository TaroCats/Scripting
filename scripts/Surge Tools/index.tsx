import { Settings } from "./src/Settings"
import { fetchTraffic, getSurgeConfig } from "./src/api"

import { NavigationStack, NavigationLink, List, Section, Chart, LineChart, Script, useEffect, useState, Text, Navigation, LineCategoryChart } from "scripting"

function Main() {
  const [inSpeed, setInSpeed] = useState<number[]>([0])
  const [outSpeed, setOutSpeed] = useState<number[]>([0])
  const [error, setError] = useState<string>("")
  const [lastStatus, setLastStatus] = useState<Record<string, any>>({
    in: -1,
    out: -1,
  })

  const inMarks = inSpeed.map((val, index) => ({
    label: index.toString(),
    value: val / 1024, // 转换为 KB/s
    category: "上传",
    cornerRadius: 5,
  }))

  const outMarks = outSpeed.map((val, index) => ({
    label: index.toString(),
    value: val / 1024, // 转换为 KB/s
    category: "下载",
    cornerRadius: 5,
  }))


  const Interval = async () => {
    const config = getSurgeConfig()
    if (!config.address || !config.port) {
      setError("请在设置中配置 Surge 地址和端口")
      return
    }

    const data = await fetchTraffic(config)
    const interfaceData = data?.interface ?? {}

    let currentIn = 0
    let currentOut = 0

    for (const key in interfaceData) {
      currentIn += interfaceData[key].inCurrentSpeed
      currentOut += interfaceData[key].outCurrentSpeed
    }

    const inDiff = currentIn - lastStatus.in
    const outDiff = currentOut - lastStatus.out

    setInSpeed((prev: number[]) => [...prev.slice(-29), inDiff])
    setOutSpeed((prev: number[]) => [...prev.slice(-29), outDiff])

    setLastStatus({
      in: currentIn,
      out: currentOut,
    })

    setTimeout(Interval, 500)
  }

  useEffect(() => {
    Interval()
  }, [])

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

      <Section title="实时速度 (KB/s)">
        <Chart chartXAxis="hidden">
          <LineCategoryChart
            labelOnYAxis={false}
            marks={[...inMarks, ...outMarks]}
          />
        </Chart>
      </Section>
    </List>
  )
}

async function run() {
  await Navigation.present({
    element: (
      <NavigationStack>
        <Main />
      </NavigationStack>
    )
  })

  Script.exit()
}

run()
