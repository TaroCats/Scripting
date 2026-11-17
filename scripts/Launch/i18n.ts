import { Device, useEffect, useState } from 'scripting'

/**
 * A tiny in-script localization layer. The app ships Simplified Chinese and
 * English; any other system language falls back to English.
 *
 * The resolved language lives in module state so any component can read it via
 * `useI18n()` without threading a prop through every view. `setLanguage`
 * notifies subscribers, which is what makes the UI re-render on a switch.
 */

export type Language = 'en' | 'zh'
/** What the user picked in Settings; `auto` follows the system language. */
export type LanguagePreference = 'auto' | Language

export type TranslationParams = Record<string, string | number>

const LANGUAGE_STORAGE_KEY = 'launch_language'

export const MESSAGE_KEYS = [
  // Common
  'save',
  'cancel',
  'close',
  'add',
  'delete',
  'retry',
  'optional',
  'appearance',
  'language',
  'languageAuto',
  'languageEnglish',
  'languageChinese',
  // Tabs
  'tabApps',
  'tabFolders',
  'tabSettings',
  // Apps list
  'appsTitle',
  'searchApps',
  'noResults',
  'findAppInAppStore',
  'editApp',
  'addApp',
  'untitledApp',
  // Launch modes
  'launchModeUrl',
  'launchModeApp',
  'launchModeScript',
  'launchModeTitleUrl',
  'launchModeTitleApp',
  'launchModeTitleScript',
  'enterBundleId',
  'runsCustomJavaScript',
  'enterUrlScheme',
  'bundleIdPlaceholder',
  'urlSchemePlaceholder',
  'appSearchPlaceholder',
  'appNamePlaceholder',
  'nameLabel',
  // App editor
  'basicInfo',
  'basicInfoFooter',
  'launchMode',
  'bundleIdLabel',
  'urlSchemeLabel',
  'testUrlScheme',
  'couldNotOpenUrlScheme',
  'couldNotOpenUrlSchemeMessage',
  'runFailed',
  'customCode',
  'customCodeFooter',
  'openCodeEditor',
  'testRun',
  'runInWidget',
  'appearanceSection',
  'darkIconFooter',
  'iconType',
  'iconTypeSymbol',
  'iconTypeImage',
  'iconTypeTransparent',
  'sfSymbol',
  'lightIcon',
  'darkIcon',
  'imageUrlPlaceholder',
  'chooseLightIcon',
  'chooseDarkIcon',
  'iconSourceTitle',
  'chooseFromPhotos',
  'chooseFromFiles',
  'couldNotReadImage',
  'couldNotReadImageMessage',
  'themeColor',
  'extractColorFromIcon',
  'extractingColor',
  'colorFromIconFooter',
  'colorExtractFailed',
  'apply',
  'iconColorsHint',
  'foldersSection',
  'foldersFooterMainOnly',
  'foldersSelected',
  'customCodeSubtitle',
  // Folders
  'foldersTitle',
  'noFolders',
  'noFoldersDescription',
  'deleteFolder',
  'folderApps',
  'renameFolder',
  'newFolder',
  'folderName',
  'iconSfSymbolLabel',
  'folderIconFooter',
  'folderColor',
  'folderSettings',
  'customizeFolder',
  'cornerRadius',
  'resetToGlobalSettings',
  'addApps',
  'addAppsFooter',
  'addExistingApp',
  'addNewApp',
  'emptyFolder',
  // Shared
  'iconShape',
  'shapeRounded',
  'shapeCircle',
  'iconSize',
  'spacing',
  'iconRenderingMode',
  'renderFullColor',
  'renderAccented',
  'renderDesaturated',
  'renderAccentedDesaturated',
  // Search sheet
  'searchAppStore',
  'appStoreStorefront',
  'regionFooter',
  'searchingAppStore',
  'findAnApp',
  'findAnAppDescription',
  'noResultsQuery',
  'enterManually',
  'couldNotReachStore',
  'checkConnection',
  'regionUs',
  'regionCn',
  'regionJp',
  'regionGb',
  'regionKr',
  'regionDe',
  'regionFr',
  'regionCa',
  'regionAu',
  'regionIn',
  'regionHk',
  'regionTw',
  'regionSg',
  'regionBr',
  // Widget settings
  'widget',
  'widgetLayout',
  'widgetLayoutAuto',
  'widgetLayoutSingle',
  'widgetLayoutDual',
  'widgetLayoutQuad',
  'widgetLayoutFooter',
  'widgetParameterHint',
  'widgetSlots',
  'widgetSlotLabel',
  'widgetSlotsFooter',
  'widgetCoverMode',
  'widgetCoverModeFooter',
  'widgetSlotDefault',
  'widgetNoApps',
  'previewWidget',
  'previewWidgetFooter'
] as const

export type TranslationKey = (typeof MESSAGE_KEYS)[number]

type MessageTable = Record<TranslationKey, string>

const EN: MessageTable = {
  // Common
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  add: 'Add',
  delete: 'Delete',
  retry: 'Retry',
  optional: 'Optional',
  appearance: 'Appearance',
  language: 'Language',
  languageAuto: 'Follow System',
  languageEnglish: 'English',
  languageChinese: '简体中文',
  // Tabs
  tabApps: 'Apps',
  tabFolders: 'Folders',
  tabSettings: 'Settings',
  // Apps list
  appsTitle: 'Apps',
  searchApps: 'Search Apps',
  noResults: 'No Results',
  findAppInAppStore: 'Find app in the App Store',
  editApp: 'Edit App',
  addApp: 'Add App',
  untitledApp: 'Untitled App',
  // Launch modes
  launchModeUrl: 'URL',
  launchModeApp: 'App',
  launchModeScript: 'Script',
  launchModeTitleUrl: 'URL Scheme',
  launchModeTitleApp: 'App',
  launchModeTitleScript: 'Script',
  enterBundleId: 'Enter a Bundle ID',
  runsCustomJavaScript: 'Runs your custom JavaScript',
  enterUrlScheme: 'Enter a URL scheme',
  bundleIdPlaceholder: 'com.example.app',
  urlSchemePlaceholder: 'example://',
  appSearchPlaceholder: 'App name',
  appNamePlaceholder: 'App name',
  nameLabel: 'Name',
  // App editor
  basicInfo: 'Basic Info',
  basicInfoFooter: 'Choose a launch mode and enter its required destination.',
  launchMode: 'Launch Mode',
  bundleIdLabel: 'Bundle ID',
  urlSchemeLabel: 'URL Scheme',
  testUrlScheme: 'Test URL Scheme',
  couldNotOpenUrlScheme: "Couldn't Open URL Scheme",
  couldNotOpenUrlSchemeMessage:
    'No installed app can open this URL. Check the scheme and try again.',
  runFailed: 'Run failed',
  customCode: 'Custom Code',
  customCodeFooter:
    'Top-level await is supported. When Run in Widget is enabled, use notifications or side effects instead of UI such as Dialog.',
  openCodeEditor: 'Open Code Editor',
  testRun: 'Test Run',
  runInWidget: 'Run in Widget',
  appearanceSection: 'Appearance',
  darkIconFooter:
    'The dark icon is optional. If empty, the light icon is used in both appearances.',
  iconType: 'Icon Type',
  iconTypeSymbol: 'Symbol',
  iconTypeImage: 'App Icon',
  iconTypeTransparent: 'Transparent',
  sfSymbol: 'SF Symbol',
  lightIcon: 'Light',
  darkIcon: 'Dark',
  imageUrlPlaceholder: 'Image URL, photo or file',
  chooseLightIcon: 'Choose light icon',
  chooseDarkIcon: 'Choose dark icon',
  iconSourceTitle: 'Choose Icon Source',
  chooseFromPhotos: 'Choose from Photos',
  chooseFromFiles: 'Choose from Files',
  couldNotReadImage: "Couldn't Read Image",
  couldNotReadImageMessage:
    'The selected file is not a supported image. Try a PNG, JPEG or HEIC file.',
  themeColor: 'Theme Color',
  extractColorFromIcon: 'Extract from Icon',
  extractingColor: 'Extracting…',
  colorFromIconFooter:
    'Samples the icon image for its dominant colour. SF Symbol icons have no image to sample.',
  colorExtractFailed: 'Could not read the icon image.',
  apply: 'Apply',
  iconColorsHint: 'Tap a colour to select it, then tap Apply.',
  foldersSection: 'Folders',
  foldersFooterMainOnly: 'This app will only appear in the main Apps list.',
  foldersSelected: '{count} folder(s) selected.',
  customCodeSubtitle: 'Custom Code',
  // Folders
  foldersTitle: 'Folders',
  noFolders: 'No Folders',
  noFoldersDescription: 'Create a folder to preview its apps here.',
  deleteFolder: 'Delete Folder',
  folderApps: '{name}, {count} app(s)',
  renameFolder: 'Rename Folder',
  newFolder: 'New Folder',
  folderName: 'Folder Name',
  iconSfSymbolLabel: 'Icon (SF Symbol)',
  folderIconFooter: 'Leave the icon empty to use a plain folder.',
  folderColor: 'Folder Color',
  folderSettings: 'Folder Settings',
  customizeFolder: 'Customize This Folder',
  cornerRadius: 'Corner Radius',
  resetToGlobalSettings: 'Reset to Global Settings',
  addApps: 'Add Apps',
  addAppsFooter: 'Select one or more apps to add to this folder.',
  addExistingApp: 'Add Existing App',
  addNewApp: 'Add New App',
  emptyFolder: 'Empty',
  // Shared
  iconShape: 'Icon Shape',
  shapeRounded: 'Rounded Rectangle',
  shapeCircle: 'Circle',
  iconSize: 'Icon Size',
  spacing: 'Spacing',
  iconRenderingMode: 'Icon Rendering Mode',
  renderFullColor: 'Full Color',
  renderAccented: 'Accented',
  renderDesaturated: 'Desaturated',
  renderAccentedDesaturated: 'Accented & Desaturated',
  // Search sheet
  searchAppStore: 'Search App Store',
  appStoreStorefront: 'APP STORE STOREFRONT',
  regionFooter:
    "Results come from the selected country's App Store. Switch regions to find apps that aren't published in your storefront.",
  searchingAppStore: 'Searching App Store…',
  findAnApp: 'Find an app',
  findAnAppDescription:
    'Search to auto-fill the icon and name from the App Store.',
  noResultsQuery:
    'No apps matched "{query}". Try a different name, or enter your own icon URL.',
  enterManually: 'Enter manually',
  couldNotReachStore: "Couldn't reach App Store",
  checkConnection: 'Check your connection and try again.',
  regionUs: 'United States',
  regionCn: 'China',
  regionJp: 'Japan',
  regionGb: 'United Kingdom',
  regionKr: 'South Korea',
  regionDe: 'Germany',
  regionFr: 'France',
  regionCa: 'Canada',
  regionAu: 'Australia',
  regionIn: 'India',
  regionHk: 'Hong Kong',
  regionTw: 'Taiwan',
  regionSg: 'Singapore',
  regionBr: 'Brazil',
  // Widget settings
  widget: 'Widget',
  widgetLayout: 'Widget Layout',
  widgetLayoutAuto: 'Auto Grid',
  widgetLayoutSingle: 'Single App',
  widgetLayoutDual: 'Two Apps',
  widgetLayoutQuad: 'Four Grid',
  widgetLayoutFooter:
    'Fixed layouts scale the icon to the widget. Icon Size and Spacing apply to the Auto Grid; the rendering mode applies to every layout.',
  widgetParameterHint:
    'Override per widget: set the widget parameter to layout=single, layout=dual, layout=quad, folder=Name, or cover=1. Combine them with &, for example layout=quad&folder=Work&cover=1.',
  widgetSlots: 'App Slots',
  widgetSlotLabel: 'Slot {index}',
  widgetSlotsFooter:
    'Leave a slot on Default to use the next app in the list. A widget configured with a folder name uses the apps in that folder.',
  widgetSlotDefault: 'Default',
  widgetCoverMode: 'Cover Mode',
  widgetCoverModeFooter:
    'Fills every tile with the app color and enlarges its logo, so the widget reads like a cover. The slot order still applies.',
  widgetNoApps: 'No Apps',
  previewWidget: 'Preview Widget',
  previewWidgetFooter:
    'The preview uses the current layout and slots. Add the widget to the Home Screen to apply them for real.'
}

const ZH: MessageTable = {
  // Common
  save: '保存',
  cancel: '取消',
  close: '关闭',
  add: '添加',
  delete: '删除',
  retry: '重试',
  optional: '可选',
  appearance: '外观',
  language: '语言',
  languageAuto: '跟随系统',
  languageEnglish: 'English',
  languageChinese: '简体中文',
  // Tabs
  tabApps: '应用',
  tabFolders: '文件夹',
  tabSettings: '设置',
  // Apps list
  appsTitle: '应用',
  searchApps: '搜索应用',
  noResults: '无结果',
  findAppInAppStore: '在 App Store 中查找应用',
  editApp: '编辑应用',
  addApp: '添加应用',
  untitledApp: '未命名应用',
  // Launch modes
  launchModeUrl: 'URL',
  launchModeApp: '应用',
  launchModeScript: '脚本',
  launchModeTitleUrl: 'URL Scheme',
  launchModeTitleApp: '应用',
  launchModeTitleScript: '脚本',
  enterBundleId: '请输入 Bundle ID',
  runsCustomJavaScript: '运行自定义 JavaScript',
  enterUrlScheme: '请输入 URL scheme',
  bundleIdPlaceholder: 'com.example.app',
  urlSchemePlaceholder: 'example://',
  appSearchPlaceholder: '应用名称',
  appNamePlaceholder: '应用名称',
  nameLabel: '名称',
  // App editor
  basicInfo: '基本信息',
  basicInfoFooter: '请选择启动方式并填写对应的目标。',
  launchMode: '启动方式',
  bundleIdLabel: 'Bundle ID',
  urlSchemeLabel: 'URL Scheme',
  testUrlScheme: '测试 URL Scheme',
  couldNotOpenUrlScheme: '无法打开 URL Scheme',
  couldNotOpenUrlSchemeMessage:
    '没有已安装的应用可以打开该 URL，请检查 scheme 后重试。',
  runFailed: '运行失败',
  customCode: '自定义代码',
  customCodeFooter:
    '支持顶层 await。开启“在小组件中运行”后，请使用通知或副作用代替 Dialog 等界面。',
  openCodeEditor: '打开代码编辑器',
  testRun: '试运行',
  runInWidget: '在小组件中运行',
  appearanceSection: '外观',
  darkIconFooter: '深色图标可选；留空时两种外观都会使用浅色图标。',
  iconType: '图标类型',
  iconTypeSymbol: '符号',
  iconTypeImage: '应用图标',
  iconTypeTransparent: '透明图标',
  sfSymbol: 'SF Symbol',
  lightIcon: '浅色',
  darkIcon: '深色',
  imageUrlPlaceholder: '图片 URL、照片或文件',
  chooseLightIcon: '选择浅色图标',
  chooseDarkIcon: '选择深色图标',
  iconSourceTitle: '选择图片来源',
  chooseFromPhotos: '从相册选择',
  chooseFromFiles: '从文件选择',
  couldNotReadImage: '无法读取图片',
  couldNotReadImageMessage: '所选文件不是受支持的图片，请选择 PNG、JPEG 或 HEIC 文件。',
  themeColor: '主题色',
  extractColorFromIcon: '从图标提取主色',
  extractingColor: '正在提取…',
  colorFromIconFooter: '从图标图片中提取主色；SF Symbol 图标没有可采样的图片。',
  colorExtractFailed: '无法读取图标图片。',
  apply: '应用',
  iconColorsHint: '点选一种颜色，然后点击“应用”。',
  foldersSection: '文件夹',
  foldersFooterMainOnly: '此应用只会出现在应用列表中。',
  foldersSelected: '已选择 {count} 个文件夹。',
  customCodeSubtitle: '自定义代码',
  // Folders
  foldersTitle: '文件夹',
  noFolders: '暂无文件夹',
  noFoldersDescription: '创建一个文件夹即可在此预览其中的应用。',
  deleteFolder: '删除文件夹',
  folderApps: '{name}，{count} 个应用',
  renameFolder: '重命名文件夹',
  newFolder: '新建文件夹',
  folderName: '文件夹名称',
  iconSfSymbolLabel: '图标（SF Symbol）',
  folderIconFooter: '图标留空则使用普通文件夹样式。',
  folderColor: '文件夹颜色',
  folderSettings: '文件夹设置',
  customizeFolder: '自定义此文件夹',
  cornerRadius: '圆角半径',
  resetToGlobalSettings: '恢复全局设置',
  addApps: '添加应用',
  addAppsFooter: '选择一个或多个要加入该文件夹的应用。',
  addExistingApp: '添加已有应用',
  addNewApp: '添加新应用',
  emptyFolder: '空',
  // Shared
  iconShape: '图标形状',
  shapeRounded: '圆角矩形',
  shapeCircle: '圆形',
  iconSize: '图标大小',
  spacing: '间距',
  iconRenderingMode: '图标渲染模式',
  renderFullColor: '全彩',
  renderAccented: '着色',
  renderDesaturated: '去饱和',
  renderAccentedDesaturated: '着色并去饱和',
  // Search sheet
  searchAppStore: '搜索 App Store',
  appStoreStorefront: 'APP STORE 地区',
  regionFooter:
    '结果来自所选国家或地区的 App Store，切换地区可以找到未在你所在商店上架的应用。',
  searchingAppStore: '正在搜索 App Store…',
  findAnApp: '查找应用',
  findAnAppDescription: '搜索后会自动填入 App Store 中的图标和名称。',
  noResultsQuery: '没有匹配“{query}”的应用，换个名称或手动填写图标 URL。',
  enterManually: '手动填写',
  couldNotReachStore: '无法连接 App Store',
  checkConnection: '请检查网络连接后重试。',
  regionUs: '美国',
  regionCn: '中国',
  regionJp: '日本',
  regionGb: '英国',
  regionKr: '韩国',
  regionDe: '德国',
  regionFr: '法国',
  regionCa: '加拿大',
  regionAu: '澳大利亚',
  regionIn: '印度',
  regionHk: '中国香港',
  regionTw: '中国台湾',
  regionSg: '新加坡',
  regionBr: '巴西',
  // Widget settings
  widget: '小组件',
  widgetLayout: '小组件布局',
  widgetLayoutAuto: '自动网格',
  widgetLayoutSingle: '单应用',
  widgetLayoutDual: '双应用',
  widgetLayoutQuad: '四宫格',
  widgetLayoutFooter:
    '固定布局会根据小组件尺寸缩放图标；图标大小与间距用于自动网格，渲染模式对所有布局生效。',
  widgetParameterHint:
    '可在系统的小组件参数中单独指定：layout=single、layout=dual、layout=quad、folder=文件夹名 或 cover=1，用 & 组合，例如 layout=quad&folder=工作&cover=1。',
  widgetSlots: '应用槽位',
  widgetSlotLabel: '槽位 {index}',
  widgetSlotsFooter:
    '槽位留为“默认”时会自动使用列表中的下一个应用；小组件参数填写文件夹名称时，会使用该文件夹中的应用。',
  widgetSlotDefault: '默认',
  widgetCoverMode: '封面模式',
  widgetCoverModeFooter:
    '用应用主题色铺满每一块，并放大应用标志，整体呈现出封面效果。槽位顺序仍然生效。',
  widgetNoApps: '暂无应用',
  previewWidget: '预览小组件',
  previewWidgetFooter:
    '预览使用当前的布局与槽位设置。将小组件添加到主屏幕后才会正式生效。'
}

const TABLES: Record<Language, MessageTable> = { en: EN, zh: ZH }

function normalizeLanguage(tag: string): Language {
  return tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function detectSystemLanguage(): Language {
  try {
    const preferred = Device.preferredLanguages?.[0] ?? Device.systemLocale ?? ''
    if (preferred) return normalizeLanguage(preferred)
  } catch (e) {
    console.error(e)
  }
  return 'en'
}

function loadPreference(): LanguagePreference {
  try {
    const stored = Storage.get<string>(LANGUAGE_STORAGE_KEY, { shared: true })
    if (stored === 'en' || stored === 'zh' || stored === 'auto') return stored
  } catch (e) {
    console.error(e)
  }
  return 'auto'
}

let preference: LanguagePreference | null = null
const listeners = new Set<() => void>()

/** The language currently used for rendering. */
export function getLanguage(): Language {
  if (!preference) preference = loadPreference()
  return preference === 'auto' ? detectSystemLanguage() : preference
}

export function getLanguagePreference(): LanguagePreference {
  if (!preference) preference = loadPreference()
  return preference
}

/** Persists the choice in the shared domain so the widget extension sees it too. */
export function setLanguage(next: LanguagePreference) {
  preference = next
  try {
    Storage.set(LANGUAGE_STORAGE_KEY, next, { shared: true })
  } catch (e) {
    console.error(e)
  }
  listeners.forEach(listener => listener())
}

function formatMessage(template: string, params?: TranslationParams) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

/** Translates `key` for the current language. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return formatMessage(TABLES[getLanguage()][key] ?? EN[key], params)
}

/**
 * Subscribes the calling component to language changes and returns a translate
 * function bound to the current language.
 */
export function useI18n() {
  const [language, setCurrent] = useState<Language>(getLanguage)

  useEffect(() => {
    const listener = () => setCurrent(getLanguage())
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    language,
    t: (key: TranslationKey, params?: TranslationParams) =>
      formatMessage(TABLES[language][key] ?? EN[key], params)
  }
}
