全局 `Vision` API 可以识别图片中的文字、扫描文档，并分析静态图片和相机帧中的人脸、人体姿态和手部姿态。

使用 [实况文本](scripting://doc?title=Live%20Text)读取静态图片中的整图文字，或让用户直接在图片中选中文字。

使用 [Vision Core ML 请求](scripting://doc?title=Vision%20Core%20ML%20Requests)进行图像分类、目标检测和读取模型特征。

使用 [Vision 跟踪](scripting://doc?title=Vision%20Tracking)在连续帧中跟踪物体边界框和矩形角点。

使用 [Vision 图像配准](scripting://doc?title=Vision%20Image%20Registration)按平移或透视变换对齐连续图像。

使用 [Vision 轨迹检测](scripting://doc?title=Vision%20Trajectory%20Detection)测量物体的抛物线运动。

使用 [Vision 光流](scripting://doc?title=Vision%20Optical%20Flow)读取连续帧之间的像素运动。

---

## 类型

### `RecognizedText`
表示单个识别到的文本块。

- `content: string`  
  识别到的文本内容。

- `confidence: number`  
  置信度（0.0 到 1.0 之间），1.0 表示最高置信度。

- `boundingBox: { x: number, y: number, width: number, height: number }`  
  文本所在的矩形区域，使用归一化坐标表示。

---

### `RecognizeTextOptions`
文本识别的配置选项。

- `recognitionLevel?: "accurate" | "fast"`  
  识别模式：
  - `"accurate"`（默认）：优先保证准确度。
  - `"fast"`：优先保证速度。

- `recognitionLanguages?: string[]`  
  识别时优先使用的语言数组（ISO 语言编码）。

- `usesLanguageCorrection?: boolean`  
  是否在识别过程中应用语言自动纠错。

- `minimumTextHeight?: number`  
  最小识别文本高度，相对于图片高度（默认 `0.03125`）。

- `customWords?: string[]`  
  补充词汇表（只在启用语言纠错时生效）。

---

## 函数

### `recognizeText(image: UIImage, options?: RecognizeTextOptions): Promise<{ text: string, candidates: RecognizedText[] }>`
对指定图片进行文本识别。

- **参数**：
  - `image`：要识别的 `UIImage` 对象。
  - `options` *(可选)*：文本识别配置。

- **返回**：  
  返回 Promise，包含：
  - `text`：识别出的完整文本。
  - `candidates`：识别出的文本块数组及详细信息。

---

### `scanDocument(options?: RecognizeTextOptions): Promise<string[]>`
使用相机扫描文档并识别文本。

- **参数**：
  - `options` *(可选)*：文本识别配置。

- **返回**：  
  返回 Promise，包含识别到的文档文本数组。  
  如果用户取消，Promise 将抛出错误。

---

## 使用示例

### 识别图片文件中的文本
```tsx
const image = UIImage.fromFile('/路径/图片.png')
if (image) {
  const result = await Vision.recognizeText(image, {
    recognitionLevel: 'accurate',
    recognitionLanguages: ['zh-Hans', 'en'],
    usesLanguageCorrection: true
  })
  console.log('识别到的完整文本：', result.text)

  for (const block of result.candidates) {
    console.log(`文本：${block.content}，置信度：${block.confidence}`)
  }
}
```

---

### 使用相机扫描文档
```tsx
try {
  const documents = await Vision.scanDocument({
    recognitionLevel: 'fast',
    recognitionLanguages: ['zh-Hans']
  })
  console.log('扫描到的文档内容：', documents)
} catch (error) {
  console.error('扫描取消或失败：', error)
}
```

## 静态人脸与姿态

全局 Vision API 还可分析 UIImage 中的人脸、人体与手部姿态。从主脚本执行器调用，原生分析在后台运行。静态检测不会打开相机，也不需要摄像头权限。输入可来自已拍照片或已加载图像，本次不包含实时相机帧分析。

```ts
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const pixels = image.toPixels()
  const faces = await Vision.detectFaceLandmarks(image)
  for (const face of faces) {
    const eye = face.landmarks?.regions.leftEye
    if (eye) {
      const points = eye.points.map(p => Vision.imagePointToPixels(
        Vision.facePointToImage(p, face.boundingBox),
        { width: pixels.width, height: pixels.height }
      ))
      console.log(points)
    }
  }
}
```

- detectFaces(image, options?) 返回人脸框及可用的 roll/yaw/pitch 弧度；不可用角度为 null。
- detectFaceLandmarks(image, options?) 增加语义区域、allPoints、置信度、点布局、点分类和可用的精度估计。默认 points76，也可请求 points65；原生76点不同于常用68点布局，精度估计也不是每点检测置信度。
- detectBodyPose(image, options?) 返回可用命名关节的 x/y/confidence。
- detectHandPose(image, options?) 返回带置信度的命名关节和 left/right/unknown 手性。maximumHandCount 默认2，可设1...16。

通用选项为 regionOfInterest、revision、signal。人脸关键点还支持 constellation，以及二选一的 inputFaces（同一 UIImage 的既有检测结果）或 inputFaceBoundingBoxes（手工提供的归一化人脸框）。观测查找缓存有界；需要复用时及时创建请求。复用请求保留源图像身份，对其他图像执行会拒绝。缺失区域/关节保持缺失，无目标返回空数组。观测 id 不代表人员身份，也不保证跨调用持续跟踪。

人脸框、ROI、人体/手部关节均使用完整显示方向图像的左下归一化坐标；人脸区域点使用人脸框内左下归一化坐标。输入会尊重 UIImage 方向。facePointToImage、imagePointToPixels、imagePointToView 分别帮助完成框内映射、左上像素转换，以及居中 aspectFit/aspectFill 布局转换。视图转换传入 imageSize、viewSize，可选 contentMode、mirrored；aspectFill 的点可能位于视图外。二维点和角度不提供完整标定三维位姿或深度。

多请求可共享同一次图像处理：

```ts
const requests = [Vision.Request.faces(), Vision.Request.bodyPose()]
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const results = await Vision.perform(image, requests)
  for (const result of results) console.log(result.kind, result.revision, result.observations)
}
```

请求描述符不可变且可复用，每次执行创建独立原生请求。构造请求不接收 signal，取消信号传给 perform。任何请求失败都会拒绝整批结果。每脚本最多两项在途任务，每项最多八个请求，输入图像最多16M像素。`Vision.getCapabilities()` 返回桥接层最低 iOS 版本、支持的 revisions/constellations/关节名及限制。不支持的 revision 明确拒绝，不悄悄降级。取消以 code=cancelled 拒绝；原生结束前仍保留其资源额度。脚本退出取消任务并丢弃回调。

```ts
const controller = new AbortController()
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const task = Vision.detectFaces(image, { signal: controller.signal })
  controller.abort()
  try { await task } catch (error) { console.log(error) }
}
```

新增静态 API 错误 code 包括 invalidArgument、unsupported、resourceLimit、cancelled、disposed、nativeFailure；原生错误还带 nativeDomain/nativeCode。原有 OCR、文档扫描返回契约保持。直接构图参见 [UIImage](scripting://doc?title=UIImage)。

## 三维人体姿态

使用下列 API 从静态全身照片估计人体骨架。 [Vision 三维人体姿态](scripting://doc?title=Vision%20%E4%B8%89%E7%BB%B4%E4%BA%BA%E4%BD%93%E5%A7%BF%E6%80%81)

## 相机帧

使用 [Vision 相机帧](scripting://doc?title=Vision%20Camera%20Frames) 将相机帧传给同一套检测与批处理 API。
