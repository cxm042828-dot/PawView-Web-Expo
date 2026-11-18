// 本机分析提示记录：不保存音视频，不判断健康或危险
(() => {
  const page = document.getElementById("page-report");
  const video = document.getElementById("cameraVideo");

  if (!page || !video) return;
  if (document.getElementById("analysisEventsPanel")) return;

  const STORAGE_KEY = "pawview.analysisEvents.v1";
  const MAX_RECORDS = 500;
  const COOLDOWN_MS = 60000;
  const VISION_FRESH_MS = 5000;
// 获取当前选中的狗狗档案 ID
function getCurrentDogId() {
  return localStorage.getItem("pawview.currentDogId.v1");
}
  let records = [];
  let readable = true;
  let visionState = "unavailable";
  let visionAt = null;
  let visionSource = null;
  let storageError = "";

  const panel = document.createElement("article");
  panel.id = "analysisEventsPanel";
  panel.className = "panel";

  const heading = document.createElement("h3");
  heading.textContent = "소리 감지 기록";

  const description = document.createElement("p");
  description.className = "small-disclaimer";
  description.textContent =
    "반복 소리 안내와 당시 최근 화면 결과를 이 기기에 저장합니다. " +
    "같은 소리 안내는 1분에 한 번만 기록하며 최근 500건을 보관합니다. " +
    "기록 수는 실제 짖은 횟수나 확인된 이상 횟수가 아닙니다.";

  const summary = document.createElement("p");
  summary.setAttribute("role", "status");

  const list = document.createElement("div");
  list.className = "care-records";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "secondary-button";
  clearButton.textContent = "현재 강아지 감지 기록 삭제";

  const privacy = document.createElement("p");
  privacy.className = "small-disclaimer";
  privacy.textContent =
    "사진·영상·녹음은 포함하지 않습니다. " +
    "데이터 백업에 이 감지 기록도 포함됩니다. " +
    "앱 또는 사이트 데이터 삭제 시 사라질 수 있습니다. " +
    "소리의 주체나 건강·위험 상태를 확인한 결과가 아닙니다.";

  panel.append(
    heading, description, summary, list, clearButton, privacy
  );
  page.querySelector(".records-panel")?.remove();
  page.appendChild(panel);

  const visionLabels = {
    detected: "최근 화면에서 강아지 감지",
    "not-detected":
      "최근 화면에서 강아지 미감지 · 화면 밖 또는 인식 누락 가능",
    unavailable: "당시 화면 판단 불가"
  };


function validRecord(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.time === "string" &&
    Number.isFinite(Date.parse(item.time)) &&
    typeof item.message === "string" &&
    item.message.length > 0 &&
    item.message.length <= 1000 &&
    Object.prototype.hasOwnProperty.call(
      visionLabels, item.vision
    ) &&
    (
      item.dogId === undefined ||
      item.dogId === null ||
      (
        typeof item.dogId === "string" &&
        item.dogId.length > 0 &&
        item.dogId.length <= 200
      )
    )
  );
}


  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw !== null) {
      const parsed = JSON.parse(raw);

      if (
        !Array.isArray(parsed) ||
        parsed.length > MAX_RECORDS ||
        !parsed.every(validRecord)
      ) {
        throw new Error("Invalid analysis records");
      }

      records = parsed;
    }
  } catch (error) {
    readable = false;
    console.error("读取分析记录失败：", error);
  }
// 只获取当前狗狗的声音检测记录
function getCurrentDogRecords() {
  const currentDogId = getCurrentDogId();

  if (!currentDogId) return [];

  return records.filter(item =>
    item.dogId === currentDogId
  );
}
  function render() {
    list.replaceChildren();
   const currentRecords = getCurrentDogRecords();

clearButton.disabled =
  !readable || currentRecords.length === 0;

    if (!readable) {
      summary.textContent =
        "감지 기록을 불러오지 못했어요. 기존 저장 내용은 변경하지 않았습니다.";
      return;
    }

    if (storageError) {
      summary.textContent = storageError;
    } else {
      const today = new Date().toDateString();

      const todayCount = currentRecords.filter(item =>
        new Date(item.time).toDateString() === today
      ).length;

      summary.textContent =
       `오늘 저장한 소리 안내 ${todayCount}건 · 보관 중 ${currentRecords.length}건`;
    }

    if (currentRecords.length === 0) {
      const empty = document.createElement("p");
      empty.textContent =
        "아직 저장된 소리 안내가 없어요. 반복 소리가 감지되면 자동으로 기록합니다.";
      list.appendChild(empty);
      return;
    }

    // 最近30条展示，最多500条保存在本机
   [...currentRecords]
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
      .slice(0, 30)
      .forEach(item => {
        const row = document.createElement("div");
        row.className = "care-record";

        const copy = document.createElement("div");
        copy.className = "care-record-copy";

        const title = document.createElement("strong");
        title.textContent = item.message;

        const time = document.createElement("time");
        time.dateTime = item.time;
        time.textContent =
          new Date(item.time).toLocaleString("ko-KR");

        const picture = document.createElement("p");
        picture.textContent = visionLabels[item.vision];

        copy.append(title, time, picture);
        row.appendChild(copy);
        list.appendChild(row);
      });

    if (currentRecords.length > 30) {
      const note = document.createElement("p");
      note.className = "small-disclaimer";
      note.textContent = "화면에는 최근 30건을 표시합니다.";
      list.appendChild(note);
    }
  }
// 其他模块更新分析记录后，重新读取本机数据并刷新报告页面
document.addEventListener(
  "pawview:analysis-events-updated",
  () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw === null ? [] : JSON.parse(raw);

      if (
        !Array.isArray(parsed) ||
        parsed.length > MAX_RECORDS ||
        !parsed.every(validRecord)
      ) {
        throw new Error("分析记录格式无效");
      }

      records = parsed;
      readable = true;
      storageError = "";
    } catch (error) {
      console.error("重新读取分析记录失败：", error);

      readable = false;
      storageError = "감지 기록을 다시 불러오지 못했어요.";
    }

    render();
  }
);
// 切换或修改狗狗档案后，刷新当前狗狗的声音检测记录
document.addEventListener(
  "pawview:dog-profile-changed",
  () => {
    invalidateVision();
    render();
  }
);
  function save(nextRecords) {
    if (!readable) return false;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextRecords)
      );

records = nextRecords;
storageError = "";

document.dispatchEvent(
  new CustomEvent("pawview:analysis-events-updated", {
    detail: {
      count: records.length
    }
  })
);

return true;
    } catch (error) {
      console.error("保存分析记录失败：", error);
      storageError =
        "이번 감지 기록을 저장하지 못했어요. 저장 공간과 설정을 확인해 주세요.";
      render();
      return false;
    }
  }

  function cameraReady() {
    const stream = video.srcObject;

    return Boolean(
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

  function snapshotVision() {
    if (
      !cameraReady() ||
      visionSource !== video.srcObject ||
      visionAt === null ||
      performance.now() - visionAt > VISION_FRESH_MS ||
      !["detected", "not-detected"].includes(visionState)
    ) {
      return "unavailable";
    }

    return visionState;
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
    visionSource = video.srcObject;
  });

  document.addEventListener("pawview:dog-sound", event => {
    if (
      document.hidden ||
      !readable ||
      event.detail?.repeated !== true
    ) {
      return;
    }

    const message = typeof event.detail.message === "string"
      ? event.detail.message.trim()
      : "";

    if (!message || message.length > 1000) return;
const dogId = getCurrentDogId();

// 没有选中狗狗时，不保存无法归属的检测记录
if (!dogId) return;
    const now = Date.now();

    // 跨刷新也依据已保存记录去重
const duplicate = records.some(item => {
  const savedAt = Date.parse(item.time);

return (
    item.dogId === dogId &&
    item.message === message &&
    Number.isFinite(savedAt) &&
    now >= savedAt &&
    now - savedAt < COOLDOWN_MS
  );
});
// 同一只狗狗一分钟内出现相同提示，不重复保存
if (duplicate) return;
const record = {
  id: globalThis.crypto?.randomUUID?.() ||
    `${now}-${Math.random().toString(36).slice(2)}`,
  time: new Date(now).toISOString(),
  message,
  vision: snapshotVision(),
  dogId
};

    const nextRecords = [...records, record]
      .slice(-MAX_RECORDS);

    if (save(nextRecords)) render();
  });

  function invalidateVision() {
    visionState = "unavailable";
    visionAt = null;
    visionSource = null;
  }
// 摄像头切换时，旧画面识别结果立即失效
video.addEventListener("emptied", invalidateVision);
video.addEventListener("pause", invalidateVision);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) invalidateVision();
  });

  window.addEventListener("pagehide", invalidateVision);

  
clearButton.addEventListener("click", () => {
  const currentDogId = getCurrentDogId();

  if (
    !readable ||
    !currentDogId ||
    getCurrentDogRecords().length === 0
  ) {
    return;
  }

  if (!window.confirm(
    "현재 선택한 강아지의 소리 감지 기록만 삭제할까요?\n다른 강아지의 기록과 돌봄 기록, 프로필은 삭제되지 않습니다."
  )) {
    return;
  }

  const nextRecords = records.filter(
    item => item.dogId !== currentDogId
  );

  if (save(nextRecords)) render();
});


  render();
})();
