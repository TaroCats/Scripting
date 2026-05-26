/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-26 17:45:01
 * @Description: 
 */
import { Widget, AppIntentManager, AppIntentProtocol } from "scripting"

export const CompleteReminderIntent = AppIntentManager.register({
  name: "CompleteReminderIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async ({ id }: { id: string }) => {
    const reminder = await Reminder.get(id)
    if (reminder) {
      console.log(reminder.isCompleted)
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