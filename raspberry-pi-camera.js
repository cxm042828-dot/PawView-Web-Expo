/* PawView Raspberry Pi camera: HTTP MJPEG first-frame preview only.
 * RTSP/WebRTC require a suitable native player/signaling bridge.
 * No Pi hardware or credentials are assumed to exist.
 */
(() => {
  "use strict";
  const KEY = "pawview.raspberryPiCamera.v1";
  const byId = id => document.getElementById(id);
  function init() {
    const form = byId("piCameraForm");
    const name = byId("piCameraName");
    const host = byId("piCameraHost");
    const port = byId("piCameraPort");
    const protocol = byId("piCameraProtocol");
    const path = byId("piCameraPath");
    const status = byId("piCameraStatus");
    const badge = byId("piCameraBadge");
    const preview = byId("piPreview");
    if (![form,name,host,port,protocol,path,status,badge,preview].every(Boolean)) return;

    const text = document.createElement("p");
    text.className = "pi-preview-status";
    text.setAttribute("role", "status");
    text.textContent = "연동 전 · 영상 소스가 없습니다.";
    const stream = document.createElement("img");
    stream.className = "pi-preview-stream";
    stream.alt = "Raspberry Pi MJPEG 실시간 영상";
    stream.hidden = true;
const actions = document.createElement("div");
actions.className = "pi-preview-actions";

const connect = document.createElement("button");
connect.type = "button";
connect.textContent = "연결";

const disconnect = document.createElement("button");
disconnect.type = "button";
disconnect.textContent = "연결 해제";
disconnect.disabled = true;

const test = document.createElement("button");
test.type = "button";
test.textContent = "데모 화면 테스트";

actions.append(connect, disconnect, test);

// 首页只保留状态文字和视频画面
preview.append(text, stream);

// 连接操作移动至设置页面
const settingsActions = byId("piCameraActions");

if (settingsActions) {
  settingsActions.append(actions);
} else {
  // 兼容旧版 HTML，防止操作按钮完全消失
  preview.append(actions);
}
    let currentUrl = null;
    let timer = null;
    let seq = 0;
    let state = "disconnected";
    let mode = "phone";
function setState(next, message) {
  const previousState = state;

  state = next;
  text.textContent = message;

  if (next === "playing" && previousState !== "playing") {
    window.PawViewSoundMonitor?.cameraStarted("pi");
  }

  if (previousState === "playing" && next !== "playing") {
    window.PawViewSoundMonitor?.cameraStopped("pi");
  }

  const settingsMessage = byId("piConnectionMessage");

  if (settingsMessage) {
    settingsMessage.textContent = message;
  }
      badge.textContent = next === "playing" ? "영상 표시 중"
        : next === "connecting" ? "연결 중"
        : next === "privacy" ? "프라이버시" : next === "failed" ? "연결 실패"
        : next === "demo" ? "데모 화면" : "연동 전";
      connect.disabled = next === "connecting" || next === "playing" || next === "privacy";
      disconnect.disabled = next === "disconnected" || next === "privacy";
    }
function clearConnection() {
  window.PawViewSoundMonitor?.cameraStopped("pi");

  seq++;
  clearTimeout(timer);
      timer = null;
      stream.onerror = null;
      stream.onload = null;
      stream.removeAttribute("src");
      stream.hidden = true;
      currentUrl = null;
    }
    function disconnectStream(reason = "연결이 해제되었습니다.") {
      clearConnection();
      setState(mode === "pi" && byId("guardianHomeToggle")?.checked
        ? "privacy" : "disconnected", reason);
    }
    window.PawViewPiCamera = {
      disconnect: disconnectStream,
      getStatus: () => state
    };
    function validConfig() {
      const config = {
        name: name.value.trim(), host: host.value.trim(),
        port: port.value.trim() ? Number(port.value) : null,
        protocol: protocol.value,
        path: path.value.trim() || "/stream",
        updatedAt: new Date().toISOString()
      };
      if (!config.name || !config.host ||
          !/^[a-z0-9.-]+$/i.test(config.host) ||
          (config.port !== null && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) ||
          !["unknown","rtsp","mjpeg","webrtc"].includes(config.protocol) ||
          !/^\/[a-z0-9/_?&=%.-]*$/i.test(config.path) || config.path.includes("//")) {
        throw new Error("주소, 포트 또는 경로 형식을 확인해 주세요.");
      }
      return config;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && typeof saved === "object") {
        name.value = saved.name || "Raspberry Pi 4";
        host.value = saved.host || "";
        port.value = saved.port == null ? "" : String(saved.port);
        protocol.value = ["unknown","rtsp","mjpeg","webrtc"].includes(saved.protocol) ? saved.protocol : "unknown";
        path.value = saved.path || "/stream";
        status.textContent = "설정 저장됨 · 실제 연결 여부는 확인되지 않았습니다.";
      }
    } catch (error) {
      status.textContent = "이전 설정을 읽지 못했습니다. 새로 저장해 주세요.";
    }
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        const cfg = validConfig();
        localStorage.setItem(KEY, JSON.stringify(cfg));
        status.textContent = "설정 저장 완료 · 실제 영상 연결 여부는 별도로 확인하세요.";
        if (state !== "playing" && state !== "connecting") badge.textContent = "설정 저장됨";
      } catch (error) { status.textContent = error.message || "설정 저장 실패"; }
    });
    function privacyOn() { return Boolean(byId("guardianHomeToggle")?.checked); }

connect.addEventListener("click", () => {

  if (privacyOn()) {
    setState(
      "privacy",
      "보호자 재실 모드 · 영상 표시가 차단되었습니다."
    );
    return;
  }

  let cfg;

  try {
    cfg = validConfig();
  } catch (error) {
    setState("failed", error.message);
    return;
  }

  if (cfg.protocol !== "mjpeg") {
    setState(
      "failed",
      "현재 HTTP/MJPEG만 지원합니다. RTSP/WebRTC는 추가 연동이 필요합니다."
    );
    return;
  }

  // 确认参数有效后才切换摄像头
  if (mode !== "pi") {
    const switched =
      window.PawViewCameraMode?.selectPi();

    if (!switched || mode !== "pi") return;
  }

  clearConnection();

      const scheme = location.protocol === "https:" ? "https:" : "http:";
      const url = `${scheme}//${cfg.host}${cfg.port ? ":" + cfg.port : ""}${cfg.path}`;
      // Browser HTTPS requires HTTPS camera (mixed content is blocked).
      currentUrl = url;
      const id = ++seq;
      setState("connecting", `영상 연결 중 · ${cfg.host}`);
      stream.hidden = false;
      stream.onload = () => {
        if (seq !== id || currentUrl !== url || mode !== "pi" || privacyOn()) return;
        clearTimeout(timer);
        setState("playing", "실제 HTTP/MJPEG 영상 프레임이 표시되고 있습니다.");
      };
      stream.onerror = () => {
        if (seq !== id) return;
        disconnectStream("영상 연결 실패 · 주소, TLS 인증서 및 스트림 형식을 확인하세요.");
        setState("failed", "영상 연결 실패 · 주소, TLS 인증서 및 스트림 형식을 확인하세요.");
      };
      timer = setTimeout(() => {
        if (seq !== id || state === "playing") return;
        disconnectStream("연결 시간 초과");
        setState("failed", "연결 시간 초과 · 스트림 서버 상태를 확인하세요.");
      }, 12000);
      stream.src = url;
    });
    disconnect.addEventListener("click", () => disconnectStream());
test.addEventListener("click", () => {

  if (privacyOn()) {
    clearConnection();
    setState("privacy", "보호자 재실 모드 · 영상 표시 차단");
    return;
  }

  if (mode !== "pi") {
    const switched =
      window.PawViewCameraMode?.selectPi();

    if (!switched || mode !== "pi") return;
  }

  clearConnection();
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#e8f3ec"/><text x="320" y="157" text-anchor="middle" font-size="34" fill="#276348">PawView · DEMO</text><text x="320" y="205" text-anchor="middle" font-size="20" fill="#58745f">실제 Raspberry Pi 영상이 아닙니다</text></svg>`;
      stream.src = "data:image/svg+xml," + encodeURIComponent(markup);
      stream.hidden = false;
      setState("demo", "데모 테스트 화면 · 실제 카메라 연결이 아닙니다.");
    });
    window.addEventListener("pawview:camera-mode", event => {
      mode = event.detail?.mode === "pi" ? "pi" : "phone";
      if (mode !== "pi") disconnectStream("스마트폰 모드로 전환했습니다.");
      else if (privacyOn()) { clearConnection(); setState("privacy", "보호자 재실 모드 · 영상 표시 차단"); }
      else setState("disconnected", "연결 버튼으로 Raspberry Pi 영상을 확인해 주세요.");
    });

byId("guardianHomeToggle")?.addEventListener("change", () => {
  if (mode !== "pi") {

    // 手机模式下也要解除旧的 Pi 隐私锁定状态
    if (!privacyOn() && state === "privacy") {
      setState(
        "disconnected",
        "프라이버시 모드 해제 · 연결할 수 있습니다."
      );
    }

    return;
  }

  if (privacyOn()) {
    clearConnection();

    setState(
      "privacy",
      "보호자 재실 모드 · 영상 표시 차단"
    );
  } else {
    setState(
      "disconnected",
      "프라이버시 모드 해제 · 수동으로 다시 연결하세요."
    );
  }
});

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) disconnectStream("백그라운드 전환 · 영상 연결 해제");
    });
    window.addEventListener("pagehide", () => disconnectStream("페이지 종료"));
    const cap = window.Capacitor;
    if (cap?.getPlatform?.() === "android" && cap.Plugins?.App) {
      try {
        Promise.resolve(cap.Plugins.App.addListener("appStateChange", state => {
          if (!state.isActive) disconnectStream("앱 백그라운드 · 영상 연결 해제");
        })).catch(error => console.warn("Pi 앱 상태 감시 실패:", error));
      } catch (error) { console.warn("Pi 앱 상태 감시 실패:", error); }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
