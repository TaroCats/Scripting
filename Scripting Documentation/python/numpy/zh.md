# NumPy

Scripting 的内嵌 Python 已包含 NumPy 2.5.2.post1。可以在 Python 脚本或 `Python.run` 中使用 `import numpy`，离线运行数组计算、广播、线性代数、随机采样和 FFT。

```python
import numpy as np

matrix = np.array([[3, 1], [1, 2]], dtype=np.float64)
values = np.array([9, 8], dtype=np.float64)
print(np.linalg.solve(matrix, values))  # [2. 3.]
```

运行 Demo 可以查看两个 `float32` 矩阵相乘及求解线性方程组的结果。其他纯 Python 库可在「Python 软件包」中安装。带有原生扩展的其他软件包需要与 Scripting 的 iOS 运行时兼容的构建。
