/* PawView remote push registration (Android only).
 * Requires deployed Firebase alert sender and Firestore rules from docs.
 * Foreground registration is opt-in; this file never simulates remote delivery.
 */
import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
const key = "pawview.pushDeviceId.v1";
const deviceId = (() => {
  let id = localStorage.getItem(key);
  if (!id) { id = "device-" + (crypto.randomUUID?.() || Date.now().toString(36)); localStorage.setItem(key,id); }
  return id;
})();
const cap = window.Capacitor;
const native = cap?.getPlatform?.() === "android" ? cap.registerPlugin?.("PawViewPush") : null;
let previousUid = null;
let enabled = localStorage.getItem("pawview.pushEnabled.v1") === "true";
const panel = document.createElement("div");
panel.className = "pi-preview-status";
panel.style.marginTop = "12px";
const button = document.createElement("button");
button.type = "button";
button.textContent = "원격 알림 사용 설정";
button.className = "primary-button";
const status = document.createElement("span");
status.style.display = "block";
status.style.marginTop = "6px";
status.textContent = native ? "원격 알림 서버 연결 상태 확인 필요" : "Android 앱에서만 원격 푸시 알림을 사용할 수 있습니다.";
button.disabled = !native;
panel.append(button,status);
(document.getElementById("page-settings") || document.querySelector(".app-shell"))?.append(panel);
async function registerToken(user, askPermission = false) {
  if (!native || !user || (!enabled && !askPermission)) return false;
  try {
    if (askPermission) {
      const result = await native.enableNotifications();
      if (!result.granted) { status.textContent = "알림 권한이 허용되지 않았습니다."; return false; }
    }
    const { token } = await native.getToken();
    if (!token || auth.currentUser?.uid !== user.uid) return false;
    await setDoc(doc(db,"users",user.uid,"devices",deviceId), {
      token, platform:"android", updatedAt: new Date().toISOString()
    });
    status.textContent = "기기 등록 완료 · 서버에서 알림을 보내야 수신됩니다.";
    const launch = await native.getLaunchTarget();
    if (launch.target === "report") {
      document.querySelector('.mobile-nav-item[data-page="report"]')?.click();
    }
    return true;
  } catch (error) {
    console.error("원격 알림 등록 실패",error);
    status.textContent = "원격 알림 등록 실패 · 네트워크 및 서버 설정을 확인하세요.";
    return false;
  }
}
async function removeRegistration(uid) {
  if (!native || !uid) return;
  try { await deleteDoc(doc(db,"users",uid,"devices",deviceId)); }
  catch (error) { console.warn("원격 알림 토큰 해제 실패. 서버 규칙을 확인하세요.",error); }
}
window.PawViewPushUnregister = async () => {
  if (auth.currentUser) await removeRegistration(auth.currentUser.uid);
  enabled = false;
  localStorage.removeItem("pawview.pushEnabled.v1");
};
button.addEventListener("click", async () => {
  if (!auth.currentUser || !native) return;
  button.disabled = true;
  try {
    const success = await registerToken(auth.currentUser,true);
    if (success) {
      enabled = true;
      localStorage.setItem("pawview.pushEnabled.v1","true");
    }
  } finally {
    button.disabled = false;
  }
});
onAuthStateChanged(auth, user => {
  const oldUid = previousUid;
  previousUid = user?.uid || null;
  // Explicit logout unregisters while still authenticated. No writes after logout.
  if (oldUid && oldUid !== previousUid && auth.currentUser?.uid === oldUid) removeRegistration(oldUid);
  if (user && enabled) registerToken(user,false);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && auth.currentUser && enabled) registerToken(auth.currentUser,false);
});
