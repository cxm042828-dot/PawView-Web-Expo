// 本机狗狗检测：不保存、不上传摄像头画面
(() => {
  const get = id => document.getElementById(id);

  const video = get("cameraVideo");
  const modelStatus = get("dogVisionModelStatus");
  const result = get("dogVisionResult");
  const loadButton = get("loadDogVisionButton");
  const startButton = get("startDogVisionButton");
  const stopButton = get("stopDogVisionButton");

  if (
    !video || !modelStatus || !result ||
    !loadButton || !startButton || !stopButton
  ) {
    console.error("狗狗识别区域缺少元素。");
    return;
  }

  let model = null;
  let loading = false;
  let running = false;
  let busy = false;
  let timer = null;
  let generation = 0;
  // 只保留最近一次画面判断，不保存图片
 // 发布 AI 识别状态，并记录有意义的识别结果
function publishVision(state) {
    const currentDogId = localStorage.getItem(
    "pawview.currentDogId.v1"
  );
  document.dispatchEvent(
    new CustomEvent("pawview:dog-vision", {
      detail: { state }
    })
  );

// checking / unavailable 不作为 AI 识别历史
if (state !== "detected" && state !== "not-detected") {
  return;
}

// 没有当前狗狗 ID 时，不保存无法归属的历史记录
if (!currentDogId) {
  return;
}

const STORAGE_KEY = "pawview.aiHistory.v1";

  try {
    const records = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(records)) return;

    const now = Date.now();

    // 同一种结果 60 秒内只记录一次，避免每秒产生一条记录
    const last = records[records.length - 1];

const lastForDog = records
  .slice()
  .reverse()
  .find(record => record.dogId === currentDogId);

if (
  lastForDog &&
  lastForDog.state === state &&
  now - new Date(lastForDog.createdAt).getTime() < 60000
) {
  return;
}

records.push({
  id: `ai-${now}`,
  type: "ai",
  dogId: currentDogId,
  pet: "dog",
  state,
      message: state === "detected"
        ? "화면에서 강아지가 감지됐어요."
        : "화면에서 강아지가 감지되지 않았어요.",
      createdAt: new Date(now).toISOString(),
      favorite: false
    });

    // 最多保留 500 条
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records.slice(-500))
    );

    document.dispatchEvent(
      new CustomEvent("pawview:ai-history-updated")
    );
  } catch (error) {
    console.warn("AI 인식 기록 저장 실패:", error);
  }
}
  // 初始测试值，不代表识别准确率
  const DOG_THRESHOLD = 0.50;
  const CHECK_INTERVAL_MS = 1000;

  function updateButtons() {
    loadButton.disabled = loading || model !== null;

    loadButton.textContent = loading
      ? "모델 불러오는 중..."
      : model
        ? "✓ 모델 준비 완료"
        : "강아지 인식 모델 불러오기";

    startButton.disabled = !model || running || busy;
    stopButton.disabled = !running;
  }

  function cameraReady() {
    const stream = video.srcObject;

    return (
      !document.hidden &&
      stream &&
      typeof stream.getVideoTracks === "function" &&
      stream.getVideoTracks().some(track =>
        track.readyState === "live"
      ) &&
      !video.paused &&
      !video.ended &&
      video.readyState >= 2 &&
      video.videoWidth > 0
    );
  }

  function stopDetection(message = "강아지 감지를 중지했어요.") {
        publishVision("unavailable");
        window.PawDogMotion?.reset(
      "활동 상태: 감지가 중지됐어요."
    );
    generation += 1;
    running = false;

    clearTimeout(timer);
    timer = null;

    result.textContent = message;
    updateButtons();
  }

  async function loadModel() {
    if (loading || model) return;

    if (!window.tf || !window.cocoSsd) {
      modelStatus.textContent =
        "모델 실행 파일을 불러오지 못했어요. 인터넷 연결 후 새로고침해 주세요.";
      return;
    }

    loading = true;
    modelStatus.textContent =
      "강아지 인식 모델을 불러오고 있어요.";
    updateButtons();

    try {
      await window.tf.ready();

      model = await window.cocoSsd.load({
        base: "lite_mobilenet_v2"
      });

      modelStatus.textContent =
        "강아지 인식 모델 준비 완료";

            result.textContent =
        "카메라를 연결하면 강아지가 보이는지 자동으로 확인해요.";

      if (cameraReady()) {
        startDetection();
      }

    } catch (error) {
      console.error("狗狗识别模型加载失败：", error);

      modelStatus.textContent =
        "모델을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
              result.textContent =
        "강아지 화면 분석을 준비하지 못했어요. 인터넷 연결을 확인한 뒤 카메라를 다시 연결해 주세요.";
    } finally {
      loading = false;
      updateButtons();
    }
  }

  async function detectFrame(token) {
    if (!running || token !== generation) return;

    if (!cameraReady()) {
      stopDetection(
        "카메라 화면을 확인할 수 없어 감지를 중지했어요. 카메라를 연결한 뒤 다시 시작해 주세요."
      );
      return;
    }

    busy = true;
    updateButtons();

    // 分析期间如果摄像头流改变，丢弃旧结果
    const source = video.srcObject;

    try {
      const predictions = await model.detect(
        video,
        20,
        DOG_THRESHOLD
      );

      if (!running || token !== generation) return;

      if (video.srcObject !== source || !cameraReady()) {
        stopDetection(
          "카메라 화면이 변경되거나 중단되어 감지를 중지했어요."
        );
        return;
      }

      window.PawDogMotion?.update(video, predictions);

      const dogFound = predictions.some(item =>
        item.class === "dog" &&
        item.score >= DOG_THRESHOLD
      );
      publishVision(dogFound ? "detected" : "not-detected");

      result.textContent = dogFound
        ? "화면에서 강아지가 감지됐어요."
        : "지금 화면에서는 강아지가 감지되지 않았어요. 화면 밖에 있거나 인식하지 못했을 수 있어요.";
    } catch (error) {
      if (token !== generation) return;

      console.error("狗狗画面分析失败：", error);

      stopDetection(
        "화면을 분석하지 못했어요. 카메라 상태를 확인하고 다시 시작해 주세요."
      );
    } finally {
      busy = false;
      updateButtons();

      // 每次完成后再安排下一次，避免分析任务堆积
      if (running && token === generation) {
        timer = setTimeout(
          () => detectFrame(token),
          CHECK_INTERVAL_MS
        );
      }
    }
  }

  function startDetection() {
    if (!model || running || busy) return;

    if (!cameraReady()) {
      result.textContent =
        "먼저 이 기기의 카메라를 연결하고 화면이 나오는지 확인해 주세요.";
      return;
    }

    clearTimeout(timer);
    timer = null;

    running = true;
    const token = ++generation;

    result.textContent = "화면에서 강아지를 찾고 있어요.";
        publishVision("checking");

    updateButtons();

    void detectFrame(token);
  }

  loadButton.addEventListener("click", loadModel);
  startButton.addEventListener("click", startDetection);

  stopButton.addEventListener("click", () => {
    stopDetection();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      stopDetection(
        "백그라운드 전환으로 감지를 중지했어요. 돌아온 뒤 직접 다시 시작해 주세요."
      );
    }
  });

  // 供现有摄像头停止函数调用
  window.PawDogDetector = {
    stop() {
      if (!running && !busy) return;

      stopDetection(
        "카메라 연결이 종료되어 강아지 감지도 중지했어요."
      );
    }
  };

    // 摄像头真正开始播放后，自动准备并启动检测
  async function startWhenCameraReady() {
    if (!cameraReady()) return;

    if (!model) {
      result.textContent =
        "화면 분석을 준비하고 있어요. 잠시 기다려 주세요.";

      await loadModel();
    }

    // 等待期间可能已经断开摄像头或进入后台
    if (model && cameraReady()) {
      startDetection();
    }
  }

  video.addEventListener("playing", () => {
    void startWhenCameraReady();
  });

  // 网络恢复后，重试未准备成功的画面模型
  window.addEventListener("online", () => {
    if (!model && !document.hidden) {
      void loadModel();
    }
  });

  updateButtons();

  result.textContent =
    "카메라 연결 전";

  // 页面打开后自动准备模型，不自动打开摄像头
  void loadModel();

  // 兼容脚本执行时摄像头已经开始播放的情况
  if (cameraReady()) {
    void startWhenCameraReady();
  }
})();
