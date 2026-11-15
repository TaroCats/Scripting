# Script screenshots

Use a delayed capture for a script that keeps a view open. The delay starts when the script view is ready, and the run exits after saving the screenshot.

```sh
scripting-ts project "Screenshot Demo" --capture-after 0.5 --timeout 10
```

Use final capture for a script that calls `Script.exit()` after its work. If it closes a view before exiting, the result can use that view's last visible frame.

```sh
scripting-ts project "Screenshot Demo" --screenshot-final --queryparameters '{"final":true}' --timeout 10
scripting-cli run "Screenshot Demo" --screenshot-final --query-parameters '{"final":true}'
```

`--capture-after` takes seconds from 0 to 10. Choose one capture timing per command. A run that reaches `--timeout` still reports a timeout. A successful final capture needs a view presented by that run.

Run the demo to see the status change from preparing to ready. To reproduce the commands, save the demo as a script named `Screenshot Demo`. The `final` parameter makes the demo exit after it reaches the ready state.
