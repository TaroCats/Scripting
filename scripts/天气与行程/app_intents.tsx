import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"

// 将一个提醒标记为已完成（点按小组件里的提醒圆圈）
export const CompleteReminderIntent = AppIntentManager.register({
  name: "CompleteReminderIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (params: { id: string }) => {
    try {
      const reminder = await Reminder.get(params.id)
      if (reminder && !reminder.isCompleted) {
        reminder.isCompleted = true
        await reminder.save()
      }
    } catch (_error) {
      console.log("完成提醒失败:", _error)
    }
    Widget.reloadAll()
  },
})

// 刷新小组件数据
export const RefreshWidgetIntent = AppIntentManager.register({
  name: "RefreshWidgetIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    Widget.reloadAll()
  },
})

// 切换是否在小组件行程中显示提醒（默认显示）
export const ToggleReminderIntent = AppIntentManager.register({
  name: "ToggleReminderIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    const current = Storage.get<boolean>("showReminder") ?? true
    Storage.set("showReminder", !current)
    Widget.reloadAll()
  },
})
