
// PawView 本机狗狗活动线索统计
// 不保存、不上传摄像头画面。
// 仅统计摄像头检测期间的画面变化线索，不代表真实运动量或睡眠时间。

(() => {
  const $ = id => document.getElementById(id);

  const status = $("dogMotionStatus");
  const time = $("dogStillTime");
  const activityStat = $("activityStat");
  const restStat = $("restStat");
  const petSelect = $("petSelect");

  if (!status || !time) {
    console.error("狗狗活动分析区域缺少元素。");
    return;
  }

const STORAGE_PREFIX = "pawview.dogMotionDaily.v3.";
const SUPPORTED_PET = "dog";

function getCurrentDogId() {
  return localStorage.getItem("pawview.currentDogId.v1")
    || "dog-default";
}

  const PIXEL_DIFFERENCE = 20;
  const CHANGE_RATIO = 0.08;
  const STILL_NOTICE_MS = 120000;
  const MAX_SAMPLE_GAP_MS = 5000;
  const HISTORY_DAYS = 30;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 120;

  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

let activePet = petSelect?.value || "dog";
let activeDogId = getCurrentDogId();

let dailyRecords = activePet === SUPPORTED_PET
  ? loadRecords(activeDogId)
  : [];

  let previousFrame = null;
  let previousBox = null;
  let previousAt = null;
  let previousState = null;

  let stillStartedAt = null;
  let stillSamples = 0;

  function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function createRecord(date = getDateKey()) {
    return {
      date,
      movingMs: 0,
      stillMs: 0,
      sampleCount: 0
    };
  }

  function isValidRecord(record) {
    return (
      record &&
      typeof record.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
      Number.isFinite(record.movingMs) &&
      record.movingMs >= 0 &&
      Number.isFinite(record.stillMs) &&
      record.stillMs >= 0 &&
      Number.isInteger(record.sampleCount) &&
      record.sampleCount >= 0
    );
  }

function loadRecords(dogId) {
  if (!dogId) return [];

  try {
    const raw = localStorage.getItem(
      STORAGE_PREFIX + dogId
    );

    if (!raw) return [];

    const saved = JSON.parse(raw);

    if (
      !saved ||
      saved.version !== 3 ||
      saved.dogId !== dogId ||
      !Array.isArray(saved.days) ||
      !saved.days.every(isValidRecord)
    ) {
      throw new Error("活动统计数据格式不正确");
    }

    return saved.days
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-HISTORY_DAYS);

  } catch (error) {
    console.error("活动统计读取失败：", error);
    return [];
  }
}
function saveRecords() {
  if (activePet !== SUPPORTED_PET || !activeDogId) {
    return;
  }

  try {
    dailyRecords = dailyRecords
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-HISTORY_DAYS);

    localStorage.setItem(
      STORAGE_PREFIX + activeDogId,
      JSON.stringify({
        version: 3,
        dogId: activeDogId,
        days: dailyRecords
      })
    );

  } catch (error) {
    console.error("活动统计保存失败：", error);
  }
}

  function getTodayRecord() {
    const today = getDateKey();

    let record = dailyRecords.find(
      item => item.date === today
    );

    if (!record) {
      record = createRecord(today);
      dailyRecords.push(record);
    }

    return record;
  }

  function formatDuration(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }

    return `${minutes}분`;
  }

  function getToday(petId = activePet) {
    if (petId !== SUPPORTED_PET) {
      return {
        date: getDateKey(),
        movingMs: 0,
        stillMs: 0,
        sampleCount: 0,
        hasData: false
      };
    }

const dogId = getCurrentDogId();

const records =
  petId === activePet && dogId === activeDogId
    ? dailyRecords
    : loadRecords(dogId);

    const record = records.find(
      item => item.date === getDateKey()
    );

    if (!record || record.sampleCount === 0) {
      return {
        date: getDateKey(),
        movingMs: 0,
        stillMs: 0,
        sampleCount: 0,
        hasData: false
      };
    }

    return {
      ...record,
      hasData: true
    };
  }

  function getHistory(petId = activePet, count = 7) {
    const safeCount = Math.max(
      1,
      Math.min(30, Math.floor(Number(count) || 7))
    );

    if (petId !== SUPPORTED_PET) return [];

const dogId = getCurrentDogId();

const records =
  petId === activePet && dogId === activeDogId
    ? dailyRecords
    : loadRecords(dogId);

    const result = [];
    const today = new Date();

    for (let offset = safeCount - 1; offset >= 0; offset--) {
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - offset
      );

      const dateKey = getDateKey(date);

      const found = records.find(
        item => item.date === dateKey
      );

      result.push(
        found && found.sampleCount > 0
          ? { ...found, hasData: true }
          : {
              date: dateKey,
              movingMs: 0,
              stillMs: 0,
              sampleCount: 0,
              hasData: false
            }
      );
    }

    return result;
  }

  function refreshDisplay() {
    if (activePet !== SUPPORTED_PET) {
      if (activityStat) activityStat.textContent = "데모";
      if (restStat) restStat.textContent = "—";

      const avgActivity = $("avgActivity");
      const avgRest = $("avgRest");

      if (avgActivity) avgActivity.textContent = "데모 미지원";
      if (avgRest) avgRest.textContent = "데모 미지원";

      return;
    }

    const today = getToday(activePet);

    const activityText = today.hasData
      ? formatDuration(today.movingMs)
      : "기록 없음";

    const restText = today.hasData
      ? formatDuration(today.stillMs)
      : "기록 없음";

    if (activityStat) {
      activityStat.textContent = activityText;

      const note = activityStat.parentElement
        ?.querySelector(".stat-note");

      if (note) {
        note.textContent =
          "카메라 화면 변화 감지 누적 · 실제 운동량 아님";
      }
    }

    if (restStat) {
      restStat.textContent = restText;
    }

    const avgActivity = $("avgActivity");
    const avgRest = $("avgRest");

    if (avgActivity) {
      avgActivity.textContent = activityText;
    }

    if (avgRest) {
      avgRest.textContent = restText;
    }
  }

  function clearPreviousFrame() {
    previousFrame = null;
    previousBox = null;
    previousAt = null;
    previousState = null;

    stillStartedAt = null;
    stillSamples = 0;
  }

  function reset(
    message = "활동 상태: 분석 대기"
  ) {
    clearPreviousFrame();

    status.textContent = message;
    time.textContent = "움직임이 적은 시간: 00:00";

    refreshDisplay();
  }

  function showStillTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);

    const minutesText = String(
      Math.floor(seconds / 60)
    ).padStart(2, "0");

    const secondsText = String(
      seconds % 60
    ).padStart(2, "0");

    time.textContent =
      `움직임이 적은 시간: ${minutesText}:${secondsText}`;
  }

  function addSampleTime(state, elapsed) {
    if (
      !Number.isFinite(elapsed) ||
      elapsed <= 0 ||
      elapsed > MAX_SAMPLE_GAP_MS ||
      activePet !== SUPPORTED_PET
    ) {
      return;
    }

    const record = getTodayRecord();

    if (state === "moving") {
      record.movingMs += elapsed;
    } else if (state === "still") {
      record.stillMs += elapsed;
    } else {
      return;
    }

    record.sampleCount += 1;

    saveRecords();
    refreshDisplay();
  }

function setPet(petId) {
  const nextPet = petId || activePet;
  const nextDogId = getCurrentDogId();

  if (
    nextPet === activePet &&
    nextDogId === activeDogId
  ) {
    refreshDisplay();
    return;
  }

  clearPreviousFrame();

  activePet = nextPet;
  activeDogId = nextDogId;

  dailyRecords = activePet === SUPPORTED_PET
    ? loadRecords(activeDogId)
    : [];

  status.textContent = activePet === SUPPORTED_PET
    ? "활동 상태: 분석 대기"
    : "활동 상태: 현재 데모 프로필은 분석하지 않아요.";

  time.textContent = "움직임이 적은 시간: 00:00";

  refreshDisplay();
}

  function update(video, predictions) {
    const selectedPet = petSelect?.value || activePet;

if (
  selectedPet !== activePet ||
  getCurrentDogId() !== activeDogId
) {
  setPet(selectedPet);
}
    if (activePet !== SUPPORTED_PET) {
      reset("활동 상태: 강아지 프로필에서만 분석해요.");
      return;
    }

    if (!context || !video.videoWidth || !video.videoHeight) {
      reset("활동 상태: 화면을 분석할 수 없어요.");
      return;
    }

    const dogs = predictions.filter(item =>
      item.class === "dog" && item.score >= 0.50
    );

    if (dogs.length === 0) {
      reset("활동 상태: 강아지가 감지되지 않아 판단을 멈췄어요.");
      return;
    }

    if (dogs.length > 1) {
      reset(
        "활동 상태: 여러 강아지가 보여 개별 활동은 판단하지 않아요."
      );
      return;
    }

    try {
      const now = performance.now();
      const [x, y, width, height] = dogs[0].bbox;

      const box = {
        x: x / video.videoWidth,
        y: y / video.videoHeight,
        w: width / video.videoWidth,
        h: height / video.videoHeight
      };

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const frame = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;

      if (
        !previousFrame ||
        previousAt === null
      ) {
        previousFrame = frame;
        previousBox = box;
        previousAt = now;
        previousState = null;

        stillStartedAt = null;
        stillSamples = 0;

        status.textContent =
          "활동 상태: 다음 화면과 비교하고 있어요.";

        showStillTime(0);
        return;
      }

      const elapsed = now - previousAt;

      // 检测间隔过长时不补算中断期间的数据
      if (
        elapsed <= 0 ||
        elapsed > MAX_SAMPLE_GAP_MS
      ) {
        previousFrame = frame;
        previousBox = box;
        previousAt = now;
        previousState = null;

        stillStartedAt = null;
        stillSamples = 0;

        status.textContent =
          "활동 상태: 화면을 다시 확인하고 있어요.";

        showStillTime(0);
        return;
      }

      const left = Math.max(
        0,
        Math.floor(box.x * canvas.width)
      );

      const top = Math.max(
        0,
        Math.floor(box.y * canvas.height)
      );

      const right = Math.min(
        canvas.width,
        Math.ceil((box.x + box.w) * canvas.width)
      );

      const bottom = Math.min(
        canvas.height,
        Math.ceil((box.y + box.h) * canvas.height)
      );

      let changed = 0;
      let total = 0;

      for (let row = top; row < bottom; row += 2) {
        for (let col = left; col < right; col += 2) {
          const index =
            (row * canvas.width + col) * 4;

          const difference = (
            Math.abs(frame[index] - previousFrame[index]) +
            Math.abs(frame[index + 1] - previousFrame[index + 1]) +
            Math.abs(frame[index + 2] - previousFrame[index + 2])
          ) / 3;

          if (difference >= PIXEL_DIFFERENCE) {
            changed += 1;
          }

          total += 1;
        }
      }

      if (total === 0) {
        reset("활동 상태: 강아지 영역을 확인할 수 없어요.");
        return;
      }

      const centerShift = Math.hypot(
        box.x + box.w / 2 -
          (previousBox.x + previousBox.w / 2),
        box.y + box.h / 2 -
          (previousBox.y + previousBox.h / 2)
      );

      const moving =
        changed / total >= CHANGE_RATIO ||
        centerShift >= 0.03;

      const currentState = moving ? "moving" : "still";

      // 当前间隔计入上一次有效判断的状态
      if (previousState !== null) {
        addSampleTime(previousState, elapsed);
      }

      if (moving) {
        stillStartedAt = null;
        stillSamples = 0;

        status.textContent =
          "활동 상태: 강아지 주변 화면에서 움직임이 보여요.";

        showStillTime(0);
      } else {
        if (stillStartedAt === null) {
          stillStartedAt = now;
        }

        stillSamples += 1;

        const stillElapsed = now - stillStartedAt;

        status.textContent = stillSamples < 3
          ? "활동 상태: 화면 변화를 조금 더 확인하고 있어요."
          : stillElapsed >= STILL_NOTICE_MS
            ? "활동 상태: 2분 이상 화면 변화가 적어요. 쉬거나 자는 중일 수 있어요."
            : "활동 상태: 강아지 주변 화면의 변화가 적어요.";

        showStillTime(stillElapsed);
      }

      previousFrame = frame;
      previousBox = box;
      previousAt = now;
      previousState = currentState;

    } catch (error) {
      console.error("活动线索分析失败：", error);
      reset("활동 상태: 화면 분석을 완료하지 못했어요.");
    }
  }
document.addEventListener(
  "pawview:dog-profile-changed",
  () => {
    setPet(petSelect?.value || activePet);
  }
);
  // 页面隐藏时不保留旧画面比较基准
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearPreviousFrame();
    }
  });

  window.addEventListener("pagehide", saveRecords);

dailyRecords = activePet === SUPPORTED_PET
  ? loadRecords(activeDogId)
  : [];
  refreshDisplay();
  reset();
function reloadFromStorage() {
  activePet = petSelect?.value || activePet;
  activeDogId = getCurrentDogId();

  dailyRecords = activePet === SUPPORTED_PET
    ? loadRecords(activeDogId)
    : [];

  clearPreviousFrame();
  refreshDisplay();
}
window.PawDogMotion = {
  update,
  reset,
  refresh: refreshDisplay,
  reloadFromStorage,
  setPet,
  getToday,
  getHistory
};
})();
