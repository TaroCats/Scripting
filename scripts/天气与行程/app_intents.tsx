/*
 * @Author: taro etsy@live.com
 * @LastEditors: taro etsy@live.com
 * @LastEditTime: 2026-05-22 15:48:01
 * @Description: 
 */
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
