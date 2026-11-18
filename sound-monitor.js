// 本机麦克风连接管理；本阶段不进行声音分类
(() => {
  const startButton = document.getElementById("startMicButton");
  const stopButton = document.getElementById("stopMicButton");
  const status = document.getElementById("micStatus");

  if (!startButton || !stopButton || !status) return;

  let micStream = null;
  let requestId = 0;
  let requesting = false;

  function updateButtons() {
    startButton.disabled = requesting || micStream !== null;
    stopButton.disabled = !requesting && micStream === null;

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
        const micDeviceName = document.getElementById("micDeviceName");

    if (micDeviceName) {
      micDeviceName.textContent = "사용 중인 마이크: 연결 전";
    }

document.dispatchEvent(
  new Event("pawview:mic-stop")
);

    previousStream?.getTracks().forEach(track => track.stop());

    status.textContent = message;
    updateButtons();
  }

  async function startMicrophone() {
    if (requesting || micStream) return;

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
      if (thisRequest !== requestId || document.hidden) {
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
          "사용 중인 마이크: " +
          (acquiredStream.getAudioTracks()[0]?.label || "기본 마이크");
      }

document.dispatchEvent(
  new CustomEvent("pawview:mic-start", {
    detail: { stream: acquiredStream }
  })
);

      status.textContent =
        "● 마이크 사용 중 · 분석 상태는 아래 결과에서 확인해 주세요.";


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
    if (!micStream && !requesting) return;

    stopMicrophone(
      "백그라운드 전환으로 마이크를 껐습니다. 다시 켜 주세요."
    );
  }

  startButton.addEventListener("click", startMicrophone);

  stopButton.addEventListener("click", () => {
    stopMicrophone();
  });

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
    console.error("마이크 백그라운드 감시 등록 실패:", error);
    stopMicrophone(
      "백그라운드 감시 연결에 실패했습니다. 마이크 사용을 중단했습니다."
    );
    startButton.disabled = true;
  });
} catch (error) {
  console.error("마이크 백그라운드 감시 등록 실패:", error);
  stopMicrophone(
    "백그라운드 감시 연결에 실패했습니다. 마이크 사용을 중단했습니다."
  );
  startButton.disabled = true;
}

    } else {
      status.textContent =
        "백그라운드 감시 기능을 찾지 못해 마이크를 사용할 수 없습니다.";
      startButton.disabled = true;
    }
  }
})();
