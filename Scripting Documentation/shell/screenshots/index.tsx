import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useState } from "scripting"

function ScreenshotDemo() {
  const dismiss = Navigation.useDismiss()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const update = setTimeout(() => setReady(true), 250)
    const finish = Script.queryParameters?.final ? setTimeout(() => Script.exit("ready"), 700) : null
    return () => {
      clearTimeout(update)
      if (finish !== null) clearTimeout(finish)
    }
  }, [])

  return <NavigationStack>
    <VStack spacing={16} padding navigationTitle="Screenshot Demo">
      <Text>{ready ? "Ready to capture" : "Preparing preview"}</Text>
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try {
    await Navigation.present({ element: <ScreenshotDemo /> })
  } finally {
    Script.exit()
  }
}

void run()
