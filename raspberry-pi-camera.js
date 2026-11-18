
/* PawView - Raspberry Pi 4 Camera Settings
   阶段一：只保存设备配置，不进行真实视频连接
*/

(() => {
  "use strict";

  const STORAGE_KEY = "pawview.raspberryPiCamera.v1";

  function initRaspberryPiCamera() {
    const form = document.getElementById("piCameraForm");
    const nameInput = document.getElementById("piCameraName");
    const hostInput = document.getElementById("piCameraHost");
    const portInput = document.getElementById("piCameraPort");
    const protocolInput =
      document.getElementById("piCameraProtocol");
    const status = document.getElementById("piCameraStatus");
    const badge = document.getElementById("piCameraBadge");

    if (
      !form || !nameInput || !hostInput ||
      !portInput || !protocolInput ||
      !status || !badge
    ) {
      console.warn("Raspberry Pi 설정 요소가 없습니다.");
      return;
    }

    function showStatus(message, saved = false) {
      status.textContent = message;
      badge.textContent = saved ? "설정 저장됨" : "연동 전";
    }

    // 读取之前保存的配置
    try {
      const savedText = localStorage.getItem(STORAGE_KEY);

      if (savedText) {
        const saved = JSON.parse(savedText);

        if (saved && typeof saved === "object") {
          nameInput.value = saved.name || "Raspberry Pi 4";
          hostInput.value = saved.host || "";
          portInput.value =
            saved.port == null ? "" : String(saved.port);

          const allowed = [
            "unknown", "rtsp", "mjpeg", "webrtc"
          ];

          protocolInput.value =
            allowed.includes(saved.protocol)
              ? saved.protocol
              : "unknown";

          showStatus(
            "설정이 저장되어 있습니다. 실제 카메라는 아직 연결되지 않았습니다.",
            true
          );
        }
      }
    } catch (error) {
      console.warn("Raspberry Pi 설정 읽기 실패:", error);
      showStatus("설정 정보를 불러오지 못했습니다.");
    }

    // 保存配置
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const host = hostInput.value.trim();
      const portText = portInput.value.trim();
      const protocol = protocolInput.value;

      if (!name || !host) {
        showStatus("기기 이름과 주소를 입력해 주세요.");
        return;
      }

      // 这里只保存主机地址，不接受完整 URL
      if (
        /[\s/?#@]/.test(host) ||
        host.includes("://") ||
        host.includes(":")
      ) {
        showStatus(
          "IP 주소 또는 호스트명만 입력해 주세요. URL 전체를 입력하지 마세요."
        );
        return;
      }

      if (portText) {
        const port = Number(portText);

        if (
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535
        ) {
          showStatus("포트는 1~65535 사이여야 합니다.");
          return;
        }
      }

      const config = {
        name,
        host,
        port: portText ? Number(portText) : null,
        protocol,
        updatedAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(config)
        );

        showStatus(
          "설정 저장 완료 · 실제 영상 연결은 아직 지원되지 않습니다.",
          true
        );

        console.log(
          "Raspberry Pi 카메라 설정 저장 완료"
        );
      } catch (error) {
        console.error("Raspberry Pi 설정 저장 실패:", error);
        showStatus("설정 저장에 실패했습니다.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initRaspberryPiCamera,
      { once: true }
    );
  } else {
    initRaspberryPiCamera();
  }
})();

