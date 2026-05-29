/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-29 10:04:44
 * @Description: 
 */
import { SurgeConfig, fetchTraffic, getSurgeConfig, setSurgeConfig } from "./api"

import { List, Form, Section, TextField, Button, useState } from "scripting"

export function Settings() {
  const [config, setConfig] = useState<SurgeConfig>(getSurgeConfig())

  const handleSave = () => {
    setSurgeConfig(config)
  }

  const handleTest = async () => {
    const config = getSurgeConfig()
    if (!config.address || !config.port) {
      return
    }
    const data = await fetchTraffic(config)
    console.log(data);
  }

  return (
    <Form>
      <List navigationTitle="Surge Settings">
        <Section title="API Configuration">
          <TextField
            title="Address"
            prompt="e.g. 127.0.0.1"
            value={config.address}
            onChanged={(e: string) => setConfig({ ...config, address: e })}
          />
          <TextField
            title="Port"
            prompt="e.g. 6166"
            value={config.port}
            onChanged={(e: string) => setConfig({ ...config, port: e })}
          />
          <TextField
            title="Key"
            prompt="Surge HTTP API Key"
            value={config.key}
            onChanged={(e: string) => setConfig({ ...config, key: e })}
          />
        </Section>
        <Section>
          <Button title="保存" action={handleSave} />
          <Button title="测试" action={handleTest} />
        </Section>
      </List>
    </Form>
  )
}
