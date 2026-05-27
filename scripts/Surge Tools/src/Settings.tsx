import { SurgeConfig, getSurgeConfig, setSurgeConfig } from "./api";

import { List, Form, Section, TextField, Button, useState } from "scripting";

export function Settings() {
  const [config, setConfig] = useState<SurgeConfig>(getSurgeConfig());

  const handleSave = () => {
    setSurgeConfig(config);
  };

  return (
    <List navigationTitle="Surge Settings" navigationBarTitleDisplayMode="inline">
      <Form>
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
          <Button title="Save" action={handleSave} />
        </Section>
      </Form>
    </List>
  );
}
