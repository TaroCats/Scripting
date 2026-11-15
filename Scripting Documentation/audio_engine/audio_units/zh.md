# Audio Unit 乐器、效果器与原生编辑器

Audio Unit 让脚本托管 Apple 效果器及已安装的 AUv3 乐器/效果器。发现结果表示组件已注册，不保证插件一定能加载或发声；可用格式、参数、预设与编辑器由插件决定。

## 查找和加载组件

调用 `AVAudioUnit.findComponents({type, subtype, manufacturer, flags, flagsMask})`，省略的字段作为通配筛选。组件标识是 FourCC 数值；选择结果后使用三个精确身份字段实例化。iOS 的发现阶段 hasCustomView 为 null，通过 requestView() 确定是否有编辑器。

`AVAudioUnit.instantiate(description, {outOfProcess:true})` 明确请求系统在 App 进程外托管。省略选项或传 false 使用系统默认策略；iOS 没有强制在进程内加载的选项。加载为异步操作，失败会拒绝 Promise；脚本先退出时，迟到结果会被释放。

专用工厂为 `AVAudioUnitEffect.createEffect`、`AVAudioUnitGenerator.createGenerator`、`AVAudioUnitTimeEffect.createTimeEffect` 和 `AVAudioUnitMIDIInstrument.create`，分别校验原生组件类型。第三方效果器通过通用参数操作；内建具体效果器额外提供各自 configure 辅助方法。attach 后检查 getBusState()，按支持格式连接再启动。MIDIProcessor 路由独立于音频连接，使用 engine.connectMIDI(source,destinations,{format})；数组替换该 source 的完整目标集合，并接管各目标原有的 MIDI 输入。反馈环会被拒绝。

## 参数与自动化

getParameterTree() 返回分组及参数元数据，无参数树时为 null。参数地址使用精确无符号十进制字符串，不能使用 JS number。读取原生范围、单位、flags、显示字符串和依赖参数地址。getParameterValues(addresses?) 读取当前值，省略地址读取全部；setParameterValues() 会先校验整批再设置。插件仍可能动态改变参数树，系统故障也可能中止操作。

getParameterString(address,value?) 与 getParameterValue(address,text) 使用插件的显示转换。scheduleParameterEvents([{address,value,sampleTime,rampDuration}]) 排期原生自动化；rampDuration 以采样帧计，参数必须支持渐变。sampleTime 属于 Audio Unit 渲染时间线，不是主机时钟或序列器节拍；AUEventSampleTimeImmediate 为 -4294967296。

observeParameters({queueSize}) 在 JS 之外收集插件发出的、未节流的原生自动化 value/touch/release 事件。普通参数赋值不一定产生自动化事件；读取当前值请使用 getParameterValues()。await next() 读取当前排队批次；无数据或观察器关闭时为 null，应带延迟轮询，避免紧循环。地址和主机时钟保持十进制字符串。有界队列在满或并发争用时可能丢弃新事件；discontinuity 标记丢弃后的后续事件，统计提供接纳/交付/排队/丢弃事件数，不是音频帧数。close() 移除原生监听，销毁节点也会关闭它。插件替换参数树后，旧观察器关闭且 next() 以 invalidated 拒绝；重新读取参数树并创建观察器。

## 预设、文档与文件

读取 getFactoryPresets()、getUserPresets()、getCurrentPreset()，用 setCurrentPreset({number,name}) 选择预设；插件更新可能异步到达。saveUserPreset() 将当前状态持久保存为负编号的用户预设，可能覆盖匹配的已有预设；deleteUserPreset(number) 永久删除插件用户预设。这些操作修改插件的原生存储，不只是脚本变量。

getStateData({forDocument}) 与 setStateData(data,{forDocument}) 交换二进制属性列表字典，保留原生 Data 和整数。文档完整状态使用 forDocument，普通状态适合预设式快照。插件不提供可保存状态时会拒绝；复制和结果大小有界，超限明确失败。loadPreset(path) 加载本地原生预设，需要文件访问；脚本目录之外的文件可通过 DocumentPicker 选择。

## 原生编辑器与生命周期

requestView() 返回 AVAudioUnitViewController，没有自定义编辑器时返回 null。从 scripting 导入 AudioUnitView，渲染 `<AudioUnitView controller={controller} frame={{minHeight:280}} />`。句柄属于当前脚本/channel，同一时间只能挂载一处；先从页面移除再 dispose。宿主保留插件子控件的无障碍语义，不隐藏或合并其交互；脚本修饰符作用于宿主。第三方编辑器的无障碍质量取决于插件，可提供原生参数控件作为替代入口。

在 finally 中销毁编辑器、停止并销毁引擎，再释放已分离的自定义节点。脚本退出或撤销音频引擎权限会移除编辑器；迟到的编辑器请求不能复活已销毁的节点。这些是主 App 能力，小组件、扩展、远程渲染和外屏渲染不能嵌入编辑器。系统媒体重置可能需要新引擎和新插件实例，应观察引擎事件并明确重建。

## 完整 index.tsx

完整示例查找效果器/乐器、加载选择、展示可用的原生编辑器，并提供参数按钮、工厂预设及内存状态快照。效果器使用低音量生成音，乐器使用音符 60，需要插件具有可用音色/预设。示例不下载插件，也不修改持久化用户预设；停止/卸载关闭观察器和编辑器并释放音频。共享会话会影响其它设备音频脚本，请单独运行。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
