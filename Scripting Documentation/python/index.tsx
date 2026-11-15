import { Script } from "scripting"

async function run() {
  const directory = `${FileManager.temporaryDirectory}/python-refresh-${UUID.string()}`
  const helper = `${directory}/refresh_example.py`
  const entry = `${directory}/index.py`
  await FileManager.createDirectory(directory)
  try {
    await FileManager.writeAsString(entry, "import refresh_example\nprint(refresh_example.value)\n")
    for (const value of ["First version", "Edited version"]) {
      await FileManager.writeAsString(helper, `value = ${JSON.stringify(value)}\n`)
      const result = await Python.runFile(entry)
      if (result.exitCode !== 0) throw new Error(result.output)
      console.log(result.output.trim())
    }
  } finally {
    await FileManager.remove(directory)
  }
}

run().catch(error => console.error(String(error))).finally(() => Script.exit())
