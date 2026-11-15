# 脚本截图

如果脚本会一直显示界面，可以延迟截图。脚本界面就绪后开始计时，截图成功后自动结束运行。

```sh
scripting-ts project "Screenshot Demo" --capture-after 0.5 --timeout 10
```

如果脚本会在工作完成后调用 `Script.exit()`，可以在退出时截图。如果脚本先关闭界面，结果可以使用该界面的最后可见画面。

```sh
scripting-ts project "Screenshot Demo" --screenshot-final --queryparameters '{"final":true}' --timeout 10
scripting-cli run "Screenshot Demo" --screenshot-final --query-parameters '{"final":true}'
```

`--capture-after` 的单位为秒，范围是 0 到 10。每条命令选择一种截图时机。达到 `--timeout` 时仍会报告超时。最终截图需要本次运行显示过脚本界面。

运行 Demo 可以看到状态从准备中变为就绪。要复现上述命令，将 Demo 保存为名为 `Screenshot Demo` 的脚本。传入 `final` 参数后，Demo 会在就绪后主动退出。
