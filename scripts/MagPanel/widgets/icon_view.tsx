/**
 * 图标渲染的唯一出口（App 与小组件共用）：
 *   已缓存的本地文件 → 内联 SVG → magpie 的 generic 占位。
 *
 * 坑（逐轮实测出来的）：
 *   - `SVG` 的 `resizable` 会把整个视图画成空白（尺寸算成 0），所以**不用它**；
 *     改成把宽高直接写进 SVG 根节点，按目标 pt 渲染。
 *   - 单色图标源文件是 `fill="currentColor"`，这个渲染器把它画成空白，已在构建期
 *     烤成 #8E8E93，`renderingMode="template"` + `tint` 同样不行，不碰模板渲染。
 *   - `scaleToFit` 不是 SVG 的属性，叠上去也会失败。
 */
import { Image, SVG } from "scripting"
import { GENERIC_ICON, resolveIcon } from "../core/icons"

/** 把根节点的 width/height 改写成交付尺寸（去掉 em），让 SVG 自带目标尺寸 */
export function svgWithSize(code: string, size: number): string {
  return code.replace(/<svg\b([^>]*)>/i, (_m, attrs) => {
    let a = String(attrs)
    a = /\swidth\s*=/i.test(a) ? a.replace(/\swidth\s*=\s*"[^"]*"/i, ` width="${size}"`) : ` width="${size}"${a}`
    a = /\sheight\s*=/i.test(a) ? a.replace(/\sheight\s*=\s*"[^"]*"/i, ` height="${size}"`) : ` height="${size}"${a}`
    return `<svg${a}>`
  })
}

export function ProviderIconView(props: {
  icon?: string
  /** 已缓存到本机的图标文件（来自 magpie 网页端），优先于内置图标 */
  iconPath?: string
  provider?: string
  name?: string
  size?: number
}) {
  const { icon = "", iconPath = "", provider = "", name = "", size = 11 } = props
  const box = { width: size, height: size }

  // 从 magpie 网页端下载下来的原图：SVG 走 SVG 视图，位图走 Image
  if (iconPath) {
    return iconPath.toLowerCase().endsWith(".svg") ? (
      <SVG filePath={iconPath} frame={box} />
    ) : (
      <Image filePath={iconPath} resizable frame={box} />
    )
  }

  const code = resolveIcon(icon, provider, name) ?? GENERIC_ICON
  return <SVG code={svgWithSize(code, size)} frame={box} />
}
