
import { LocalNotifications } from "https://cdn.jsdelivr.net/npm/@capacitor/local-notifications@8.3.1/+esm";

// PawView Android 本地通知
// 仅在首次检测到重复声音时通知，10 分钟冷却
(() => {
  const COOLDOWN = 10 * 60 * 1000;
  const STORAGE_KEY = "pawview.notification.lastTime";
const CHANNEL_ID = "pawview_sound_alerts";
if (window.Capacitor?.getPlatform?.() === "android") {
  setupNotificationChannel().catch(error => console.warn("알림 채널 생성 실패:", error));
}
async function setupNotificationChannel() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: "반려동물 소리 감지",
    description: "반려동물의 반복적인 소리 감지 알림",
    importance: 4,
    visibility: 1,
    vibration: true,
    sound: "default"
  });
}
  let sending = false;

  async function sendNotification(event) {
    if (sending) return;

    if (window.Capacitor?.getPlatform?.() !== "android") {
      return;
    }

    const lastTime = Number(
      localStorage.getItem(STORAGE_KEY) || 0
    );

    if (Date.now() - lastTime < COOLDOWN) return;

    sending = true;

    try {
      let permission =
        await LocalNotifications.checkPermissions();

      if (permission.display !== "granted") {
        permission =
          await LocalNotifications.requestPermissions();
      }

      if (permission.display !== "granted") {
        console.warn("用户尚未授权通知权限");
        return;
      }
await setupNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.max(
            1,
            Math.floor(Date.now() % 2147483647)
          ),
          title: "PawView 반복 소리 감지",
          channelId: CHANNEL_ID,
          body:
            event.detail?.message ||
            "반려동물의 반복적인 소리가 감지되었습니다. 앱에서 확인해 주세요.",
          schedule: {
            at: new Date(Date.now() + 1000)
          },
          extra: {
            type: "repeated-sound"
          },
          isExactNotification: false
        }]
      });

      localStorage.setItem(
        STORAGE_KEY,
        String(Date.now())
      );

    } catch (error) {
      console.error("PawView 알림 전송 실패:", error);
    } finally {
      sending = false;
    }
  }

   // 点击通知后跳转到报告页面
  LocalNotifications.addListener(
    "localNotificationActionPerformed",
    () => {
      const reportButton = document.querySelector(
        '.mobile-nav-item[data-page="report"]'
      );

      if (reportButton) {
        reportButton.click();
      }
    }
  );

  document.addEventListener(
    "pawview:repeated-sound-detected",
    sendNotification
  );
})();