import { Navigation, Script } from "scripting"
import App from "./ui"

async function run() {
  await Navigation.present(<App />)
  Script.exit()
}

run()
