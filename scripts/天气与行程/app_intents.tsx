import { Widget, AppIntentManager, AppIntentProtocol } from "scripting"

export const CompleteReminderIntent = AppIntentManager.register({
  name: "CompleteReminderIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async ({ id }: { id: string }) => {
    const reminder = await Reminder.get(id)
    if (reminder) {
      reminder.isCompleted = true
      await reminder.save()
      await Widget.reloadAll()
    }
  }
})

export const RefreshWidgetIntent = AppIntentManager.register({
  name: "RefreshWidgetIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    await Widget.reloadAll()
  }
})

export const ToggleReminderIntent = AppIntentManager.register({
  name: "ToggleReminderIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    Storage.set("showReminder", !Storage.get("showReminder"))
    await Widget.reloadAll()
  }
})
