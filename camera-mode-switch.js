
/* PawView - 摄像头来源切换
   手机摄像头 / Raspberry Pi 4
   树莓派真实视频接入暂未实现
*/

(() => {
  "use strict";

  function initCameraModeSwitch() {
    const panel = document.querySelector(".camera-panel");
    const phoneBtn =
      document.getElementById("cameraSourcePhone");
    const piBtn =
      document.getElementById("cameraSourcePi");
    const piPreview =
      document.getElementById("piPreview");

    const stopBtn =
      document.getElementById("stopCameraButton");
    const recordBtn =
      document.getElementById("recordCameraButton");
    const recordStatus =
      document.getElementById("recordCameraStatus");
    const playBtn =
      document.getElementById("playButton");
    const cameraScene =
      document.getElementById("cameraScene");

    const modeLabel =
      document.getElementById("cameraModeLabel");
    const description =
      panel?.querySelector(".panel-heading p");

    if (
      !panel || !phoneBtn || !piBtn ||
      !piPreview || !cameraScene
    ) {
      console.warn("카메라 모드 전환 요소가 없습니다.");
      return;
    }

    const originalDescription =
      description?.textContent || "";
    const originalModeLabel =
      modeLabel?.textContent || "DEMO";

    let currentMode = "phone";

    function isRecordingBusy() {
      const buttonText = recordBtn?.textContent || "";
      const statusText = recordStatus?.textContent || "";

      return Boolean(
        recordBtn?.classList.contains("is-recording") ||
        /녹화 종료|저장 준비|마이크 권한/.test(buttonText) ||
        /파일 준비 중|저장 중|마이크 권한 확인 중/.test(statusText)
      );
    }

    function applyMode(mode) {
      const isPi = mode === "pi";
      currentMode = mode;

      phoneBtn.classList.toggle("is-active", !isPi);
      piBtn.classList.toggle("is-active", isPi);

      phoneBtn.setAttribute(
        "aria-pressed", String(!isPi)
      );
      piBtn.setAttribute(
        "aria-pressed", String(isPi)
      );

      panel.classList.toggle("pi-mode", isPi);
      piPreview.hidden = !isPi;
      cameraScene.hidden = isPi;

      if (description) {
        description.textContent = isPi
          ? "Raspberry Pi 4 카메라 · 실제 연동 전"
          : originalDescription;
      }

      if (modeLabel) {
        modeLabel.textContent = isPi
          ? "연동 전"
          : originalModeLabel;
      }

      console.log(
        "PawView 카메라 모드:",
        isPi ? "Raspberry Pi 4" : "Smartphone"
      );
    }

    phoneBtn.addEventListener("click", () => {
      if (currentMode === "phone") return;
      applyMode("phone");
    });

    piBtn.addEventListener("click", () => {
      if (currentMode === "pi") return;

      // 录像、麦克风授权和文件保存期间禁止切换
      if (isRecordingBusy()) {
        alert(
          "녹화 또는 저장이 진행 중입니다.\n" +
          "완료 후 카메라를 전환해 주세요."
        );
        return;
      }

      // 关闭正在运行的手机摄像头
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }

      // 关闭已有的模拟动画
      if (
        cameraScene.classList.contains("demo-playing") &&
        playBtn && !playBtn.disabled
      ) {
        playBtn.click();
      }

      applyMode("pi");
    });

    applyMode("phone");
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initCameraModeSwitch,
      { once: true }
    );
  } else {
    initCameraModeSwitch();
  }
})();
