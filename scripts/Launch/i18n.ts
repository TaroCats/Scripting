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
  'sfSymbolChoose',
  'sfSymbolSearch',
  'sfSymbolSearchPrompt',
  'sfSymbolPickerFooter',
  'sfSymbolCurrent',
  'sfSymbolUseCurrent',
  'sfSymbolCustom',
  'sfSymbolUseTyped',
  'sfSymbolNoResults',
  'sfVariantTitle',
  'sfVariantNone',
  'sfVariantFill',
  'sfVariantCircle',
  'sfVariantCircleFill',
  'sfVariantSquare',
  'sfVariantRectangle',
  'sfVariantSlash',
  'sfGroupCommon',
  'sfGroupCommunication',
  'sfGroupObjects',
  'sfGroupArrows',
  'sfGroupPeople',
  'sfGroupTransport',
  'sfGroupNature',
  'sfGroupHealth',
  'sfGroupBusiness',
  'sfGroupSymbols',
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
  'widgetLayoutTriple',
  'widgetLayoutQuad',
  'widgetLayoutSix',
  'widgetLayoutNine',
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
  'previewWidgetFooter',
  // Folder widget layout
  'folderWidgetLayout',
  'folderWidgetLayoutFooter',
  'folderWidgetCover',
  // Folder app-icon display
  'folderDisplay',
  'folderDisplayMode',
  'folderDisplayFollowLayout',
  'folderDisplayAuto',
  'folderDisplayNine',
  'folderDisplayFooter',
  'folderMaxApps',
  // Divided widget panels
  'widgetPanels',
  'widgetPanelsFooter',
  'widgetPanelLabel',
  'widgetPanelDefault',
  'widgetPanelsEmpty',
  // Per-panel settings
  'panelFolder',
  'panelAppearance',
  'panelAuto',
  'panelReset',
  'panelSummaryDefault',
  'panelFromFolder',
  'panelFolderOverrides',
  'panelAlign',
  'alignCenter',
  'alignTop',
  'alignBottom',
  // Widget profiles
  'widgetProfiles',
  'widgetProfilesFooter',
  'widgetProfilesEmpty',
  'addWidgetProfile',
  'widgetProfileDefaultName',
  'widgetProfileNameFooter',
  'widgetProfileContent',
  'widgetProfileContentFooter',
  'widgetProfileLayoutOverridesPanels',
  'widgetProfileFollowGlobal',
  'widgetProfileAllApps',
  'widgetProfilePanelsFooter',
  'widgetProfileParameter',
  'widgetProfileParameterFooter',
  'widgetProfileCopy',
  'widgetProfileDuplicate',
  'widgetProfileRename',
  'widgetProfileCopySuffix',
  'widgetProfileCustomized',
  'widgetProfileDefaultTitle',
  'widgetDefaults',
  'widgetDefaultsFooter',
  'deleteWidgetProfile',
  'panelAxisLabel',
  'panelAxisRows',
  'panelAxisColumns',
  // iCloud
  'iCloud',
  'iCloudOn',
  'iCloudOff',
  'iCloudFooter',
  'iCloudOffFooter',
  'iCloudBackupNow',
  'iCloudBackupDone',
  'iCloudBackupFailed'
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
  sfSymbolChoose: 'Choose a symbol',
  sfSymbolSearch: 'Search',
  sfSymbolSearchPrompt: 'Symbol name, e.g. star or envelope',
  sfSymbolPickerFooter:
    'Choose a display style first, then browse or search. You can also type any symbol name to use one outside this list.',
  sfSymbolCurrent: 'Current',
  sfSymbolUseCurrent: 'Tap to use this symbol',
  sfSymbolCustom: 'Custom Name',
  sfSymbolUseTyped: 'Use the name you typed',
  sfSymbolNoResults: 'No symbols match your search.',
  sfVariantTitle: 'Style',
  sfVariantNone: 'Regular',
  sfVariantFill: 'Fill',
  sfVariantCircle: 'Circle',
  sfVariantCircleFill: 'Circle Fill',
  sfVariantSquare: 'Square',
  sfVariantRectangle: 'Rectangle',
  sfVariantSlash: 'Slash',
  sfGroupCommon: 'Common',
  sfGroupCommunication: 'Communication',
  sfGroupObjects: 'Objects & Devices',
  sfGroupArrows: 'Arrows & Indicators',
  sfGroupPeople: 'People & Hands',
  sfGroupTransport: 'Transport & Places',
  sfGroupNature: 'Nature & Weather',
  sfGroupHealth: 'Health & Fitness',
  sfGroupBusiness: 'Business & Commerce',
  sfGroupSymbols: 'Symbols & Shapes',
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
  widgetLayoutTriple: 'Three Apps',
  widgetLayoutQuad: 'Four Grid',
  widgetLayoutSix: 'Six Grid',
  widgetLayoutNine: 'Nine Grid',
  widgetLayoutFooter:
    'Fixed layouts scale the icon to the widget and never use more than three columns. Icon Size and Spacing apply to the Auto Grid; the rendering mode applies to every layout.',
  widgetParameterHint:
    'Override per widget: set the widget parameter to layout=single, layout=dual, layout=triple, layout=quad, layout=six, layout=nine, folder=Name, cover=1, folders=Work,Play, or panelAxis=columns. Combine them with &, for example folders=Work,Play&panelAxis=columns.',
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
    'The preview uses the current layout and slots. Add the widget to the Home Screen to apply them for real.',
  // Folder widget layout
  folderWidgetLayout: 'Widget Layout',
  folderWidgetLayoutFooter:
    'Used whenever this folder appears, including inside a divided widget. A panel’s own settings win; whatever a panel leaves unset follows this.',
  folderWidgetCover: 'Cover Mode',
  // Folder app-icon display
  folderDisplay: 'App Icons',
  folderDisplayMode: 'Display',
  folderDisplayFollowLayout: 'Follow Widget Layout',
  folderDisplayAuto: 'Auto Arrange',
  folderDisplayNine: 'Nine Grid',
  folderDisplayFooter:
    'How this folder tile draws its app icons. Auto Arrange shrinks the icons and the gaps so every app (up to the maximum) stays visible. Nine Grid keeps eight full icons and collects the rest into a ninth miniature cell, like the App Library. Follow Widget Layout mirrors the widget layout below.',
  folderMaxApps: 'Max Apps',
  // Divided widget panels
  widgetPanels: 'Folders',
  widgetPanelsFooter:
    'While the widget layout is Auto, a large widget divides into two panels and the extra-large families into three. Tap a panel to choose its folder and give it its own layout, icon size, spacing, shape and rendering mode. Division starts once at least one panel names a folder; panels left on Default take the next folder in the list.',
  widgetPanelLabel: 'Panel {index}',
  widgetPanelDefault: 'Default',
  widgetPanelsEmpty:
    'Create at least two folders to divide a large widget into panels.',
  // Per-panel settings
  panelFolder: 'Folder',
  panelAppearance: 'Appearance',
  panelAuto: 'Auto',
  panelReset: 'Reset This Panel',
  panelSummaryDefault: 'Default',
  panelFromFolder: 'From folder',
  panelFolderOverrides:
    'This folder also has appearance settings. Anything left on Auto here first follows the profile or widget values, then the folder; a value set here overrides both.',
  panelAlign: 'Position',
  alignCenter: 'Center',
  alignTop: 'Top',
  alignBottom: 'Bottom',
  // Widget profiles
  widgetProfiles: 'Widget Profiles',
  widgetProfilesFooter:
    'Each profile is a saved set of widget settings. Add a widget to the Home Screen, open its configuration and put profile=Name in the Parameter field: every widget can then show different content from the same app.',
  widgetProfilesEmpty: 'No profiles yet. Add one to give a widget its own content.',
  addWidgetProfile: 'Add Profile',
  widgetProfileDefaultName: 'Profile {index}',
  widgetProfileNameFooter:
    'This name is the value you type into the widget parameter. Keep it short and unique.',
  widgetProfileContent: 'Content',
  widgetProfileContentFooter:
    'Anything left on Follow Global keeps using the widget settings above.',
  widgetProfileLayoutOverridesPanels:
    'A fixed layout replaces the folder panels: the whole widget then uses that arrangement. Pick Auto, or keep the default layout on Auto, to use the panels.',
  widgetProfileFollowGlobal: 'Follow Global',
  widgetProfileAllApps: 'All Apps',
  widgetProfilePanelsFooter:
    'Pick one folder per panel to split a large widget; a panel left on Default takes the next folder. Tap a panel to give it its own layout, icon size, spacing, shape, rendering mode and cover — these settings belong to this profile only.',
  widgetProfileParameter: 'Widget Parameter',
  widgetProfileParameterFooter:
    'Open the widget\'s configuration on the Home Screen and paste this into its Parameter field. A widget can also combine it with extra keys, for example profile=Name&layout=quad.',
  widgetProfileCopy: 'Copy',
  widgetProfileDuplicate: 'Duplicate Profile',
  widgetProfileRename: 'Rename',
  widgetProfileCopySuffix: ' Copy',
  widgetProfileCustomized: 'Customized',
  widgetProfileDefaultTitle: 'Default',
  widgetDefaults: 'Default Widget Settings',
  widgetDefaultsFooter:
    'Used by a widget whose parameter does not name a profile. Saved profiles start from these values.',
  deleteWidgetProfile: 'Delete Profile',
  panelAxisLabel: 'Panel Direction',
  panelAxisRows: 'Stacked Rows',
  panelAxisColumns: 'Side by Side',
  // iCloud
  iCloud: 'iCloud',
  iCloudOn: 'On',
  iCloudOff: 'Off',
  iCloudFooter:
    'Apps, folders, widget profiles, settings and custom button code are stored in an iCloud shared data store and restored on a new device. The widget reads a local copy, so it keeps working offline.',
  iCloudOffFooter:
    'Turn on iCloud for Scripting in the system Settings to back up your data and sync it across devices.',
  iCloudBackupNow: 'Back Up Now',
  iCloudBackupDone: 'Saved to the iCloud store.',
  iCloudBackupFailed:
    'The iCloud store could not be written. Your data is saved on this device and will sync later. If this keeps happening, open Settings → iCloud Shared Data and make sure Launch is allowed to write to the store.',
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
  sfSymbolChoose: '选择符号',
  sfSymbolSearch: '搜索',
  sfSymbolSearchPrompt: '符号名称，例如 star 或 envelope',
  sfSymbolPickerFooter:
    '先选择展示方式，再浏览或搜索符号；也可以直接输入任意符号名称，选用清单之外的符号。',
  sfSymbolCurrent: '当前',
  sfSymbolUseCurrent: '点按使用此符号',
  sfSymbolCustom: '自定义名称',
  sfSymbolUseTyped: '使用输入的名称',
  sfSymbolNoResults: '没有匹配的符号。',
  sfVariantTitle: '展示方式',
  sfVariantNone: '常规',
  sfVariantFill: '填充',
  sfVariantCircle: '圆形',
  sfVariantCircleFill: '圆形填充',
  sfVariantSquare: '方形',
  sfVariantRectangle: '矩形',
  sfVariantSlash: '斜线',
  sfGroupCommon: '常用',
  sfGroupCommunication: '通信',
  sfGroupObjects: '物品与设备',
  sfGroupArrows: '箭头与指示',
  sfGroupPeople: '人物与手势',
  sfGroupTransport: '交通与地点',
  sfGroupNature: '自然与天气',
  sfGroupHealth: '健康与健身',
  sfGroupBusiness: '商业与金融',
  sfGroupSymbols: '符号与形状',
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
  widgetLayoutTriple: '三宫格',
  widgetLayoutQuad: '四宫格',
  widgetLayoutSix: '六宫格',
  widgetLayoutNine: '九宫格',
  widgetLayoutFooter:
    '固定布局会根据小组件尺寸缩放图标，列数最多三列；图标大小与间距用于自动网格，渲染模式对所有布局生效。',
  widgetParameterHint:
    '可在系统的小组件参数中单独指定：layout=single、layout=dual、layout=triple、layout=quad、layout=six、layout=nine、folder=文件夹名、cover=1、folders=工作,娱乐 或 panelAxis=columns，用 & 组合，例如 folders=工作,娱乐&panelAxis=columns。',
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
    '预览使用当前的布局与槽位设置。将小组件添加到主屏幕后才会正式生效。',
  // Folder widget layout
  folderWidgetLayout: '小组件布局',
  folderWidgetLayoutFooter:
    '该文件夹出现时使用的排列方式（含分区小组件）。区域自己的设置会覆盖这里的值，未设置的项则跟随这里。',
  folderWidgetCover: '封面模式',
  // Folder app-icon display
  folderDisplay: '应用图标',
  folderDisplayMode: '展示方式',
  folderDisplayFollowLayout: '跟随小组件布局',
  folderDisplayAuto: '自动排列',
  folderDisplayNine: '九宫格',
  folderDisplayFooter:
    '这里控制文件夹磁贴在 App 里如何绘制应用图标。自动排列会缩小图标与间距，保证全部应用（不超过最大显示数量）都显示出来；九宫格保留 8 个完整图标，把多出来的应用收进第 9 个小格子里，与 App 资源库一致。选择“跟随小组件布局”则沿用下方的小组件布局。',
  folderMaxApps: '最大显示数量',
  // Divided widget panels
  widgetPanels: '文件夹分区',
  widgetPanelsFooter:
    '小组件布局为“自动”时，大尺寸会均分为两个区域，超大尺寸均分为三个区域。点进每个区域可以选择文件夹，并单独设置布局、图标大小、间距、形状与渲染模式。只要有一个区域选定了文件夹就会开始分区；留为“默认”的区域按顺序取下一个文件夹。',
  widgetPanelLabel: '区域 {index}',
  widgetPanelDefault: '默认',
  widgetPanelsEmpty: '至少创建两个文件夹，大尺寸小组件才会分区显示。',
  // Per-panel settings
  panelFolder: '文件夹',
  panelAppearance: '外观',
  panelAuto: '自动',
  panelReset: '重置此区域',
  panelSummaryDefault: '默认',
  panelFromFolder: '跟随文件夹',
  panelFolderOverrides:
    '该文件夹也有自己的外观设置。这里留为“自动”的项会先跟随当前配置或小组件的值，再跟随文件夹；手动设置的项会覆盖它们。',
  panelAlign: '位置',
  alignCenter: '居中',
  alignTop: '顶部',
  alignBottom: '底部',
  // Widget profiles
  widgetProfiles: '小组件配置',
  widgetProfilesFooter:
    '每份配置是一组保存好的小组件设置。在主屏幕添加小组件后，打开它的配置，在“参数”中填写 profile=名称，多个小组件就能显示不同内容。',
  widgetProfilesEmpty: '还没有配置。新建一份，让某个小组件显示自己的内容。',
  addWidgetProfile: '新建配置',
  widgetProfileDefaultName: '配置 {index}',
  widgetProfileNameFooter: '该名称就是填进小组件参数里的值，请保持简短且不重复。',
  widgetProfileContent: '展示内容',
  widgetProfileContentFooter: '留为“跟随全局”的项会继续使用上面的小组件设置。',
  widgetProfileLayoutOverridesPanels:
    '选择固定布局后，整个小组件会按该排列显示，不再分区。选“自动”，或让默认布局保持“自动”，才会使用文件夹分区。',
  widgetProfileFollowGlobal: '跟随全局',
  widgetProfileAllApps: '全部应用',
  widgetProfilePanelsFooter:
    '每个区域选择一个文件夹即可分区显示；留为“默认”的区域按顺序取下一个文件夹。点进区域可以单独设置布局、图标大小、间距、形状、渲染模式与封面，这些设置只属于当前配置。',
  widgetProfileParameter: '小组件参数',
  widgetProfileParameterFooter:
    '在主屏幕打开小组件的配置，把这一行粘贴到“参数”一栏。也可以再拼接其它参数，例如 profile=名称&layout=quad。',
  widgetProfileCopy: '复制',
  widgetProfileDuplicate: '复制配置',
  widgetProfileRename: '重命名',
  widgetProfileCopySuffix: ' 副本',
  widgetProfileCustomized: '已自定义',
  widgetProfileDefaultTitle: '默认',
  widgetDefaults: '默认小组件设置',
  widgetDefaultsFooter:
    '未在参数中指定配置的小组件会使用这些设置；新建配置时也会从这些值开始。',
  deleteWidgetProfile: '删除配置',
  panelAxisLabel: '分区方向',
  panelAxisRows: '上下排列',
  panelAxisColumns: '左右排列',
  // iCloud
  iCloud: 'iCloud',
  iCloudOn: '已开启',
  iCloudOff: '未开启',
  iCloudFooter:
    '应用、文件夹、小组件配置、设置和自定义按钮代码都保存在 iCloud 共享数据储存库中，换新设备会自动恢复。小组件读取本地副本，离线也能正常显示。',
  iCloudOffFooter:
    '请在系统设置中为「Scripting」开启 iCloud，即可备份数据并在多台设备间同步。',
  iCloudBackupNow: '立即备份',
  iCloudBackupDone: '已保存到 iCloud 储存库。',
  iCloudBackupFailed:
    '暂时无法写入 iCloud 储存库。数据已保存在本机，稍后会自动重试。若一直失败，请到「设置 → iCloud 共享数据」确认已允许 Launch 写入该储存库。',
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
