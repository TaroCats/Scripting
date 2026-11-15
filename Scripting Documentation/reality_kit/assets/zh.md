`Entity.load(path, { trustExternalReferences: true })` 加载本地 USD、USDA、USDC、USDZ 或 Reality 文件。请使用可信资产，RealityKit 会解析纹理及嵌套 USD 等依赖。`flatten: true` 将 USD 加载为展开的模型，`signal` 可取消等待中的加载。

`Texture.fromImage` 和 `Texture.load` 支持纹理语义。颜色纹理使用 `color`，法线使用 `normal`，粗糙度等通道使用 `scalar`。`Material.create` 创建无光照、简单或基于物理的材质。通过 `TextureBinding` 指定 UV 通道和采样选项。

从路径加载资源时沿用脚本的文件权限。同步的 `Texture.load` 如果报告权限错误，请先授予文件访问权限再重试。

iOS 18 或更新版本中的 `Material.loadShaderGraph` 从可信本地资产加载命名材质。`parameterNames()` 和 `parameter(name)` 读取命名参数。`withParameter(name, value)` 返回应用了指定类型值的新材质，将其赋给实体即可使用。
