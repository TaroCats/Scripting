`Renderer.create(scene, options)` prepares a renderer. Mount it with `<RealityView renderer={renderer} />`. One renderer owns the scene at a time. Use `renderer.viewport` to obtain view dimensions and scale after mounting. `pause()` releases the mounted surface, and `resume()` restores it when visible.

Use `project` and `ray` to convert between view points and world coordinates. `pick` queries collision shapes. On supported systems, `pickSurface` queries the model surface and returns native part and primitive identifiers. The `update` event reports a scene update. Await `snapshot()` for a rendered UIImage.

Use [RealityKit View Post-Processing](scripting://doc?title=RealityKit%20View%20Post-Processing) to apply a Metal color pass to the mounted scene.

On iOS 18 or later, use an orthographic camera for views such as CAD previews. Use `await renderer.setEnvironment(image, { skybox: true, intensityExponent: 0 })` to add image-based lighting and a skybox. The source is an upright 2:1 equirectangular UIImage up to 2048 pixels wide. Set `skybox: false` to keep the solid background, or call `await renderer.setEnvironment(null)` to clear the environment.

`orbit: true` enables drag, pan and pinch camera controls. Add ordinary labeled controls for equivalent operations, for example `renderer.resetCamera()`, `renderer.zoom(1.2)` and explicit camera positions. Give selectable entities labels with `setAccessibility` and provide a list for selection when using VoiceOver. Dispose event subscriptions when the view closes.
