
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

if (!panel || !piPreview || !cameraScene) {
  console.warn("카메라 모드 전환 요소가 없습니다.");
  return;
}

    const originalDescription =
      description?.textContent || "";
    const originalModeLabel =
      modeLabel?.textContent || "DEMO";

    let currentMode = "phone";

    function isRecordingBusy() {
      if (window.PawViewRecording?.isBusy?.()) return true;
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
phoneBtn?.classList.toggle("is-active", !isPi);
piBtn?.classList.toggle("is-active", isPi);

phoneBtn?.setAttribute("aria-pressed", String(!isPi));
piBtn?.setAttribute("aria-pressed", String(isPi));

const returnButton =
  document.getElementById("returnPhoneCameraButton");

if (returnButton) {
  returnButton.hidden = !isPi;
}


      panel.classList.toggle("pi-mode", isPi);
      piPreview.hidden = !isPi;
      window.dispatchEvent(new CustomEvent("pawview:camera-mode", {
        detail: { mode }
      }));
      cameraScene.hidden = isPi;

      if (description) {
        description.textContent = isPi
          ? "Raspberry Pi 4 · HTTP/MJPEG 영상"
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


function selectPhone() {
  if (currentMode === "phone") return true;

  window.PawViewPiCamera?.disconnect?.(
    "스마트폰 모드로 전환했습니다."
  );

  applyMode("phone");
  return true;
}

function selectPi() {
  if (currentMode === "pi") return true;

  // 录像、权限申请及保存期间不允许切换
  if (isRecordingBusy()) {
    alert(
      "녹화 또는 저장이 진행 중입니다.\n" +
      "완료 후 카메라를 전환해 주세요."
    );
    return false;
  }

  window.PawViewPhoneCamera?.stopForSwitch();

  // 关闭手机模拟画面
  if (
    cameraScene.classList.contains("demo-playing") &&
    playBtn &&
    !playBtn.disabled
  ) {
    playBtn.click();
  }

  applyMode("pi");
  return true;
}

// 新的统一模式接口
window.PawViewCameraMode = {
  selectPhone,
  selectPi,
  getMode: () => currentMode
};

// 兼容仍保留旧按钮的页面
phoneBtn?.addEventListener("click", selectPhone);
piBtn?.addEventListener("click", selectPi);

// 首页返回手机模式
document.getElementById("returnPhoneCameraButton")
  ?.addEventListener("click", selectPhone);

// 每次启动默认手机模式
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
