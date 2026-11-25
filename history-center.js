// PawView 综合历史中心
// 读取本地照片、视频和声音记录。
// 不复制媒体文件，不上传数据。

(() => {
  const list = document.getElementById("mediaHistoryList");
  if (!list) return;

  const MEDIA_KEY = "pawview.mediaHistory.v1";
  const SOUND_KEY = "pawview.analysisEvents.v1";
  const AI_KEY = "pawview.aiHistory.v1";
  const FAVORITES_KEY = "pawview.historyFavorites.v1";
// 检查当前账号是否拥有本地历史数据
function canModifyHistory() {
  const uid = window.PawViewFirebaseUser?.uid;

  const ownerUid = localStorage.getItem(
    "pawview.localPetOwnerUid.v1"
  );

  if (!uid || !ownerUid || uid !== ownerUid) {
    alert(
      "현재 로그인 계정과 로컬 데이터 소유자가 일치하지 않습니다.\n" +
      "다른 계정의 기록은 수정하거나 삭제할 수 없습니다."
    );
    return false;
  }

  return true;
}
  const dateFilter = document.getElementById("historyDateFilter");
  const typeFilter = document.getElementById("historyTypeFilter");
  const showAllButton = document.getElementById("historyShowAllButton");
  const favoritesButton = document.getElementById("historyFavoritesButton");

  let showFavorites = false;
function getCurrentPet() {
  return document.getElementById("petSelect")?.value || "dog";
}

function getCurrentDogId() {
  return localStorage.getItem("pawview.currentDogId.v1")
    || "dog-default";
}
  function readStorage(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getMediaRecords() {
    const records = readStorage(MEDIA_KEY);
    return Array.isArray(records) ? records : [];
  }

  function getSoundRecords() {
    const records = readStorage(SOUND_KEY);
    if (!Array.isArray(records)) return [];

    return records
      .filter(record =>
        record &&
        typeof record.id === "string" &&
        typeof record.time === "string"
      )
.map(record => ({
  id: `sound-${record.id}`,
  sourceId: record.id,
  type: "sound",
  pet: "dog",
  dogId: record.dogId || null,
  createdAt: record.time,
  message: record.message || "반복 소리 감지",
  vision: record.vision || "unavailable"
}));
  }

  function getAIRecords() {
  const records = readStorage(AI_KEY);

  if (!Array.isArray(records)) return [];

  return records
    .filter(record =>
      record &&
      typeof record.id === "string" &&
      typeof record.createdAt === "string"
    )
    .map(record => ({
      ...record,
      type: "ai"
    }));
}
// 读取原有的每日活动统计
function getActivityRecords() {
  const dogId = getCurrentDogId();
  if (!window.PawDogMotion) return [];

  try {
    const records = window.PawDogMotion.getHistory("dog", 30);

    if (!Array.isArray(records)) return [];

    return records
      .filter(record =>
        record &&
        record.hasData === true &&
        typeof record.date === "string"
      )
      .map(record => ({
        id: `activity-${dogId}-${record.date}`,
type: "activity",
pet: "dog",
dogId: dogId,
        createdAt: `${record.date}T12:00:00`,
        movingMs: record.movingMs,
        stillMs: record.stillMs,
        sampleCount: record.sampleCount,
        message: "카메라 화면 변화 기반 활동 통계"
      }));
  } catch (error) {
    console.error("활동 기록 불러오기 실패:", error);
    return [];
  }
}
function getAllRecords() {
  return [
    ...getMediaRecords(),
    ...getSoundRecords(),
    ...getAIRecords(),
    ...getActivityRecords()
  ];
}

  function getFavorites() {
    const value = readStorage(FAVORITES_KEY);
    return Array.isArray(value) ? value : [];
  }

  function saveFavorites(records) {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(records)
    );
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "시간 정보 없음";
    }

    return date.toLocaleString("ko-KR");
  }

  function getVisionText(value) {
    if (value === "detected") return "화면에서 반려견 감지";
    if (value === "not-detected") return "화면에서 반려견 미감지";
    return "화면 판단 정보 없음";
  }
function deleteRecord(record) {
  if (!canModifyHistory()) {
    return;
  }

  if (record.type === "sound") {
      const sounds = readStorage(SOUND_KEY);

      if (!Array.isArray(sounds)) return;

      const updated = sounds.filter(
        item => item.id !== record.sourceId
      );

      localStorage.setItem(
        SOUND_KEY,
        JSON.stringify(updated)
      );

      document.dispatchEvent(
        new CustomEvent("pawview:analysis-events-updated", {
          detail: { count: updated.length }
        })
      );
       } else if (record.type === "ai") {
  const updated = readStorage(AI_KEY).filter(
    item => item.id !== record.id
  );

  localStorage.setItem(
    AI_KEY,
    JSON.stringify(updated)
  );

} else if (record.type === "activity") {
const activityKey =
  "pawview.dogMotionDaily.v3." + record.dogId;

  const saved = readStorage(activityKey, null);

  if (
    saved &&
    saved.version === 3 &&
saved.dogId === record.dogId &&
    Array.isArray(saved.days)
  ) {
    saved.days = saved.days.filter(
      item => item.date !== record.createdAt.slice(0, 10)
    );

    localStorage.setItem(
      activityKey,
      JSON.stringify(saved)
    );
    window.PawDogMotion?.reloadFromStorage();
  }

} else {
      const updated = getMediaRecords().filter(
        item => item.id !== record.id
      );

      localStorage.setItem(
        MEDIA_KEY,
        JSON.stringify(updated)
      );
    }
    saveFavorites(
      getFavorites().filter(id => id !== record.id)
    );

    render();
  }

  // Android saves file paths in media history; show only this app's media files.
  // Web downloads remain in the browser's Downloads folder and aren't indexed here.
  function openMediaRecord(record) {
    const path = typeof record.filePath === "string" ? record.filePath : "";
    const packageName = window.Capacitor?.getPlatform?.() === "android"
      ? "com.pawview.app" : "";
    if (!packageName || !path.includes(`/Android/media/${packageName}/PawView/`)) {
      alert("앱에서 열 수 있는 미디어 경로가 없습니다. PawView 앨범을 확인해 주세요.");
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "paw-media-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "PawView 미디어 보기");
    const container = document.createElement("div");
    container.className = "paw-media-dialog";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "닫기";
    close.className = "paw-media-close";
    const content = record.type === "video"
      ? document.createElement("video")
      : document.createElement("img");
    content.className = "paw-media-content";
    if (record.type === "video") {
      content.controls = true;
      content.playsInline = true;
      content.preload = "metadata";
    } else content.alt = "PawView에서 촬영한 사진";
    const message = document.createElement("p");
    message.className = "paw-media-message";
    message.textContent = "미디어를 불러오는 중…";
    content.addEventListener("loadedmetadata", () => { message.textContent = ""; });
    content.addEventListener("load", () => { message.textContent = ""; });
    content.addEventListener("error", () => {
      message.textContent = "미디어를 열 수 없습니다. 기기 PawView 앨범에서 확인해 주세요.";
    });
    const dismiss = () => {
      if (record.type === "video") content.pause();
      overlay.remove();
    };
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) dismiss();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") dismiss();
    });
    container.append(close,content,message);
    overlay.append(container);
    document.body.append(overlay);
    close.focus();
    // file:// 与 content:// URI 均由 Android 原生插件返回，不能在 content:// 前再拼 file://。
    const fileUrl = /^(file|content):\/\//i.test(path) ? path : `file://${path}`;
    try {
      const resolved = window.Capacitor?.convertFileSrc?.(fileUrl);
      if (!resolved) throw new Error("Cannot convert Android media URI");
      content.src = resolved;
    } catch (error) {
      console.warn("PawView 미디어 URL 변환 실패:", error);
      message.textContent = "미디어를 열 수 없습니다. 기기 PawView 앨범에서 확인해 주세요.";
    }
  }

  function render() {
    let records = getAllRecords();
    const favorites = getFavorites();
const currentPet = getCurrentPet();
const currentDogId = getCurrentDogId();

records = records.filter(record => {
  if (currentPet === "dog") {
    // Old pre-multi-pet records had no dogId; associate only with legacy default profile.
    return record.pet !== "cat" &&
      (record.dogId === currentDogId ||
       (!record.dogId && currentDogId === "dog-default"));
  }

  if (currentPet === "cat") {
    return record.pet === "cat";
  }

  return false;
});
    if (dateFilter?.value) {
      records = records.filter(record => {
        const date = new Date(record.createdAt);

        if (Number.isNaN(date.getTime())) return false;

        const localDate = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0")
        ].join("-");

        return localDate === dateFilter.value;
      });
    }

    if (typeFilter?.value && typeFilter.value !== "all") {
      records = records.filter(
        record => record.type === typeFilter.value
      );
    }

    if (showFavorites) {
      records = records.filter(
        record => favorites.includes(record.id)
      );
    }

    records.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    list.replaceChildren();

    if (records.length === 0) {
      const empty = document.createElement("p");
      empty.className = "report-empty";
      empty.textContent = showFavorites
        ? "즐겨찾기한 기록이 없습니다."
        : "조건에 맞는 기록이 없습니다.";

      list.appendChild(empty);
      return;
    }

    records.forEach(record => {
      const item = document.createElement("div");
      item.className = "media-history-item";

      const info = document.createElement("div");
      info.className = "media-history-info";

      const title = document.createElement("strong");

      const titles = {
        photo: "📷 사진",
        video: "🎥 동영상",
        sound: "🔊 반복 소리 감지",
        ai: "🤖 AI 인식",
        activity: "🐾 활동 기록"
      };

      title.textContent = titles[record.type] || "기록";

      const time = document.createElement("p");
      time.textContent = formatDate(record.createdAt);

      info.append(title, time);
if (record.type === "ai") {
  const message = document.createElement("p");

  message.textContent = record.message ||
    (record.state === "detected"
      ? "화면에서 강아지가 감지됐어요."
      : "화면에서 강아지가 감지되지 않았어요.");

  info.appendChild(message);
}

if (record.type === "activity") {
  const moving = document.createElement("p");
  moving.textContent =
    `화면 변화 감지: ${Math.floor((record.movingMs || 0) / 60000)}분`;

  const still = document.createElement("p");
  still.textContent =
    `화면 변화가 적은 시간: ${Math.floor((record.stillMs || 0) / 60000)}분`;

  const samples = document.createElement("p");
  samples.textContent =
    `분석 횟수: ${record.sampleCount || 0}회`;

  const note = document.createElement("p");
  note.textContent =
    "※ 실제 운동량이나 수면 시간이 아닌 화면 변화 참고 정보입니다.";

  info.append(moving, still, samples, note);
}
      if (record.type === "sound") {
        const message = document.createElement("p");
        message.textContent = record.message;

        const vision = document.createElement("p");
        vision.textContent = getVisionText(record.vision);

        info.append(message, vision);
      }

      if (record.type === "photo" || record.type === "video") {
        const pet = document.createElement("p");
        pet.textContent = record.pet === "cat"
          ? "반려동물: 고양이"
          : record.dogId
            ? `반려견 기록 · ID: ${record.dogId}`
            : "반려견 기록 · 이전 데이터";

        info.appendChild(pet);
      }

      const actions = document.createElement("div");
      actions.className = "media-history-actions";

      const favoriteButton = document.createElement("button");
      favoriteButton.type = "button";

      const isFavorite = favorites.includes(record.id);

      favoriteButton.textContent = isFavorite
        ? "★ 즐겨찾기 해제"
        : "☆ 즐겨찾기";
favoriteButton.addEventListener("click", () => {
  if (!canModifyHistory()) {
    return;
  }

  const updated = getFavorites();
        const index = updated.indexOf(record.id);

        if (index >= 0) {
          updated.splice(index, 1);
        } else {
          updated.push(record.id);
        }

        saveFavorites(updated);
        render();
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "삭제";

      deleteButton.addEventListener("click", () => {
        if (!confirm("이 기록을 목록에서 삭제할까요?")) {
          return;
        }

        deleteRecord(record);
      });

      if ((record.type === "photo" || record.type === "video") && record.filePath) {
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.textContent = record.type === "video" ? "동영상 열기" : "사진 보기";
        openButton.addEventListener("click", () => openMediaRecord(record));
        actions.prepend(openButton);
      }
      actions.append(favoriteButton, deleteButton);
      item.append(info, actions);
      list.appendChild(item);
    });
  }

  dateFilter?.addEventListener("change", render);
  typeFilter?.addEventListener("change", render);

  showAllButton?.addEventListener("click", () => {
    showFavorites = false;

    if (dateFilter) dateFilter.value = "";
    if (typeFilter) typeFilter.value = "all";

    render();
  });

  favoritesButton?.addEventListener("click", () => {
    showFavorites = !showFavorites;
    render();
  });
document.addEventListener(
  "pawview:dog-profile-changed",
  render
);

document.getElementById("petSelect")?.addEventListener(
  "change",
  render
);
  document.addEventListener(
    "pawview:analysis-events-updated",
    render
  );
document.addEventListener(
  "pawview:ai-history-updated",
  render
);
  window.addEventListener("storage", event => {
    if (
event.key === MEDIA_KEY ||
event.key === SOUND_KEY ||
event.key === AI_KEY ||
event.key === FAVORITES_KEY ||
event.key?.startsWith("pawview.dogMotionDaily.v3.")
    ) {
      render();
    }
  });

  render();

  window.PawViewHistory = { render };
})();