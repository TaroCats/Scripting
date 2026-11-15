import { Script } from "scripting"

async function run() {
  const result = await Python.run(`
import numpy as np

left = np.array([[1, 2, 3], [4, 5, 6]], dtype=np.float32)
right = np.array([[1, 0], [0, 2], [1, 1]], dtype=np.float32)
print("NumPy", np.__version__)
print("Matrix product:")
print(left @ right)
print("Linear system solution:", np.linalg.solve([[3., 1.], [1., 2.]], [9., 8.]))
`)
  if (result.exitCode === 0) console.log(result.output.trim())
  else console.error(result.output.trim())
}

run().catch(error => console.error(String(error))).finally(() => Script.exit())
