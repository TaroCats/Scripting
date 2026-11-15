# NumPy

Scripting includes NumPy 2.5.2.post1 for the embedded Python interpreter. Use `import numpy` in a Python script or from `Python.run`. The bundled library works offline and supports arrays, broadcasting, linear algebra, random sampling, and FFTs.

```python
import numpy as np

matrix = np.array([[3, 1], [1, 2]], dtype=np.float64)
values = np.array([9, 8], dtype=np.float64)
print(np.linalg.solve(matrix, values))  # [2. 3.]
```

Run the demo to multiply two `float32` matrices and solve a linear system. Install additional pure Python libraries from Python Packages. Other packages with native extensions need a build compatible with Scripting's iOS runtime.
