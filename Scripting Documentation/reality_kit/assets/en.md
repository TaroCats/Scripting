`Entity.load(path, { trustExternalReferences: true })` loads a local USD, USDA, USDC, USDZ, or Reality file. Load assets you trust. RealityKit resolves dependencies such as textures and nested USD assets. Use `flatten: true` for a flattened USD model and `signal` to cancel a pending load.

`Texture.fromImage` and `Texture.load` accept a texture semantic. Choose `color` for color textures, `normal` for normals and `scalar` for channels such as roughness. `Material.create` creates unlit, simple or physically based materials. Use `TextureBinding` for UV channel and sampling options.

Loading from a path follows the script’s file permissions. If the synchronous `Texture.load` reports a permissions error, grant file access before retrying.

On iOS 18 or later, `Material.loadShaderGraph` loads a named material from a trusted local asset. Read named parameters using `parameterNames()` and `parameter(name)`. `withParameter(name, value)` returns a material with the typed value applied. Assign the returned material to the entity to use it.
