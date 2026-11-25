// 本机麦克风连接管理；本阶段不进行声音分类
(() => {
  const startButton = document.getElementById("startMicButton");
  const stopButton = document.getElementById("stopMicButton");
  const status = document.getElementById("micStatus");

  if (!startButton || !stopButton || !status) return;

  let micStream = null;
  let requestId = 0;
  let requesting = false;
let activeCamera = null;
let manualStopped = false;
let lifecycleBlocked = false;

const piMicPermission =
  document.getElementById("piAllowPhoneMic");

const inputDescription =
  document.getElementById("soundInputDescription");

function privacyOn() {
  return Boolean(
    document.getElementById("guardianHomeToggle")?.checked
  );
}

function updateInputDescription() {
  if (!inputDescription) return;

  if (activeCamera === "pi") {
    inputDescription.textContent =
      piMicPermission?.checked
        ? "휴대폰 마이크 · 현재 기기 주변 소리만 분석합니다."
        : "Raspberry Pi 영상에는 소리가 없습니다. 휴대폰 마이크 사용을 허용해 주세요.";
  } else if (activeCamera === "phone") {
    inputDescription.textContent =
      "휴대폰 마이크 · 현재 기기 주변 소리를 분석합니다.";
  } else {
    inputDescription.textContent =
      "카메라 연결 후 소리 감지를 시작합니다.";
  }
}
function updateButtons() {
  const blocked =
    lifecycleBlocked ||
    privacyOn() ||
    !activeCamera ||
    (
      activeCamera === "pi" &&
      !piMicPermission?.checked
    );

  startButton.disabled =
    blocked || requesting || micStream !== null;

  stopButton.disabled =
    !requesting && micStream === null;

  startButton.textContent = requesting
    ? "마이크 연결 중..."
    : "🎤 마이크 켜기";
}


function stopMicrophone(message = "마이크 꺼짐") {
  // 让尚未完成的权限请求失效
  requestId += 1;
  requesting = false;

  const previousStream = micStream;
  micStream = null;

  const micDeviceName =
    document.getElementById("micDeviceName");

  if (micDeviceName) {
    micDeviceName.textContent =
      "사용 중인 마이크: 연결 전";
  }

  // 通知声音分析模块停止
  document.dispatchEvent(
    new Event("pawview:mic-stop")
  );

  // 释放声音检测所使用的音轨
  previousStream?.getTracks().forEach(
    track => track.stop()
  );

  status.textContent = message;

  updateButtons();
}


async function startMicrophone() {
  if (requesting || micStream) return;

  if (lifecycleBlocked || privacyOn()) {
    status.textContent =
      "프라이버시 보호 또는 기기 상태로 마이크를 사용할 수 없습니다.";
    return;
  }

  if (!activeCamera) {
    status.textContent =
      "카메라를 먼저 연결해 주세요.";
    return;
  }

  if (
    activeCamera === "pi" &&
    !piMicPermission?.checked
  ) {
    status.textContent =
      "Raspberry Pi 연결 설정에서 휴대폰 마이크 사용을 허용해 주세요.";
    return;
  }

  const requestedCamera = activeCamera;
    if (document.hidden) {
      status.textContent = "화면으로 돌아온 뒤 다시 켜 주세요.";
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent =
        "마이크를 사용할 수 없습니다. localhost 또는 HTTPS에서 열어 주세요.";
      return;
    }

    const thisRequest = ++requestId;
    requesting = true;
    status.textContent = "마이크 사용 권한을 확인하고 있습니다.";
    updateButtons();

    let acquiredStream = null;

    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia({
  audio: {
  echoCancellation: false,
  noiseSuppression: true,
  autoGainControl: false
},

  video: false
});


      // 等待授权期间关闭或切到后台，不再启用麦克风
if (
  thisRequest !== requestId ||
  document.hidden ||
  privacyOn() ||
  manualStopped ||
  requestedCamera !== activeCamera ||
  (
    requestedCamera === "pi" &&
    !piMicPermission?.checked
  )
) {
        acquiredStream.getTracks().forEach(track => track.stop());

        if (thisRequest === requestId) {
          stopMicrophone(
            "화면이 비활성 상태여서 마이크를 켜지 않았습니다."
          );
        }

        return;
      }

      const tracks = acquiredStream.getAudioTracks();

      if (!tracks.some(track => track.readyState === "live")) {
        throw new Error("No live microphone track");
      }

      micStream = acquiredStream;
      requesting = false;
            const micDeviceName = document.getElementById("micDeviceName");

      if (micDeviceName) {
       micDeviceName.textContent =
  "사용 중인 마이크: 휴대폰 마이크 (현재 기기) · " +
  (acquiredStream.getAudioTracks()[0]?.label || "기본 마이크");
      }

document.dispatchEvent(
  new CustomEvent("pawview:mic-start", {
    detail: { stream: acquiredStream }
  })
);

status.textContent =
  activeCamera === "pi"
    ? "● 휴대폰 마이크 사용 중 · Raspberry Pi 현장 소리 아님"
    : "● 휴대폰 마이크 사용 중 · 소리 분석 진행";

updateButtons();

      tracks.forEach(track => {
        track.addEventListener("ended", () => {
          if (micStream === acquiredStream) {
            stopMicrophone(
              "마이크 연결이 종료되었습니다. 다시 켜 주세요."
            );
          }
        });
      });
    } catch (error) {
      acquiredStream?.getTracks().forEach(track => track.stop());

      if (thisRequest !== requestId) return;

      console.error("마이크 연결 실패:", error);

      let message =
        "마이크 연결에 실패했습니다. 기기와 브라우저 설정을 확인해 주세요.";

      if (error.name === "NotAllowedError") {
        message =
          "마이크 권한이 허용되지 않았습니다. 사이트 권한을 확인해 주세요.";
      } else if (error.name === "NotFoundError") {
        message = "사용할 수 있는 마이크를 찾지 못했습니다.";
      } else if (error.name === "NotReadableError") {
        message =
          "마이크를 사용할 수 없습니다. 다른 앱의 사용 여부를 확인해 주세요.";
      }

      // 将麦克风异常同步到设备管理中心
document.dispatchEvent(
  new CustomEvent("pawview:mic-error", {
    detail: { message }
  })
);

stopMicrophone(message);
    }
  }

function stopForPrivacy() {
  activeCamera = null;
  manualStopped = true;

  stopMicrophone(
    "백그라운드 전환으로 마이크를 껐습니다. 카메라를 다시 연결해 주세요."
  );

  updateInputDescription();
  updateButtons();
}

// 统一摄像头声音联动接口

window.PawViewSoundMonitor = {

  cameraStarted(source) {

    if (source !== "phone" && source !== "pi") return;

    // 同一次连接不重复自动启动
    if (activeCamera === source) return;

    if (activeCamera || micStream || requesting) {
      stopMicrophone();
    }

    activeCamera = source;
    manualStopped = false;

    updateInputDescription();
    updateButtons();

    if (privacyOn() || lifecycleBlocked) return;

    // Pi 目前没有音轨，必须得到明确允许
    if (source === "pi" && !piMicPermission?.checked) {
      status.textContent =
        "영상 연결됨 · 휴대폰 마이크 사용 허용 필요";
      return;
    }

    startMicrophone();
  },

  cameraStopped(source) {

    // 不允许旧设备的断开事件关闭新设备
    if (activeCamera !== source) return;

    activeCamera = null;
    manualStopped = false;

    stopMicrophone("카메라 연결 해제 · 소리 감지 중지");

    updateInputDescription();
    updateButtons();
  },

  isRequesting() {
    return requesting;
  },

  cloneForRecording() {

    if (privacyOn() || activeCamera !== "phone") {
      return null;
    }

    const tracks = micStream?.getAudioTracks()
      .filter(track => track.readyState === "live");

    if (!tracks?.length) return null;

    // 录像拥有自己的轨道副本
    return new MediaStream(
      tracks.map(track => track.clone())
    );
  }
};

// 用户手动开启
startButton.addEventListener("click", () => {
  manualStopped = false;
  startMicrophone();
});

// 用户手动关闭
stopButton.addEventListener("click", () => {
  manualStopped = true;
  stopMicrophone("사용자가 소리 감지를 중지했습니다.");
});

// 树莓派本机麦克风授权变化
piMicPermission?.addEventListener("change", () => {

  updateInputDescription();

  if (activeCamera === "pi") {

    if (!piMicPermission.checked) {
      manualStopped = true;

      stopMicrophone(
        "휴대폰 마이크 사용 허용이 해제되었습니다."
      );

    } else if (!micStream && !requesting) {
      status.textContent =
        "휴대폰 마이크 사용 허용됨 · 마이크 켜기 버튼으로 시작하세요.";
    }
  }

  updateButtons();
});

// 隐私快门
document.getElementById("guardianHomeToggle")
  ?.addEventListener("change", () => {

    if (privacyOn()) {
      activeCamera = null;
      manualStopped = true;

      stopMicrophone("프라이버시 모드 · 마이크 사용 중지");

      updateInputDescription();
    }

    updateButtons();
  });

updateInputDescription();
updateButtons();


  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopForPrivacy();
  });

  window.addEventListener("pagehide", stopForPrivacy);

  // 后续同步 Android 时，也监听原生生命周期
  const cap = window.Capacitor;

  if (cap?.getPlatform?.() === "android") {
    const App = cap.Plugins?.App;

    if (App) {
      
try {
  const listenerResult = App.addListener(
    "appStateChange",
    state => {
      if (!state.isActive) stopForPrivacy();
    }
  );


Promise.resolve(listenerResult).catch(error => {
  lifecycleBlocked = true;

  console.error("마이크 백그라운드 감시 등록 실패:", error);

  stopMicrophone(
    "백그라운드 감시 연결에 실패했습니다. 마이크 사용을 중단했습니다."
  );

  startButton.disabled = true;
});

} catch (error) {
  lifecycleBlocked = true;

  console.error("마이크 백그라운드 감시 등록 실패:", error);

  stopMicrophone(
    "백그라운드 감시 연결에 실패했습니다. 마이크 사용을 중단했습니다."
  );

  startButton.disabled = true;
}

    } else {
      lifecycleBlocked = true;

      stopMicrophone(
        "백그라운드 감시 기능을 찾지 못해 마이크를 사용할 수 없습니다."
      );

      startButton.disabled = true;
    }
  }
})();
