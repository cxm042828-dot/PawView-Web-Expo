
// 声音与最近画面结果联合展示
// 不保存事件，不上传音视频，不判断健康或危险
(() => {
  const panel = document.getElementById("soundMonitorPanel");
  const video = document.getElementById("cameraVideo");

  if (!panel || !video) return;

  // 防止同一脚本重复插入提示区域
  if (document.getElementById("soundVisionLink")) return;

  const box = document.createElement("div");
  box.id = "soundVisionLink";
  box.className = "tip-box";

  const content = document.createElement("div");

  const heading = document.createElement("strong");
  heading.textContent = "소리와 화면 함께 확인";

  const message = document.createElement("p");
  message.id = "soundVisionResult";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  const disclaimer = document.createElement("p");
  disclaimer.className = "small-disclaimer";
  disclaimer.textContent =
    "최근 화면의 감지 결과를 함께 보여 드립니다. " +
    "화면 속 강아지가 소리를 냈는지 또는 위험한 상황인지는 확인할 수 없어요.";

  content.append(heading, message, disclaimer);
  box.appendChild(content);
  panel.appendChild(box);

  const VISION_FRESH_MS = 5000;
  const SOUND_FRESH_MS = 20000;

  let visionState = "unavailable";
  let visionAt = null;
  let visionSource = null;

  let repeatedSound = false;
  let soundMessage = "";
  let soundAt = null;

  function getCameraStream() {
    const stream = video.srcObject;

    if (
      document.hidden ||
      !stream ||
      typeof stream.getVideoTracks !== "function" ||
      !stream.getVideoTracks().some(track =>
        track.readyState === "live"
      ) ||
      video.paused ||
      video.ended ||
      video.readyState < 2 ||
      video.videoWidth <= 0
    ) {
      return null;
    }

    return stream;
  }

  function setMessage(text) {
    if (message.textContent !== text) {
      message.textContent = text;
    }
  }

  function render() {
    const now = performance.now();
    const activeStream = getCameraStream();

    if (
      !repeatedSound ||
      soundAt === null ||
      now - soundAt > SOUND_FRESH_MS
    ) {
      setMessage(
        "반복되는 강아지 소리 안내가 나오면 최근 화면 결과도 함께 보여 드려요."
      );
      return;
    }

    let pictureMessage;

    if (!activeStream) {
      pictureMessage =
        "카메라 화면을 확인할 수 없어 강아지가 보이는지는 알 수 없어요.";
    } else if (
      visionSource !== activeStream ||
      visionAt === null ||
      now - visionAt > VISION_FRESH_MS ||
      visionState === "checking" ||
      visionState === "unavailable"
    ) {
      pictureMessage =
        "최근 강아지 감지 결과가 없어요. 화면 감지를 시작했는지 확인해 주세요.";
    } else if (visionState === "detected") {
      pictureMessage =
        "최근 카메라 화면에서도 강아지가 감지됐어요.";
    } else if (visionState === "not-detected") {
      pictureMessage =
        "최근 카메라 화면에서는 강아지가 감지되지 않았어요. " +
        "화면 밖에 있거나 인식하지 못했을 수 있어요.";
    } else {
      pictureMessage =
        "최근 카메라 화면의 감지 결과를 확인할 수 없어요.";
    }

    const soundText = soundMessage || "반복적인 강아지 소리가 감지됐어요.";

    setMessage(soundText + " " + pictureMessage);
  }

  document.addEventListener("pawview:dog-vision", event => {
    const state = event.detail?.state;

    if (![
      "detected",
      "not-detected",
      "checking",
      "unavailable"
    ].includes(state)) {
      return;
    }

    visionState = state;
    visionAt = performance.now();
    visionSource = getCameraStream();

    render();
  });

  document.addEventListener("pawview:dog-sound", event => {
    repeatedSound = event.detail?.repeated === true;

    soundMessage =
      typeof event.detail?.message === "string"
        ? event.detail.message
        : "";

    soundAt = performance.now();

    render();
  });

  function resetLink() {
    visionState = "unavailable";
    visionAt = null;
    visionSource = null;

    repeatedSound = false;
    soundMessage = "";
    soundAt = null;

    render();
  }

  document.addEventListener("pawview:mic-stop", () => {
    repeatedSound = false;
    soundMessage = "";
    soundAt = null;
    render();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetLink();
    }
  });

  window.addEventListener("pagehide", resetLink);

  // 即使没有新结果，也会让过期结果失效
  setInterval(render, 1000);

  render();
})();
