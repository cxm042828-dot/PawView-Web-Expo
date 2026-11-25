const $ = (id) => document.getElementById(id);

const pets = {
  cat: {
    name: "나탕", emoji: "🐱", sceneEmoji: "🐈", typeLabel: "고양이 · 실내 모니터링",
    status: "휴식 중", statusSub: "실내 활동 정상",
    activity: 68, rest: "12.4", caption: "나탕이 휴식 중입니다",
    tip: "고양이는 일정한 휴식 장소를 선호하는 경우가 많습니다. 매일의 활동 패턴을 관찰해 보세요."
  },
  dog: {
    name: "두두",
    emoji: "🐶",
    sceneEmoji: "🐕",
    typeLabel: "강아지 · 홈 모니터링",
    status: "데모 데이터",
    statusSub: "실제 상태 분석 전 · 예시 데이터입니다",
    activity: 82,
    rest: "10.2",
    caption: "두두의 시뮬레이션 화면",
    tip: "평소 활동, 휴식, 식사 패턴을 기록해 보세요. 갑작스러운 변화가 지속되면 수의사와 상담해 주세요."
  }
};

let currentPet = "dog";
// 保护者位置模拟：false = 外出，true = 在家
let guardianAtHome = false;
let isPlaying = false;
let soundOn = false;
let safeOn = true;
let deviceOn = true;
let alertCount = 0;
let toastTimer;
const notificationBadge = $("notificationCount");

if (notificationBadge) {
  notificationBadge.textContent = "";
  notificationBadge.hidden = true;
  notificationBadge.style.display = "none";
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

let phoneCameraRequest = 0;
let cameraStream = null;
let realCameraActive = false;
let cameraPreviewStartedAt = null;
let cameraPreviewTimer = null;

function updateCameraPreviewTime() {
  const elapsedSeconds = cameraPreviewStartedAt === null
    ? 0
    : Math.floor(
        (performance.now() - cameraPreviewStartedAt) / 1000
      );

  const hours = String(
    Math.floor(elapsedSeconds / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor(elapsedSeconds / 60) % 60
  ).padStart(2, "0");

  const seconds = String(
    elapsedSeconds % 60
  ).padStart(2, "0");

  $("cameraPreviewTime").textContent =
    `미리보기 시간: ${hours}:${minutes}:${seconds}`;
}

function startCameraPreviewTimer() {
  clearInterval(cameraPreviewTimer);
  cameraPreviewStartedAt = performance.now();

  updateCameraPreviewTime();

  cameraPreviewTimer = setInterval(
    updateCameraPreviewTime,
    1000
  );
}

function stopCameraPreviewTimer() {
  clearInterval(cameraPreviewTimer);
  cameraPreviewTimer = null;
  cameraPreviewStartedAt = null;

  updateCameraPreviewTime();
}

function setCameraHint(message) {
  $("cameraHint").textContent = message;
}
function setCameraStatus(connection, picture) {
  $("cameraConnectionStatus").textContent = "카메라: " + connection;
  $("cameraVideoStatus").textContent = "화면: " + picture;
}

function stopRealCamera(showMessage = true) {

  phoneCameraRequest += 1;

  window.PawViewRecording?.stop?.(true);

  window.PawViewSoundMonitor?.cameraStopped("phone");

  window.PawDogDetector?.stop();
  stopCameraPreviewTimer();

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
    realCameraActive = false;
  setCameraStatus("연결 해제됨", "표시 중지");

  const video = $("cameraVideo");

  video.pause();
  video.srcObject = null;
  renderPet();

  $("cameraScene").classList.remove("camera-active");

  // 真实摄像头关闭后恢复到未连接界面
  isPlaying = false;
  $("cameraScene").classList.remove("demo-playing");
  $("playButton").textContent = "▶ 시뮬레이션 화면 재생";

  $("cameraPlaceholder").classList.remove("visible");
  $("connectCameraButton").disabled = false;
  $("stopCameraButton").disabled = true;
    $("connectCameraButton").textContent = "↻ 카메라 다시 연결";
  $("playButton").disabled = !deviceOn;

  if (showMessage) {
    setCameraHint("실제 카메라 연결 해제됨 · 시뮬레이션 화면");
    showToast("실제 카메라 연결을 해제했습니다.");
  }
}

async function connectRealCamera() {
  if (document.querySelector(".camera-panel")?.classList.contains("pi-mode")) {
    showToast("스마트폰 카메라 모드를 선택해 주세요.");
    return;
  }
  if (guardianAtHome) {
  showToast("보호자 재실 중에는 카메라를 연결할 수 없습니다.");
  return;
}
    if (cameraStream || $("connectCameraButton").disabled) return;

  if (document.hidden) {
    setCameraHint("화면으로 돌아온 뒤 카메라를 연결해 주세요.");
    return;
  }

  setCameraStatus("연결 중", "카메라 권한 확인 중");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("카메라 기능을 사용할 수 없습니다. Live Server(localhost)로 페이지를 열어 주세요.");
    setCameraHint("카메라 사용 불가 · localhost 또는 HTTPS에서 실행해 주세요.");
        setCameraStatus("사용 불가", "표시할 수 없음");

    $("cameraPlaceholder").classList.add("visible");
    return;
  }
const requestId = ++phoneCameraRequest;
  $("connectCameraButton").disabled = true;
  $("connectCameraButton").textContent = "카메라 연결 중...";
  setCameraHint("카메라 권한을 기다리는 중입니다...");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    if (requestId !== phoneCameraRequest) {
  stream.getTracks().forEach(track => track.stop());
  return;
}
    if (guardianAtHome || document.querySelector(".camera-panel")?.classList.contains("pi-mode")) {
  stream.getTracks().forEach(track => track.stop());

  $("connectCameraButton").disabled = false;
  $("connectCameraButton").textContent = "◎ 다시 연결하기";
  setCameraStatus("개인정보 보호", "카메라 차단");
  setCameraHint("보호자 재실 중 · 카메라 사용 제한");
  return;
}
        if (document.hidden) {
      stream.getTracks().forEach(track => track.stop());

      $("connectCameraButton").disabled = false;
      $("connectCameraButton").textContent = "◎ 다시 연결하기";
      setCameraStatus("연결 취소됨", "백그라운드에서 시작하지 않음");

      setCameraHint(
        "화면이 비활성 상태여서 카메라를 켜지 않았습니다. 다시 연결해 주세요."
      );
      return;
    }

    cameraStream = stream;
    const video = $("cameraVideo");
       setCameraStatus("연결됨", "불러오는 중");
    video.srcObject = stream;
    await video.play();
    if (
  requestId !== phoneCameraRequest ||
  cameraStream !== stream
) {
  stream.getTracks().forEach(track => track.stop());
  return;
}

if (
  document.hidden ||
  guardianAtHome ||
  document.querySelector(".camera-panel")
    ?.classList.contains("pi-mode")
) {
  stopRealCamera(false);
  return;
}
    setCameraStatus("연결됨", "표시 중");

    realCameraActive = true;
        startCameraPreviewTimer();

    $("cameraScene").classList.add("camera-active");
      // 真实画面优先，不显示模拟动画
  isPlaying = false;
  $("cameraScene").classList.remove("demo-playing");
  $("playButton").textContent = "▶ 시뮬레이션 화면 재생";
    $("cameraPlaceholder").classList.remove("visible");
    $("connectCameraButton").disabled = true;
    $("connectCameraButton").textContent = "✓ 실제 카메라 연결됨";
    $("stopCameraButton").disabled = false;
    $("playButton").disabled = true;
   $("cameraHint").textContent =
  "실제 카메라 영상 표시 중 · 소리 감지는 휴대폰 마이크를 사용합니다.";
    $("sceneTime").textContent = "● REAL CAMERA";
    $("sceneCaption").textContent = "실시간 카메라 영상";
    renderPet();
    showToast("카메라 연결에 성공했습니다!");
    window.PawViewSoundMonitor?.cameraStarted("phone");
    stream.getVideoTracks().forEach(track => {
      track.addEventListener("ended", () => {
        stopRealCamera(false);
        $("playButton").disabled = false;
        setCameraHint("카메라 연결이 종료되었습니다.");
        showToast("카메라 연결이 종료되었습니다.");
      });
    });
    } catch (error) {
      if (requestId !== phoneCameraRequest) return;
    console.error("카메라 연결 실패:", error);
// 摄像头异常接入统一设备错误管理
window.pawviewSetDeviceIssue?.(
  "camera",
  "카메라 연결 오류",
  "카메라 연결에 문제가 발생했습니다. 권한과 연결 상태를 확인해 주세요."
);
    // 即使已取得摄像头，但画面播放失败，也释放设备
    stopRealCamera(false);
    setCameraStatus("연결 실패", "표시할 수 없음");

    $("connectCameraButton").disabled = false;
    $("connectCameraButton").textContent = "◎ 다시 연결하기";
    $("cameraPlaceholder").classList.add("visible");
    let message = "카메라 연결에 실패했습니다. 브라우저 권한과 카메라 연결 상태를 확인해 주세요.";
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      message = "카메라 권한이 거부되었습니다. 주소창 왼쪽의 사이트 설정에서 카메라 권한을 허용해 주세요.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      message = "카메라를 찾을 수 없습니다. 컴퓨터에 카메라가 있는지 확인해 주세요.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      message = "카메라가 다른 프로그램에서 사용 중일 수 있습니다. Zoom이나 카메라 앱을 닫고 다시 시도해 주세요.";
    }
    setCameraHint(message);
    showToast(message);
  }
}
// 这些事件只更新真实摄像头画面状态，不影响模拟画面
$("cameraVideo").addEventListener("waiting", () => {
  if (!cameraStream) return;
  setCameraStatus("연결됨", "영상 대기 중");
});

$("cameraVideo").addEventListener("playing", () => {
  if (!cameraStream) return;
  setCameraStatus("연결됨", "표시 중");
});

$("cameraVideo").addEventListener("pause", () => {
  if (!realCameraActive || !cameraStream) return;
  setCameraStatus("연결됨", "일시 정지됨");
});

$("cameraVideo").addEventListener("error", () => {
  if (!cameraStream) return;

  stopRealCamera(false);
  setCameraStatus("영상 오류", "표시 중지");
  setCameraHint("영상을 표시하지 못했습니다. 카메라를 다시 연결해 주세요.");
});
window.PawViewPhoneCamera = {
  stopForSwitch() {
    if (
      cameraStream ||
      realCameraActive ||
      $("connectCameraButton").disabled
    ) {
      stopRealCamera(false);
    }
  }
};
$("connectCameraButton").addEventListener("click", connectRealCamera);
$("stopCameraButton").addEventListener("click", () => {
  stopRealCamera(true);
  $("playButton").disabled = false;
  $("sceneTime").textContent = "CAM 01 · DEMO";
  $("sceneCaption").textContent = pets[currentPet].caption;
});
// 根据生日计算年龄，不按固定天数估算。
function getHomePetAge(birthday) {
  if (!birthday) return "생일 미등록";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return "생일 확인 필요";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const birth = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    birth > today
  ) {
    return "생일 확인 필요";
  }

  let totalMonths =
    (today.getFullYear() - year) * 12 +
    (today.getMonth() - (month - 1));

  if (today.getDate() < day) {
    totalMonths -= 1;
  }

  if (totalMonths < 1) return "생후 1개월 미만";

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months}개월`;
  if (months === 0) return `${years}살`;

  return `${years}살 ${months}개월`;
}

// 首页只读取资料，不修改原来的存储内容。
function updateHomePetProfile() {
  const avatar = $("homePetAvatar");
  const breed = $("homePetBreed");
  const age = $("homePetAge");

  if (!avatar || !breed || !age) return;

  avatar.textContent = pets[currentPet].emoji;

  // PawView：同步当前狗狗的真实照片到首页和侧栏
  // 照片保存在多宠物档案中，不读取旧版单狗资料
  if (currentPet === "dog") {
    try {
      const collectionRaw = localStorage.getItem(
        "pawview.dogProfiles.v1"
      );

      const selectedDogId = localStorage.getItem(
        "pawview.currentDogId.v1"
      );

      const collection = collectionRaw
        ? JSON.parse(collectionRaw)
        : null;

      const selectedDog = Array.isArray(collection?.dogs)
        ? collection.dogs.find(dog => dog.id === selectedDogId)
        : null;

      const photo = selectedDog?.photo || "";

      if (
        typeof photo === "string" &&
        /^data:image\/(jpeg|png|webp);base64,/.test(photo)
      ) {
        const avatarTargets = [
          avatar,
          document.getElementById("petAvatar")
        ];

        avatarTargets.forEach(target => {
          if (!target) return;

          const image = document.createElement("img");
          image.alt = "";
          image.decoding = "async";

          image.onerror = () => {
            if (target.contains(image)) {
              target.textContent = pets[currentPet].emoji;
            }
          };

          image.src = photo;
          target.replaceChildren(image);
        });
      }
    } catch (error) {
      console.warn("PawView 宠物头像读取失败：", error);
    }
  }

  if (currentPet !== "dog") {
    breed.textContent = "고양이 · 데모";
    age.textContent = "나이 정보 없음";
    return;
  }

  try {
    const raw = localStorage.getItem("pawview.dogProfile.v1");
    const profile = raw === null ? {} : JSON.parse(raw);

    if (
      !profile ||
      typeof profile !== "object" ||
      Array.isArray(profile)
    ) {
      throw new Error("Invalid profile");
    }

    breed.textContent =
      typeof profile.breed === "string" && profile.breed.trim()
        ? profile.breed.trim()
        : "품종 미등록";

    age.textContent = getHomePetAge(
      typeof profile.birthday === "string"
        ? profile.birthday
        : ""
    );
  } catch (error) {
    console.error("首页资料读取失败：", error);
    breed.textContent = "프로필 확인 필요";
    age.textContent = "나이 정보 없음";
  }
}

function renderPet() {
  const p = pets[currentPet];
    $("petSelect").value = currentPet;

  $("petAvatar").textContent = p.emoji;
  $("petName").textContent = p.name;
  $("petTypeLabel").textContent = p.typeLabel;
  $("welcomePet").textContent = p.name;
updateHomePetProfile();

  $("activityStat").textContent = "—";
$("restStat").textContent = "—";
$("currentStatus").textContent = "감지 대기";
$("statusSub").textContent = "카메라를 연결해 주세요";

// 当前宠物切换后，读取对应的活动统计
window.PawDogMotion?.setPet(currentPet);
window.PawDogMotion?.refresh();
makeActivityChart();
  $("scenePet").textContent = p.sceneEmoji;
  if (!realCameraActive) {
  $("sceneCaption").textContent = p.caption;
}

  $("tipText").textContent = p.tip;
  $("mapPet").textContent = p.emoji;
  $("mapTitle").textContent = currentPet === "cat" ? "실내 활동 구역" : "활동 범위 예시 화면";
  $("mapSubtitle").textContent = currentPet === "cat" ? "가정 내 안전 구역 · 예시 화면" : "강아지 활동 범위 · 예시 화면";
  $("safeLabel").textContent = safeOn
  ? "안전 구역 시뮬레이션 켜짐 · 실제 위치 추적 아님"
  : "안전 구역 시뮬레이션 꺼짐";
  $("safeToggle").checked = safeOn;
  if (!safeOn) {
  $("mapPet").style.left = "";
  $("mapPet").style.top = "";
}
  $("safePill").textContent = safeOn
  ? "예시 위치"
  : "시뮬레이션 꺼짐";
  $("safePill").style.background = safeOn ? "#e9f8ef" : "#f0f2f4";
  $("safePill").style.color = safeOn ? "#198c52" : "#778397";
if (realCameraActive) {
  $("cameraModeLabel").textContent = "LOCAL CAMERA";
  $("sceneTime").textContent = "● LOCAL CAMERA";

  $("sceneCaption").textContent = "이 기기의 카메라 영상";
  $("deviceStatus").textContent =
    "상태: 이 기기의 카메라 연결됨 · 원격 모니터링 아님";
} else {
  $("cameraModeLabel").textContent = deviceOn ? "DEMO" : "OFFLINE";
  $("sceneTime").textContent = deviceOn
    ? "CAM 01 · DEMO"
    : "CAM 01 · OFFLINE";

  $("deviceStatus").textContent = deviceOn
    ? "상태: 데모 모드 · 실제 모니터링 기기 미연결"
    : "상태: 데모 꺼짐 · 실제 모니터링 기기 미연결";
  }
}



// 首页和报告页：读取当前宠物的真实本地活动统计

let lastMotionChartSignature = "";

function formatMotionDuration(ms) {
  const totalMinutes = Math.floor(
    Math.max(0, Number(ms) || 0) / 60000
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;

  return `${hours}시간 ${minutes}분`;
}

function makeActivityChart() {
const homeStat = $("activityStat");
const homeRest = $("restStat");
const reportActivity = $("avgActivity");
const reportRest = $("avgRest");
  const activityChart = $("activityChart");
  const weeklyChart = $("weeklyChart");

  if (!activityChart || !weeklyChart) return;

  // 猫咪演示不显示狗狗的活动识别数据
  if (currentPet !== "dog") {
if (homeStat) homeStat.textContent = "—";
if (homeRest) homeRest.textContent = "—";
if (reportActivity) reportActivity.textContent = "—";
    if (reportRest) reportRest.textContent = "—";

    activityChart.textContent =
      "강아지를 선택하면 움직임 감지 기록을 확인할 수 있습니다.";

    weeklyChart.textContent =
      "강아지 전용 움직임 감지 기록입니다.";

    lastMotionChartSignature = "";
    return;
  }

  const motion = window.PawDogMotion;

  if (
    !motion ||
    typeof motion.getToday !== "function" ||
    typeof motion.getHistory !== "function"
  ) {
    activityChart.textContent =
      "움직임 감지 모듈을 준비하고 있습니다.";

    weeklyChart.textContent =
      "움직임 감지 모듈을 준비하고 있습니다.";

    return;
  }

  let today;
  let history;

  try {
    today = motion.getToday(currentPet) || {};
    history = motion.getHistory(currentPet, 7);

    if (!Array.isArray(history)) history = [];
  } catch (error) {
    console.error("活动记录读取失败：", error);

    activityChart.textContent =
      "움직임 감지 기록을 읽지 못했습니다.";

    weeklyChart.textContent =
      "주간 기록을 읽지 못했습니다.";

    return;
  }

  const movingMs = Math.max(
    0,
    Number(today.movingMs) || 0
  );

  const stillMs = Math.max(
    0,
    Number(today.stillMs) || 0
  );

  const sampleCount = Math.max(
    0,
    Number(today.sampleCount) || 0
  );

  const hasTodayData =
    sampleCount > 0 ||
    movingMs > 0 ||
    stillMs > 0;

  if (homeStat) {
    homeStat.textContent = hasTodayData
      ? formatMotionDuration(movingMs)
      : "—";
  }

  if (reportActivity) {
    reportActivity.textContent = hasTodayData
      ? formatMotionDuration(movingMs)
      : "—";
  }
if (homeRest) {
  homeRest.textContent = hasTodayData
    ? formatMotionDuration(stillMs)
    : "—";
}
  if (reportRest) {
    reportRest.textContent = hasTodayData
      ? formatMotionDuration(stillMs)
      : "—";
  }

  const signature = JSON.stringify({
    movingMs,
    stillMs,
    sampleCount,
    history
  });

  if (signature === lastMotionChartSignature) return;
  lastMotionChartSignature = signature;

  // 首页：今天的画面变化情况
  activityChart.replaceChildren();

  if (!hasTodayData) {
    const empty = document.createElement("p");
    empty.textContent =
      "카메라 감지 중 수집된 움직임 데이터가 아직 없습니다.";
    activityChart.appendChild(empty);
  } else {
    const total = Math.max(1, movingMs + stillMs);

    const metrics = [
      {
        label: "움직임 감지",
        value: movingMs,
        color: "#20a765"
      },
      {
        label: "화면 변화가 적었던 시간",
        value: stillMs,
        color: "#91a9a0"
      }
    ];

    metrics.forEach(metric => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:grid;grid-template-columns:125px 1fr auto;" +
        "align-items:center;gap:10px;margin:14px 0;";

      const label = document.createElement("span");
      label.textContent = metric.label;

      const track = document.createElement("div");
      track.style.cssText =
        "height:10px;background:#edf1ee;border-radius:20px;" +
        "overflow:hidden;";

      const fill = document.createElement("div");
      fill.style.cssText =
        `height:100%;width:${Math.min(100, metric.value / total * 100)}%;` +
        `background:${metric.color};border-radius:20px;`;

      track.appendChild(fill);

      const value = document.createElement("strong");
      value.textContent = formatMotionDuration(metric.value);

      row.append(label, track, value);
      activityChart.appendChild(row);
    });
  }

  // 报告页：最近7天的动作变化
  weeklyChart.replaceChildren();

  const days = history.slice(-7);

  if (days.length === 0) {
    weeklyChart.textContent =
      "최근 7일 움직임 감지 데이터가 없습니다.";
    return;
  }

  const validMoving = days.map(item =>
    Math.max(0, Number(item?.movingMs) || 0)
  );

  const maxMoving = Math.max(1, ...validMoving);

  weeklyChart.style.cssText =
    "display:grid;grid-template-columns:repeat(7,minmax(0,1fr));" +
    "gap:8px;align-items:end;min-height:145px;";

  days.forEach((item, index) => {
    const moving = Math.max(
      0,
      Number(item?.movingMs) || 0
    );

    const still = Math.max(
      0,
      Number(item?.stillMs) || 0
    );

    const samples = Number(item?.sampleCount) || 0;
    const hasData = samples > 0 || moving > 0 || still > 0;

    let date;

    if (
      typeof item?.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    ) {
      const [year, month, day] = item.date
        .split("-")
        .map(Number);

      date = new Date(year, month - 1, day);
    } else {
      date = new Date();
      date.setDate(
        date.getDate() - (days.length - 1 - index)
      );
    }

    const column = document.createElement("div");
    column.style.cssText =
      "display:flex;flex-direction:column;align-items:center;" +
      "justify-content:flex-end;gap:7px;min-width:0;";

    const value = document.createElement("small");
    value.textContent = hasData
      ? formatMotionDuration(moving)
      : "—";

    value.style.cssText =
      "font-size:10px;color:#718078;text-align:center;" +
      "white-space:nowrap;";

    const track = document.createElement("div");
    track.style.cssText =
      "height:90px;width:100%;max-width:32px;" +
      "background:#edf1ee;border-radius:8px;" +
      "display:flex;align-items:flex-end;overflow:hidden;";

    const bar = document.createElement("div");
    const height = hasData
      ? Math.max(5, moving / maxMoving * 90)
      : 3;

    bar.style.cssText =
      `height:${height}px;width:100%;` +
      `background:${hasData ? "#20a765" : "#dce4df"};` +
      "border-radius:8px;";

    track.appendChild(bar);

    const label = document.createElement("small");
    label.textContent =
      `${date.getMonth() + 1}/${date.getDate()}`;

    label.style.cssText =
      "font-size:10px;color:#718078;";

    column.title = hasData
      ? `움직임 감지 ${formatMotionDuration(moving)}`
      : "감지 데이터 없음";

    column.append(value, track, label);
    weeklyChart.appendChild(column);
  });
}


// PawView：同一个摄像头预览容器进入或退出全屏
function setCameraFullscreen(enabled) {
  const panel = document.querySelector(
    "#page-monitor .camera-panel"
  );

  const button = $("cameraFullscreenButton");

  if (!panel || !button) return;

  const active = Boolean(enabled);

  panel.classList.toggle("paw-fullscreen", active);

  document.body.classList.toggle(
    "paw-camera-fullscreen",
    active
  );

  button.textContent = active
    ? "✕ 닫기"
    : "⛶ 전체화면";

  button.setAttribute(
    "aria-pressed",
    String(active)
  );
}

// 页面切换
function navigate(page, scrollTargetId = null) {
  const target = $(`page-${page}`);

  if (!target) return;

  // 当前版本的猫咪是演示资料，
  // 避免进入狗狗档案后误认为正在编辑猫咪
  if (page === "pet-profile" && currentPet !== "dog") {
    showToast("고양이는 데모 프로필입니다. 강아지 프로필을 선택해 주세요.");
    return;
  }

  // 离开首页前关闭全屏，但不停止摄像头
  if (page !== "monitor") {
    setCameraFullscreen(false);
  }

  document.querySelectorAll(".page").forEach(el => {
    el.classList.remove("active");
  });

  target.classList.add("active");

  // 档案页面属于首页的子页面
  const navPage = page === "pet-profile"
    ? "monitor"
    : page;

  document.querySelectorAll(
    ".nav-item, .mobile-nav-item"
  ).forEach(el => {
    el.classList.toggle(
      "active",
      el.dataset.page === navPage
    );
  });

  const titles = {
    monitor: "실시간 모니터링",
    report: "건강 리포트",
    community: "양육 커뮤니티",
    location: "위치 및 안전",
    settings: "기기 설정",
    "pet-profile": "반려동물 프로필"
  };

  $("pageTitle").textContent =
    titles[page] || "실시간 모니터링";

  if (scrollTargetId && $(scrollTargetId)) {
    requestAnimationFrame(() => {
      $(scrollTargetId).scrollIntoView({
        behavior: "auto",
        block: "start"
      });
    });
  } else {
    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }

  // 返回首页后，如视频被浏览器暂停，
  // 尝试恢复同一个已有视频流，不重新申请权限。
  if (page === "monitor" && realCameraActive && cameraStream) {
    const video = $("cameraVideo");

    if (video && video.srcObject === cameraStream && video.paused) {
      video.play().catch(error => {
        console.warn("카메라 미리보기 재생 확인:", error);
      });
    }
  }
}

// 保留现有 data-goto 页面入口
document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.goto);
  });
});

// 全屏按钮
$("cameraFullscreenButton")?.addEventListener("click", () => {
  const panel = document.querySelector(
    "#page-monitor .camera-panel"
  );

  if (!panel) return;

  setCameraFullscreen(
    !panel.classList.contains("paw-fullscreen")
  );
});

// 电脑浏览器通过 Esc 退出全屏
document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    document.body.classList.contains("paw-camera-fullscreen")
  ) {
    setCameraFullscreen(false);
  }
});

// 首页跳转至设置中的摄像头连接区域
$("openCameraSettingsButton")?.addEventListener("click", () => {
  navigate("settings", "cameraConnectionSettings");
});


$("petSelect").addEventListener("change", (event) => {
  currentPet = event.target.value;
  renderPet();
  makeActivityChart();
  showToast(`${currentPet === "cat" ? "고양이" : "강아지"} 데모 프로필로 전환했습니다.`);
});

$("playButton").addEventListener("click", () => {

  if (
    document.querySelector(".camera-panel")
      ?.classList.contains("pi-mode")
  ) {
    showToast("스마트폰 카메라 모드를 먼저 선택해 주세요.");
    return;
  }

  if (realCameraActive) {
    showToast("실제 카메라가 연결되어 있습니다. 먼저 카메라 연결을 해제해 주세요.");
    return;
  }
  if (!deviceOn) {
    showToast("시뮬레이션 기기가 오프라인입니다. 기기 설정에서 먼저 켜 주세요.");
    return;
  }
  isPlaying = !isPlaying;
  $("cameraScene").classList.toggle("demo-playing", isPlaying);
  $("playButton").textContent = isPlaying ? "Ⅱ 시뮬레이션 화면 일시 정지" : "▶ 시뮬레이션 화면 재생";
  $("cameraHint").textContent = isPlaying ? "시뮬레이션 재생 중 · 실제 영상 스트림 아님" : "일시 정지됨 · 애니메이션 데모 화면";
  $("sceneTime").textContent = isPlaying ? "● LIVE DEMO" : "CAM 01 · DEMO";
  $("scenePet").style.transform = isPlaying ? "translate(-50%,-25%) translateX(18px) rotate(-4deg)" : "translate(-50%,-25%)";
  $("scenePet").style.filter = isPlaying ? "drop-shadow(0 10px 5px #5e493322) saturate(1.15)" : "drop-shadow(0 10px 5px #5e493322)";
  showToast(isPlaying ? "시뮬레이션 화면을 재생합니다." : "시뮬레이션 화면을 일시 정지했습니다.");
});
async function ensurePawViewAlbum(Media) {
  const albumKey = "pawview.albumIdentifier.v1";

  const pathResult = await Media.getAlbumsPath();
  const basePath = String(pathResult.path || "").replace(/\/+$/, "");

  if (!basePath) {
    throw new Error("无法获取系统相册目录");
  }

  const findAlbum = async () => {
    const result = await Media.getAlbums();

    return result.albums?.find(item => {
      const id = item?.identifier || "";

      return (
        id.startsWith(basePath + "/") &&
        /\/PawView\/?$/i.test(id)
      );
    });
  };

  let album = await findAlbum();

  if (!album) {
    await Media.createAlbum({ name: "PawView" });
    album = await findAlbum();
  }

  if (!album?.identifier) {
    throw new Error("无法创建或找到 PawView 相册");
  }

  localStorage.setItem(albumKey, album.identifier);

  return album.identifier;
}
$("snapshotButton").addEventListener("click", async () => {
  const video = $("cameraVideo");
  const button = $("snapshotButton");

  if (!realCameraActive || video.videoWidth === 0) {
    showToast(
      "저장할 카메라 영상이 없습니다. 이 기기의 카메라를 먼저 연결해 주세요."
    );
    return;
  }
  // 拍照开始时固定宠物身份，避免保存期间切换档案造成串记录
  const capturePet = currentPet;
  const captureDogId = capturePet === "dog"
    ? localStorage.getItem("pawview.currentDogId.v1")
    : null;
  button.disabled = true;

  let url = null;
  let link = null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("无法创建截图画布");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const timestamp = Date.now();
    const fileName = "PawView-camera-" + timestamp + ".png";
    const cap = window.Capacitor;

       // Android：直接保存到系统相册
    if (cap?.getPlatform?.() === "android") {
      const Media = window.PawViewMedia;

      if (!Media) {
        throw new Error("PawView 相册插件尚未加载");
      }

      const imageData = canvas.toDataURL("image/png");
const albumIdentifier = await ensurePawViewAlbum(Media);

      const saved = await Media.savePhoto({
        path: imageData,
        albumIdentifier: albumIdentifier,
        fileName: "PawView-camera-" + timestamp
      });

      // 只保存历史索引，不重复保存图片
      const historyKey = "pawview.mediaHistory.v1";
      const history = JSON.parse(
        localStorage.getItem(historyKey) || "[]"
      );
history.unshift({
  id: "photo-" + timestamp,
  type: "photo",
  name: fileName,
  filePath: saved.filePath || "",
  createdAt: new Date(timestamp).toISOString(),
  favorite: false,
  pet: capturePet,
  dogId: captureDogId
});
      localStorage.setItem(
        historyKey,
        JSON.stringify(history.slice(0, 500))
      );

      showToast("사진을 PawView 앨범에 저장했습니다.");
      return;
    }

    // 浏览器：保留原来的 PNG 下载功能
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("生成截图失败"));
        }
      }, "image/png");
    });

    url = URL.createObjectURL(blob);
    link = document.createElement("a");
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    showToast("PNG 다운로드를 요청했습니다. 다운로드 목록을 확인해 주세요.");

  } catch (error) {
    console.error("照片保存失败：", error);
    showToast("사진 저장에 실패했습니다. 다시 시도해 주세요.");
  } finally {
    button.disabled = false;
    link?.remove();

    if (url) {
      const downloadUrl = url;
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    }
  }
});


$("refreshButton").addEventListener("click", () => {
  const careDetails = document.getElementById("careDetails");

if (careDetails) {
  careDetails.open = true;
}
  const form = document.getElementById("careForm");
  const typeInput = document.getElementById("careType");

  if (!form || !typeInput) {
    showToast("돌봄 기록 영역을 찾을 수 없습니다.");
    return;
  }

  form.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  typeInput.focus({ preventScroll: true });
});

function updateSound(on) {
  soundOn = on;
  $("soundLabel").textContent = on ? "현재 켜져 있음" : "현재 꺼져 있음";
  $("soundArrow").textContent = on ? "✓" : "›";
  $("settingsSoundToggle").checked = on;
  showToast(on ? "소리 알림을 켰습니다. (데모 상태)" : "소리 알림을 껐습니다.");
}
$("soundButton").addEventListener("click", () => updateSound(!soundOn));
$("settingsSoundToggle").addEventListener("change", e => {
  soundOn = e.target.checked;
  $("soundLabel").textContent = soundOn ? "현재 켜져 있음" : "현재 꺼져 있음";
  $("soundArrow").textContent = soundOn ? "✓" : "›";
});

$("safeButton").addEventListener("click", () => {
  safeOn = !safeOn;
  renderPet();
  showToast(safeOn
    ? "안전 구역 시뮬레이션을 켰습니다. 실제 위치 추적은 수행되지 않습니다."
    : "안전 구역 시뮬레이션을 껐습니다.");
});
// 根据模拟的保护者位置自动更新隐私快门 UI

// 根据模拟的保护者位置自动更新隐私快门 UI
function updateGuardianPrivacyUI() {
  const locationStatus = $("guardianLocationStatus");
  const shutterStatus = $("privacyShutterStatus");

  if (!locationStatus || !shutterStatus) return;

  if (guardianAtHome) {
    locationStatus.textContent = "재실 중 (시뮬레이션)";
    shutterStatus.textContent = "닫힘 · 카메라 사용 제한";

    // 停止已连接或正在申请权限的手机摄像头
    if (
      cameraStream ||
      $("connectCameraButton").disabled
    ) {
      stopRealCamera(false);
    }
  } else {
    locationStatus.textContent = "외출 중 (시뮬레이션)";
    shutterStatus.textContent = "열림 · 카메라 사용 가능";
  }
}


$("guardianHomeToggle").addEventListener("change", e => {
  guardianAtHome = e.target.checked;

  updateGuardianPrivacyUI();

  showToast(
    guardianAtHome
      ? "보호자 재실 · 프라이버시 모드 활성화"
      : "보호자 외출 · 카메라 사용 가능"
  );
});

updateGuardianPrivacyUI();
$("safeToggle").addEventListener("change", e => {
  safeOn = e.target.checked;
  renderPet();
  showToast(safeOn
    ? "안전 구역 시뮬레이션을 켰습니다. 실제 위치 추적은 수행되지 않습니다."
    : "안전 구역 시뮬레이션을 껐습니다.");
});

$("alertToggle").addEventListener("change", e => {
  showToast(e.target.checked
    ? "이탈 알림 시뮬레이션을 켰습니다. 실제 알림은 전송되지 않습니다."
    : "이탈 알림 시뮬레이션을 껐습니다.");
});
$("summaryToggle").addEventListener("change", e => showToast(e.target.checked ? "일일 활동 요약을 켰습니다." : "일일 활동 요약을 껐습니다."));

$("simulateExitButton").addEventListener("click", () => {
  if (!safeOn) {
    showToast("먼저 안전 구역 시뮬레이션을 켜 주세요.");
    return;
  }
$("safePill").textContent = "이탈 예시";
  $("safePill").style.background = "#fff0e9";
  $("safePill").style.color = "#d36c3f";
  $("mapPet").style.left = "82%";
  $("mapPet").style.top = "12%";
  if ($("alertToggle").checked) {
        showToast("안전 구역 이탈 시뮬레이션입니다. 실제 위치 감지나 알림 전송은 수행되지 않습니다.");
  } else {
    showToast("안전 구역 이탈 시뮬레이션입니다. 알림 설정은 꺼져 있습니다.");
  }
});


$("deviceToggle").addEventListener("change", e => {
  deviceOn = e.target.checked;
  if (!deviceOn && realCameraActive) {
    stopRealCamera(false);
    $("playButton").disabled = false;
  }
  renderPet();
  $("playButton").disabled = !deviceOn;
  $("playButton").style.opacity = deviceOn ? "1" : ".55";
  showToast(deviceOn ? "시뮬레이션 기기가 온라인 상태입니다." : "시뮬레이션 기기가 오프라인 상태입니다.");
});
$("notificationButton").addEventListener("click", () => {
  showToast("실제 알림 기록이 없습니다. 원격 모니터링 및 스마트폰 푸시 알림은 아직 연결되지 않았습니다.");
});
$("settingsSummaryToggle").addEventListener("change", e => {
  showToast(e.target.checked ? "건강 요약 표시를 켰습니다." : "건강 요약 표시를 껐습니다.");
  $("avgActivity").closest(".stat-card").style.opacity = e.target.checked ? "1" : ".35";
});

const now = new Date();
$("todayLabel").textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 · 반려동물 생활 상태`;
$("datePill").textContent = `${now.getMonth()+1}월 ${now.getDate()}일`;
renderPet();
makeActivityChart();
// 等所有 defer 脚本加载完，再刷新一次活动统计
document.addEventListener("DOMContentLoaded", () => {
  window.PawDogMotion?.setPet(currentPet);
  window.PawDogMotion?.refresh();
  makeActivityChart();
}, { once: true });

// 仅刷新统计界面，不启动摄像头或麦克风
window.setInterval(() => {
  if (!document.hidden) {
    makeActivityChart();
  }
}, 5000);

// 모바일 하단 메뉴 연결// 电脑与手机导航统一处理，只绑定一次
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest(
    ".nav-item, .mobile-nav-item"
  );

  if (!button) return;

  const page = button.dataset.page;

  // 页面不存在时，不执行切换
  if (!page || !document.getElementById(`page-${page}`)) {
    console.warn("找不到导航对应的页面：", page);
    return;
  }

  event.preventDefault();
  navigate(page);
});
// 手动照护记录：仅保存在当前浏览器或 APP 本地
(() => {
  function initCareRecords() {
    const form = document.getElementById("careForm");
    const typeInput = document.getElementById("careType");
    const amountInput = document.getElementById("careAmount");
    const amountLabel = document.getElementById("careAmountLabel");
    const noteInput = document.getElementById("careNote");
    const timeInput = document.getElementById("careTime");
    const list = document.getElementById("careRecords");
const filterInput = document.getElementById("careFilter");

filterInput?.addEventListener("change", () => {
  renderRecords();
});

    if (!form || !typeInput || !amountInput ||
        !amountLabel || !noteInput || !list) {
      console.error("照护记录区域缺少元素，请检查 HTML。");
      return;
    }

    const storageKey = "pawview.careRecords.v1";
    // 检查当前账号是否有权修改本地照护记录
function canModifyCareRecords() {
  const uid = window.PawViewFirebaseUser?.uid;

  const ownerUid = localStorage.getItem(
    "pawview.localPetOwnerUid.v1"
  );

  if (!uid || !ownerUid || uid !== ownerUid) {
    showToast(
      "현재 계정과 데이터 소유자가 일치하지 않아 기록을 수정할 수 없습니다."
    );
    return false;
  }

  return true;
}
// 获取当前选中的具体狗狗档案 ID
function getCurrentDogId() {
  try {
    const dogId = localStorage.getItem("pawview.currentDogId.v1");

    if (
      typeof dogId === "string" &&
      dogId.trim().length > 0
    ) {
      return dogId;
    }
  } catch (error) {
    console.error("读取当前狗狗 ID 失败：", error);
  }

  return null;
}
    const types = {
      food: { name: "식사", unit: "g", label: "식사량 (g, 선택)" },
      water: { name: "음수", unit: "ml", label: "음수량 (ml, 선택)" },
      walk: { name: "산책", unit: "분", label: "산책 시간 (분, 선택)" },
      note: { name: "메모", unit: "", label: "" }
    };

    let records = [];
    let storageReadable = true;

    // 读取失败时不覆盖已有存储，避免丢失记录
    try {
      const saved = localStorage.getItem(storageKey);

      if (saved !== null) {
        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed) || !parsed.every(record =>
          record &&
          typeof record.id === "string" &&
          typeof record.pet === "string" &&
          (
  record.dogId === undefined ||
  record.dogId === null ||
  (
    typeof record.dogId === "string" &&
    record.dogId.length > 0 &&
    record.dogId.length <= 200
  )
) &&
          Object.prototype.hasOwnProperty.call(types, record.type) &&
          typeof record.note === "string" &&
          typeof record.time === "string" &&
          Number.isFinite(Date.parse(record.time)) &&
          (record.amount === null ||
            (typeof record.amount === "number" &&
             Number.isFinite(record.amount) &&
             record.amount > 0 &&
             record.amount <= 100000))
        )) {
          throw new Error("保存的记录格式不正确");
        }

        records = parsed;
      }
    } catch (error) {
      storageReadable = false;
      console.error("读取照护记录失败：", error);
      showToast("기록을 불러오지 못했습니다. 기존 데이터는 변경하지 않았습니다.");
    }

function saveRecords(nextRecords) {
  // 不允许其他 Firebase 账号修改当前本地记录
  if (!canModifyCareRecords()) {
    return false;
  }

  if (!storageReadable) {
        showToast("저장소를 확인할 수 없어 기록을 변경하지 않았습니다.");
        return false;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(nextRecords));
        records = nextRecords;
        return true;
      } catch (error) {
        console.error("保存照护记录失败：", error);
        showToast("저장에 실패했습니다. 저장 공간과 설정을 확인해 주세요.");
        return false;
      }
    }

    function updateFields() {
      const type = typeInput.value;
      const isNote = type === "note";

      amountInput.hidden = isNote;
      amountInput.disabled = isNote;
      amountLabel.hidden = isNote;
      amountLabel.textContent = types[type].label;
      amountInput.value = "";

      noteInput.placeholder = isNote
        ? "기록할 내용을 입력해 주세요."
        : "상태나 특이사항을 입력해 주세요.";
    }
    // 按当前宠物、当前设备的本地日期统计手动记录
    function renderTodaySummary() {
      const today = new Date();

      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );

      const fields = [
        { type: "food", id: "todayFood", unit: "g" },
        { type: "water", id: "todayWater", unit: "ml" },
        { type: "walk", id: "todayWalk", unit: "분" }
      ];

      fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) return;

        if (!storageReadable) {
          element.textContent = "불러오기 실패";
          return;
        }

        const matchedRecords = records.filter(record => {
          const time = Date.parse(record.time);

          return (
            record.pet === currentPet &&
record.dogId === getCurrentDogId() &&
            record.type === field.type &&
            typeof record.amount === "number" &&
            Number.isFinite(record.amount) &&
            record.amount > 0 &&
            time >= start.getTime() &&
            time < end.getTime()
          );
        });

        if (matchedRecords.length === 0) {
          element.textContent = "미기록";
          return;
        }

        // 当前输入精度为一位小数，以整数累计避免浮点误差
        const total = matchedRecords.reduce(
          (sum, record) => sum + Math.round(record.amount * 10),
          0
        ) / 10;

        element.textContent =
          total.toLocaleString("ko-KR", {
            maximumFractionDigits: 1
          }) + " " + field.unit;
      });
    }

        function renderRecords() {
      renderTodaySummary();
      list.replaceChildren();


      if (!storageReadable) {
        const message = document.createElement("p");
        message.className = "care-empty";
        message.textContent = "저장된 기록을 불러오지 못했습니다.";
        list.appendChild(message);
        return;
      }

            const selectedType = filterInput?.value ?? "all";

const currentDogId = getCurrentDogId();

const visibleRecords = records
  .filter(record =>
    record.pet === currentPet &&
    record.dogId === currentDogId &&
    (
      selectedType === "all" ||
      record.type === selectedType
    )
  )
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));


      if (visibleRecords.length === 0) {
        const message = document.createElement("p");
        message.className = "care-empty";
                message.textContent = selectedType === "all"
          ? "아직 돌봄 기록이 없습니다. 첫 기록을 남겨 보세요."
          : `${types[selectedType].name} 기록이 없습니다.`;
        list.appendChild(message);
        return;
      }

      visibleRecords.forEach(record => {
        const item = document.createElement("div");
        item.className = "care-record";

        const copy = document.createElement("div");
        copy.className = "care-record-copy";

        const title = document.createElement("strong");
        const type = types[record.type];

        title.textContent = record.amount === null
          ? type.name
          : `${type.name} · ${record.amount} ${type.unit}`;

        const time = document.createElement("time");
        time.dateTime = record.time;
        time.textContent = new Date(record.time).toLocaleString("ko-KR");

        copy.append(title, time);

        if (record.note) {
          const note = document.createElement("p");
          // 使用 textContent，避免备注被当成 HTML 执行
          note.textContent = record.note;
          copy.appendChild(note);
        }
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "secondary-button";
        editButton.textContent = "수정";
        editButton.setAttribute(
          "aria-label",
          `${type.name} 기록 수정`
        );

editButton.addEventListener("click", () => {
  if (
    record.dogId !== getCurrentDogId() ||
    record.pet !== currentPet
  ) {
    showToast("현재 선택한 반려동물의 기록만 수정할 수 있습니다.");
    renderRecords();
    return;
  }

  let nextAmount = record.amount;
          // 备注类型不填写数量
          if (record.type !== "note") {
            const amountText = window.prompt(
              `${type.name} 수량 (${type.unit})\n수량을 기록하지 않으려면 비워 두세요.`,
              record.amount === null ? "" : String(record.amount)
            );

            // 点击取消，不修改记录
            if (amountText === null) return;

            const trimmedAmount = amountText.trim();

            nextAmount = trimmedAmount === ""
              ? null
              : Number(trimmedAmount);

            if (
              nextAmount !== null &&
              (
                !Number.isFinite(nextAmount) ||
                nextAmount < 0.1 ||
                nextAmount > 100000 ||
                Math.abs(
                  nextAmount * 10 - Math.round(nextAmount * 10)
                ) > 0.000001
              )
            ) {
              showToast(
                "수량은 0.1~100000 범위에서 소수점 한 자리까지 입력해 주세요."
              );
              return;
            }
          }

          const noteText = window.prompt(
            "메모를 입력해 주세요. (최대 500자)",
            record.note
          );

          if (noteText === null) return;

          const nextNote = noteText.trim();

          if (nextNote.length > 500) {
            showToast("메모는 500자 이내로 입력해 주세요.");
            return;
          }

          if (nextAmount === null && !nextNote) {
            showToast("수량이나 메모를 입력해 주세요.");
            return;
          }

          // 保留原 ID、宠物、类型和记录时间
          const nextRecords = records.map(saved =>
saved.id === record.id &&
saved.dogId === record.dogId
              ? {
                  ...saved,
                  amount: nextAmount,
                  note: nextNote
                }
              : saved
          );

          if (saveRecords(nextRecords)) {
            renderRecords();
            showToast("기록을 수정했습니다. 원래 기록 시각은 유지됩니다.");
          }
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "care-delete";
        deleteButton.textContent = "삭제";
        deleteButton.setAttribute("aria-label", `${type.name} 기록 삭제`);
deleteButton.addEventListener("click", () => {
  if (
    record.dogId !== getCurrentDogId() ||
    record.pet !== currentPet
  ) {
    showToast("현재 선택한 반려동물의 기록만 삭제할 수 있습니다.");
    renderRecords();
    return;
  }

  if (!window.confirm("이 기록을 삭제할까요?")) return;
const nextRecords = records.filter(
  saved =>
    !(
      saved.id === record.id &&
      saved.dogId === record.dogId
    )
);
          if (saveRecords(nextRecords)) {
            renderRecords();
            showToast("기록을 삭제했습니다.");
          }
        });

        item.append(copy, editButton, deleteButton);
        list.appendChild(item);
      });
    }

    // 导出当前宠物的全部手动照护记录
    document.getElementById("exportCareButton")?.addEventListener(
      "click",
      () => {
        if (!storageReadable) {
          showToast("기록을 불러올 수 없어 내보내지 못했습니다.");
          return;
        }
const currentDogId = getCurrentDogId();

const selectedRecords = records
  .filter(record =>
    record.pet === currentPet &&
    record.dogId === currentDogId
  )
  .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
        if (selectedRecords.length === 0) {
          showToast("내보낼 돌봄 기록이 없습니다.");
          return;
        }

        // 正确处理逗号、引号、换行，并防止表格公式注入
        function csvCell(value) {
          let text = String(value ?? "");

          if (/^[\s\uFEFF]*[=+\-@]/u.test(text) ||
              /^[\t\r\n]/u.test(text)) {
            text = "'" + text;
          }

          return '"' + text.replace(/"/g, '""') + '"';
        }

        const petName = pets[currentPet].name;

        const rows = [
          [
            "반려동물",
            "기록 시각(이 기기의 현지 시간)",
            "기록 시각(UTC)",
            "종류",
            "수량",
            "단위",
            "메모",
            "데이터 출처"
          ]
        ];

        selectedRecords.forEach(record => {
          const type = types[record.type];
          const date = new Date(record.time);

          const localTime =
            date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0") + " " +
            String(date.getHours()).padStart(2, "0") + ":" +
            String(date.getMinutes()).padStart(2, "0") + ":" +
            String(date.getSeconds()).padStart(2, "0");

          rows.push([
            petName,
            localTime,
            date.toISOString(),
            type.name,
            record.amount === null ? "" : record.amount,
            record.amount === null ? "" : type.unit,
            record.note,
            "수동 입력"
          ]);
        });

        const csv = rows
          .map(row => row.map(csvCell).join(","))
          .join("\r\n");

        let url = null;
        let link = null;

        try {
          // BOM 帮助 Excel 正确识别韩文、中文
          const blob = new Blob(
            ["\uFEFF", csv],
            { type: "text/csv;charset=utf-8;" }
          );

          url = URL.createObjectURL(blob);
          link = document.createElement("a");

          const now = new Date();
          const dateLabel =
            now.getFullYear() + "-" +
            String(now.getMonth() + 1).padStart(2, "0") + "-" +
            String(now.getDate()).padStart(2, "0");

          link.href = url;
          link.download =
            "PawView-" + currentPet + "-care-" + dateLabel + ".csv";

          document.body.appendChild(link);
          link.click();

          showToast("CSV 다운로드를 요청했습니다. 다운로드 목록을 확인해 주세요.");
        } catch (error) {
          console.error("导出照护记录失败：", error);
          showToast("내보내기에 실패했습니다. 브라우저 설정을 확인해 주세요.");
        } finally {
          link?.remove();

          if (url) {
            const downloadUrl = url;
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
          }
        }
      }
    );
// 新增手动照护记录，并绑定当前狗狗档案
form.addEventListener("submit", event => {
  event.preventDefault();

  if (!storageReadable) {
    showToast("기록을 불러올 수 없어 새 기록을 저장하지 못했습니다.");
    return;
  }

  const dogId = getCurrentDogId();

  if (!dogId) {
    showToast("먼저 반려동물 프로필을 선택해 주세요.");
    return;
  }

  const type = typeInput.value;

  if (!Object.prototype.hasOwnProperty.call(types, type)) {
    showToast("기록 종류를 확인해 주세요.");
    return;
  }

  let amount = null;

  if (type !== "note") {
    const amountText = amountInput.value.trim();

    if (amountText !== "") {
      amount = Number(amountText);

      if (
        !Number.isFinite(amount) ||
        amount < 0.1 ||
        amount > 100000 ||
        Math.abs(
          amount * 10 - Math.round(amount * 10)
        ) > 0.000001
      ) {
        showToast(
          "수량은 0.1~100000 범위에서 소수점 한 자리까지 입력해 주세요."
        );
        return;
      }
    }
  }

  const note = noteInput.value.trim();

  if (note.length > 500) {
    showToast("메모는 500자 이내로 입력해 주세요.");
    return;
  }

  if (amount === null && !note) {
    showToast("수량이나 메모를 입력해 주세요.");
    return;
  }

  let recordTime = new Date();

  if (timeInput && timeInput.value.trim() !== "") {
    const parsedTime = new Date(timeInput.value);

    if (!Number.isFinite(parsedTime.getTime())) {
      showToast("기록 시간을 확인해 주세요.");
      return;
    }

    recordTime = parsedTime;
  }

  let recordId;

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    recordId = window.crypto.randomUUID();
  } else {
    recordId =
      "care-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 12);
  }

  const newRecord = {
    id: recordId,
    pet: currentPet,
    dogId: dogId,
    type: type,
    amount: amount,
    note: note,
    time: recordTime.toISOString()
  };

  if (saveRecords([...records, newRecord])) {
    form.reset();
    updateFields();
    renderRecords();

    showToast("돌봄 기록을 저장했습니다.");
  }
});
    typeInput.addEventListener("change", updateFields);

    document.getElementById("petSelect")?.addEventListener(
      "change",
      () => renderRecords()
    );
// 当前狗狗档案发生变化时，刷新照护记录和今日统计
document.addEventListener(
  "pawview:dog-profile-changed",
  () => {
    renderRecords();
  }
);
       updateFields();
    renderRecords();

    // 页面持续打开时，跨天后更新今日合计
    setInterval(renderTodaySummary, 60000);

    // 从后台回到页面时立即更新
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        renderTodaySummary();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCareRecords);
  } else {
    initCareRecords();
  }
})();
// PawView 多只狗狗独立档案管理
(() => {
  function initDogProfile() {
    const form = document.getElementById("dogProfileForm");
    const nameInput = document.getElementById("dogName");
    const breedInput = document.getElementById("dogBreed");
    const birthdayInput = document.getElementById("dogBirthday");
    const weightInput = document.getElementById("dogWeight");
    const photoInput = document.getElementById("dogPhoto");
    const genderInput = document.getElementById("dogGender");
    const photoPreview = document.getElementById("dogPhotoPreview");
    const photoPreviewImage = document.getElementById("dogPhotoPreviewImage");
    const removePhotoButton = document.getElementById("removeDogPhotoButton");
    const activityInput = document.getElementById("dogActivityHabits");
    const dietInput = document.getElementById("dogDietHabits");
    const notesInput = document.getElementById("dogSpecialNotes");
    const ageDisplay = document.getElementById("dogCalculatedAge");

    const profileSelect = document.getElementById("dogProfileSelect");
    const addButton = document.getElementById("addDogProfileButton");
    const deleteButton = document.getElementById("deleteDogProfileButton");

    if (
      !form || !nameInput || !breedInput ||
      !birthdayInput || !weightInput ||
      !photoInput || !genderInput ||
      !activityInput || !dietInput || !notesInput
    ) {
      console.error("狗狗资料表单缺少必要元素，请检查 HTML。");
      return;
    }

    const LEGACY_KEY = "pawview.dogProfile.v1";
    const PROFILES_KEY = "pawview.dogProfiles.v1";
    const CURRENT_ID_KEY = "pawview.currentDogId.v1";
const LOCAL_OWNER_KEY = "pawview.localPetOwnerUid.v1";

function canModifyPetProfiles() {
  const user = window.PawViewFirebaseUser;

  if (!user?.uid) {
    showToast("로그인 상태를 확인한 후 다시 시도해 주세요.");
    return false;
  }

  const ownerUid = localStorage.getItem(LOCAL_OWNER_KEY);

  if (!ownerUid) {
    showToast("먼저 계정과 반려동물 자료의 소유권을 확인해 주세요.");
    return false;
  }

  if (ownerUid !== user.uid) {
    showToast("다른 계정의 반려동물 자료는 수정할 수 없습니다.");
    return false;
  }

  return true;
}
const PENDING_DELETE_PREFIX = "pawview.pendingPetDeletes.v1.";

function pendingDeleteKey(uid) {
  if (typeof uid !== "string" || !uid) {
    throw new Error("Firebase 用户 ID 无效");
  }

  return PENDING_DELETE_PREFIX + uid;
}

function readPendingDeletes(uid) {
  const raw = localStorage.getItem(pendingDeleteKey(uid));

  if (raw === null) return [];

  const ids = JSON.parse(raw);

  if (
    !Array.isArray(ids) ||
    !ids.every(id => typeof id === "string" && id.length > 0)
  ) {
    throw new Error("待删除宠物任务格式不正确");
  }

  return [...new Set(ids)];
}

function writePendingDeletes(uid, ids) {
  localStorage.setItem(
    pendingDeleteKey(uid),
    JSON.stringify([...new Set(ids)])
  );
}

function addPendingDelete(uid, dogId) {
  const ids = readPendingDeletes(uid);

  if (!ids.includes(dogId)) {
    ids.push(dogId);
    writePendingDeletes(uid, ids);
  }
}

function removePendingDelete(uid, dogId) {
  const ids = readPendingDeletes(uid);

  writePendingDeletes(
    uid,
    ids.filter(id => id !== dogId)
  );
}

async function retryPendingPetDeletes(uid) {
  const cloudPets = window.PawViewFirebasePets;
  const currentUser = window.PawViewFirebaseUser;

  if (
    !cloudPets ||
    !currentUser ||
    currentUser.uid !== uid
  ) {
    throw new Error("Firebase 登录账号不匹配");
  }

  const ids = readPendingDeletes(uid);

  for (const dogId of ids) {
    // 防止账号切换后继续执行上一账号的任务
    if (window.PawViewFirebaseUser?.uid !== uid) {
      throw new Error("Firebase 账号已切换，停止删除同步");
    }

    await cloudPets.deleteCloudPet(dogId);

    // 必须在云端确认成功后才删除本地任务
    removePendingDelete(uid, dogId);
  }
}

    let dogs = [];
    let currentDogId = "dog-default";
    let profile = null;
    let storageReadable = true;

    function todayString() {
      const now = new Date();

      return now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");
    }

    birthdayInput.max = todayString();

    function validBirthday(value) {
      if (value === "") return true;
      if (typeof value !== "string") return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(value + "T00:00:00Z");

      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        value >= "0001-01-01" &&
        value <= todayString()
      );
    }

    function calculateDogAge(birthday) {
      if (!birthday) return "";

      const birth = new Date(birthday + "T00:00:00");
      const today = new Date();

      let years = today.getFullYear() - birth.getFullYear();
      let months = today.getMonth() - birth.getMonth();

      if (today.getDate() < birth.getDate()) {
        months--;
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      if (years < 0) return "";
      if (years === 0 && months === 0) return "1개월 미만";
      if (years === 0) return months + "개월";
      if (months === 0) return years + "살";

      return years + "살 " + months + "개월";
    }

    function updateDogAge() {
      if (!ageDisplay) return;

      const age = calculateDogAge(birthdayInput.value);

      ageDisplay.textContent = age
        ? "현재 나이: " + age
        : "생일을 입력하면 나이가 자동으로 계산됩니다.";
    }

    function validProfile(item) {
      return (
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 30 &&
        typeof item.breed === "string" &&
        item.breed.length <= 60 &&
        typeof item.birthday === "string" &&
        validBirthday(item.birthday) &&
        (
          item.weight === null ||
          (
            typeof item.weight === "number" &&
            Number.isFinite(item.weight) &&
            item.weight >= 0.1 &&
            item.weight <= 150
          )
        ) &&
        (
          item.gender === undefined ||
          ["", "male", "female", "unknown"].includes(item.gender)
        ) &&
        (
          item.activityHabits === undefined ||
          (
            typeof item.activityHabits === "string" &&
            item.activityHabits.length <= 500
          )
        ) &&
        (
          item.dietHabits === undefined ||
          (
            typeof item.dietHabits === "string" &&
            item.dietHabits.length <= 500
          )
        ) &&
        (
          item.specialNotes === undefined ||
          (
            typeof item.specialNotes === "string" &&
            item.specialNotes.length <= 500
          )
        ) &&
        (
          item.photo === undefined ||
          (
            typeof item.photo === "string" &&
            item.photo.length <= 1500000 &&
            (
              item.photo === "" ||
              /^data:image\/(jpeg|png|webp);base64,/u.test(item.photo)
            )
          )
        )
      );
    }

function normalizeProfile(item) {
  return {
    name: item.name,
    breed: item.breed,
    birthday: item.birthday,
    weight: item.weight,
    gender: item.gender ?? "",
    activityHabits: item.activityHabits ?? "",
    dietHabits: item.dietHabits ?? "",
    specialNotes: item.specialNotes ?? "",
    photo: item.photo ?? "",
    updatedAt: item.updatedAt || ""
  };
}

    function validDogCollection(value) {
      if (
        !value ||
        typeof value !== "object" ||
        !Array.isArray(value.dogs) ||
        value.dogs.length === 0 ||
        value.dogs.length > 100
      ) {
        return false;
      }

      const ids = new Set();

      return value.dogs.every(item => {
        if (
          !item ||
          typeof item.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) ||
          ids.has(item.id) ||
          !validProfile(item)
        ) {
          return false;
        }

        ids.add(item.id);
        return true;
      });
    }

    function createDogId() {
      if (window.crypto?.randomUUID) {
        return "dog-" + window.crypto.randomUUID();
      }

      return "dog-" +
        Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 12);
    }

function updateDogPhotoPreview(photo) {
  if (!photoPreview || !photoPreviewImage) return;

  // 照片加载失败时显示默认头像
  if (!photoPreviewImage.dataset.errorBound) {
    photoPreviewImage.addEventListener("error", () => {
      photoPreview.classList.add("photo-load-error");
    });

    photoPreviewImage.addEventListener("load", () => {
      photoPreview.classList.remove("photo-load-error");
    });

    photoPreviewImage.dataset.errorBound = "true";
  }



const defaultAvatar = document.getElementById("dogPhotoDefaultAvatar");

if (photo) {
  photoPreview.classList.remove("photo-load-error");
  photoPreviewImage.src = photo;
  photoPreviewImage.classList.add("visible");

  if (defaultAvatar) {
    defaultAvatar.hidden = true;
  }
} else {
  photoPreviewImage.removeAttribute("src");
  photoPreviewImage.classList.remove("visible");
  photoPreview.classList.remove("photo-load-error");

  if (defaultAvatar) {
    defaultAvatar.hidden = false;
  }
}


// 同步照片到宠物信息概览卡片
const summaryPhoto = document.getElementById("dogSummaryPhoto");
const summaryDefaultAvatar = document.getElementById("dogSummaryDefaultAvatar");

if (summaryPhoto && summaryDefaultAvatar) {
  summaryPhoto.onerror = () => {
    summaryPhoto.hidden = true;
    summaryDefaultAvatar.hidden = false;
  };

  if (photo) {
    summaryPhoto.src = photo;
    summaryPhoto.hidden = false;
    summaryDefaultAvatar.hidden = true;
  } else {
    summaryPhoto.removeAttribute("src");
    summaryPhoto.hidden = true;
    summaryDefaultAvatar.hidden = false;
  }
}


  // 创建照片放大预览窗口（只创建一次）
  let lightbox = document.getElementById("dogPhotoLightbox");

  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "dogPhotoLightbox";
    lightbox.className = "photo-lightbox";

    lightbox.innerHTML = `
      <button
        type="button"
        class="photo-lightbox-close"
        aria-label="사진 미리보기 닫기"
      >×</button>
      <img alt="강아지 사진 확대 미리보기">
    `;

    document.body.appendChild(lightbox);

    const closeButton = lightbox.querySelector(".photo-lightbox-close");
    const enlargedImage = lightbox.querySelector("img");

    closeButton.addEventListener("click", () => {
      lightbox.classList.remove("visible");
    });

    lightbox.addEventListener("click", event => {
      if (event.target === lightbox) {
        lightbox.classList.remove("visible");
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        lightbox.classList.remove("visible");
      }
    });

    // 双指缩放和单指拖动
    let startDistance = 0;
    let startZoom = 1;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let currentZoom = 1;
    let currentPanX = 0;
    let currentPanY = 0;

    function getTouchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;

      return Math.sqrt(dx * dx + dy * dy);
    }

    enlargedImage.addEventListener("touchstart", event => {
      if (event.touches.length === 2) {
        startDistance = getTouchDistance(event.touches);
        startZoom = currentZoom;
      } else if (event.touches.length === 1 && currentZoom > 1) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        startPanX = currentPanX;
        startPanY = currentPanY;
      }
    }, { passive: true });

    enlargedImage.addEventListener("touchmove", event => {
      if (event.touches.length === 2 && startDistance > 0) {
        event.preventDefault();

        const distance = getTouchDistance(event.touches);

        currentZoom = Math.min(
          4,
          Math.max(1, startZoom * distance / startDistance)
        );

        if (currentZoom === 1) {
          currentPanX = 0;
          currentPanY = 0;
        }

      } else if (event.touches.length === 1 && currentZoom > 1) {
        event.preventDefault();

        currentPanX =
          startPanX + event.touches[0].clientX - startX;

        currentPanY =
          startPanY + event.touches[0].clientY - startY;
      }

      enlargedImage.style.setProperty("--zoom", currentZoom);
      enlargedImage.style.setProperty("--pan-x", currentPanX + "px");
      enlargedImage.style.setProperty("--pan-y", currentPanY + "px");
    }, { passive: false });

    enlargedImage.dataset.zoomBound = "true";
  }

  // 点击宠物照片，打开大图
  if (!photoPreviewImage.dataset.lightboxBound) {
    photoPreviewImage.addEventListener("click", () => {
      const currentPhoto = photoPreviewImage.getAttribute("src");

      if (!currentPhoto || photoPreview.classList.contains("photo-load-error")) {
        return;
      }

      const enlargedImage = lightbox.querySelector("img");

      // 每次打开都恢复默认大小和位置
      enlargedImage.src = currentPhoto;
      enlargedImage.style.setProperty("--zoom", "1");
      enlargedImage.style.setProperty("--pan-x", "0px");
      enlargedImage.style.setProperty("--pan-y", "0px");

      lightbox.classList.add("visible");
    });

    photoPreviewImage.dataset.lightboxBound = "true";
  }
}


    function readAndCompressDogPhoto(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
          reject(new Error("请选择有效的图片文件"));
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          reject(new Error("图片不能超过 15 MB"));
          return;
        }

        const reader = new FileReader();

        reader.onerror = () => {
          reject(new Error("图片读取失败"));
        };

        reader.onload = () => {
          const image = new Image();

          image.onerror = () => {
            reject(new Error("无法识别这张图片"));
          };

          image.onload = () => {
            try {
              const maxSize = 1200;
              const scale = Math.min(
                1,
                maxSize / Math.max(image.width, image.height)
              );

              const canvas = document.createElement("canvas");

              canvas.width = Math.max(
                1,
                Math.round(image.width * scale)
              );

              canvas.height = Math.max(
                1,
                Math.round(image.height * scale)
              );

              const context = canvas.getContext("2d");

              if (!context) {
                throw new Error("图片处理功能不可用");
              }

              context.fillStyle = "#ffffff";
              context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
              );

              context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
              );

              let quality = 0.82;
              let compressed = canvas.toDataURL(
                "image/jpeg",
                quality
              );

              while (
                compressed.length > 1500000 &&
                quality > 0.3
              ) {
                quality -= 0.1;

                compressed = canvas.toDataURL(
                  "image/jpeg",
                  quality
                );
              }

              if (compressed.length > 1500000) {
                throw new Error("压缩后图片仍然过大，请选择较小的图片");
              }

              canvas.width = 0;
              canvas.height = 0;

              resolve(compressed);
            } catch (error) {
              reject(error);
            }
          };

          image.src = reader.result;
        };

        reader.readAsDataURL(file);
      });
    }

    // 保存档案集合，并同步旧版单狗资料键，兼容原有页面

function persistProfiles(nextDogs, selectedId) {
  const selected = nextDogs.find(item => item.id === selectedId);

  if (!selected) {
    throw new Error("找不到当前狗狗档案");
  }

  // 保存所有宠物资料和照片
  localStorage.setItem(
    PROFILES_KEY,
    JSON.stringify({
      version: 1,
      dogs: nextDogs
    })
  );

  // 旧版本兼容：只保存当前宠物的基本资料，不重复保存照片
  const legacyProfile = normalizeProfile(selected);

  legacyProfile.photo = "";

  localStorage.setItem(
    LEGACY_KEY,
    JSON.stringify(legacyProfile)
  );

  // 保存当前选中的宠物 ID
  localStorage.setItem(CURRENT_ID_KEY, selectedId);
}


// ========================================
// PawView 本地与 Firebase 云端宠物资料同步
// ========================================


// ========================================
// PawView 本地与 Firebase 云端宠物资料同步
// ========================================

async function syncPetProfilesWithCloud() {
  const cloudPets = window.PawViewFirebasePets;
  const currentUser = window.PawViewFirebaseUser;

  if (!cloudPets) {
    throw new Error("Firebase 宠物同步模块尚未加载");
  }

  if (!currentUser || !currentUser.uid) {
    throw new Error("当前用户未登录，不能同步宠物资料");
  }
const syncUid = currentUser.uid;
// 本地宠物资料所属 Firebase 账号
const LOCAL_OWNER_KEY = "pawview.localPetOwnerUid.v1";

const savedOwnerUid = localStorage.getItem(LOCAL_OWNER_KEY);

if (savedOwnerUid && savedOwnerUid !== syncUid) {
  throw new Error(
    "当前手机的本地宠物资料属于其他账号，已停止云端同步"
  );
}

// 旧版本没有保存所属账号，首次迁移时必须人工确认
if (!savedOwnerUid) {
  const confirmed = window.confirm(
    "PawView 发现尚未绑定账号的本地宠物资料。\n\n" +
    "请确认这些资料属于当前登录的 Firebase 账号。\n\n" +
    "确认后，这些本地资料将绑定到当前账号，" +
    "并可能同步到该账号的云端。\n\n" +
    "如果不确定，请点击取消。"
  );

  if (!confirmed) {
    throw new Error(
      "尚未确认本地宠物资料归属，已停止云端同步"
    );
  }

  // 归属确认成功后才保存
  localStorage.setItem(LOCAL_OWNER_KEY, syncUid);
}
function assertSyncUser() {
  if (window.PawViewFirebaseUser?.uid !== syncUid) {
    throw new Error(
      "Firebase 账号已切换，已停止旧账号的同步"
    );
  }
}
  try {
// 1. 先处理以前没有成功同步的删除任务
await retryPendingPetDeletes(currentUser.uid);

// 2. 再读取当前账号的云端宠物资料
const remoteDogs = await cloudPets.loadCloudPets();
assertSyncUser();
    if (!Array.isArray(remoteDogs)) {
      throw new Error("云端宠物资料格式不正确");
    }

    // 2. 保存当前本地资料快照
    const localDogs = Array.isArray(dogs)
      ? [...dogs]
      : [];

    const mergedDogs = [];
    const uploadQueue = [];
const deletedDogIds = new Set(
  remoteDogs
    .filter(item => item && item.deleted === true)
    .map(item => item.id)
);
    // 3. 以云端资料为基础进行合并
    for (const remoteDog of remoteDogs) {
      if (
        !remoteDog ||
        typeof remoteDog.id !== "string" ||
        !remoteDog.id
      ) {
        continue;
      }

      // 删除标记：不再恢复本地旧资料
      if (remoteDog.deleted === true) {
        continue;
      }

      const localDog = localDogs.find(
        item => item.id === remoteDog.id
      );

      if (!localDog) {
        // 云端有、本地没有：从云端恢复
        mergedDogs.push({
          ...remoteDog,
          photo: ""
        });

        continue;
      }

      // 4. 比较更新时间
      const localTime = Date.parse(
        localDog.updatedAt || ""
      );

      const remoteTime = Date.parse(
        remoteDog.updatedAt || ""
      );

      let selectedDog;

      if (
        Number.isFinite(localTime) &&
        Number.isFinite(remoteTime) &&
        localTime > remoteTime
      ) {
        // 本地更新：保留本地资料，等待上传
        selectedDog = {
          ...remoteDog,
          ...localDog,
          photo: localDog.photo || ""
        };

        uploadQueue.push(selectedDog);

      } else {
        // 云端较新，或者无法确认更新时间：以云端为准
        selectedDog = {
          ...localDog,
          ...remoteDog,
          photo: localDog.photo || ""
        };
      }

      mergedDogs.push(selectedDog);
    }

// 5. 保留真正的本地独有资料
// 云端明确标记删除的宠物，不允许在本地恢复
for (const localDog of localDogs) {
  if (!localDog || !localDog.id) {
    continue;
  }

  // 云端明确删除的宠物不能再次上传
  if (deletedDogIds.has(localDog.id)) {
    continue;
  }

  const existsInCloud = remoteDogs.some(
    item => item && item.id === localDog.id
  );

  if (!existsInCloud) {
    mergedDogs.push(localDog);

    // 本地新增但云端不存在的宠物，加入待上传队列
    uploadQueue.push(localDog);
  }
}

    // 6. 检查合并结果
    const mergedIds = mergedDogs.map(item => item.id);

if (new Set(mergedIds).size !== mergedIds.length) {
  throw new Error("宠物同步结果存在重复 ID，已停止覆盖本地资料");
}
    if (mergedDogs.length === 0) {
      throw new Error(
        "同步后没有可用宠物资料，为保护本地数据，已停止覆盖"
      );
    }

    // 7. 确定当前选中的宠物
    const selectedId = mergedDogs.some(
      item => item.id === currentDogId
    )
      ? currentDogId
      : mergedDogs[0].id;

// 8. 保存合并后的本地资料
assertSyncUser();
persistProfiles(mergedDogs, selectedId);

    dogs = mergedDogs;
    currentDogId = selectedId;

    profile = normalizeProfile(
      dogs.find(item => item.id === currentDogId)
    );

    applyProfile();
document.dispatchEvent(
  new CustomEvent("pawview:dog-profile-changed", {
    detail: {
      dogId: currentDogId
    }
  })
);
    // 9. 上传确认比云端更新的本地资料
for (const localDog of uploadQueue) {
  assertSyncUser();

  await cloudPets.saveCloudPet({
    ...localDog,
    photo: ""
  });

  assertSyncUser();
}

    console.log(
      "PawView 宠物资料同步完成：",
      currentUser.uid
    );

    return true;

  } catch (error) {
    console.error(
      "PawView 宠物云端同步失败：",
      error
    );

    // 必须继续向外抛出，通知登录监听同步失败
    throw error;
  }
}

// 提供给 Firebase 登录监听使用
window.syncPetProfilesWithCloud =
  syncPetProfilesWithCloud;

    function renderDogOptions() {
      if (!profileSelect) return;

      profileSelect.replaceChildren();

      dogs.forEach(dog => {
        const option = document.createElement("option");
        option.value = dog.id;
        option.textContent = dog.name;
        profileSelect.appendChild(option);
      });

      profileSelect.value = currentDogId;

      if (deleteButton) {
        deleteButton.disabled = dogs.length <= 1;
      }
    }


function updateDogProfileSummary() {
  const summaryName = document.getElementById("dogSummaryName");
  const summaryBreed = document.getElementById("dogSummaryBreed");
  const summaryAge = document.getElementById("dogSummaryAge");
  const summaryWeight = document.getElementById("dogSummaryWeight");
  const summaryGender = document.getElementById("dogSummaryGender");
  const summaryPhoto = document.getElementById("dogSummaryPhoto");
  const summaryDefaultAvatar = document.getElementById("dogSummaryDefaultAvatar");

  if (!summaryName) return;

  // 名称和品种
  summaryName.textContent = nameInput.value.trim() || "반려동물";
  summaryBreed.textContent = breedInput.value.trim() || "품종 미등록";

  // 根据生日计算年龄
  const birthday = birthdayInput.value;

  if (birthday) {
    const [year, month, day] = birthday.split("-").map(Number);
    const today = new Date();

    let years = today.getFullYear() - year;
    let months = today.getMonth() + 1 - month;

    if (today.getDate() < day) {
      months--;
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years < 0) {
      summaryAge.textContent = "미등록";
    } else if (years === 0 && months === 0) {
      summaryAge.textContent = "1개월 미만";
    } else if (years === 0) {
      summaryAge.textContent = months + "개월";
    } else if (months === 0) {
      summaryAge.textContent = years + "세";
    } else {
      summaryAge.textContent = years + "세 " + months + "개월";
    }
  } else {
    summaryAge.textContent = "미등록";
  }

  // 体重
  const weight = weightInput.value.trim();
  summaryWeight.textContent = weight ? weight + " kg" : "미등록";

  // 性别
  const genderLabels = {
    male: "수컷",
    female: "암컷",
    unknown: "모름"
  };

  summaryGender.textContent =
    genderLabels[genderInput.value] || "미등록";

  // 照片
  const photo = profile?.photo || "";

  if (photo) {
    summaryPhoto.onerror = () => {
      summaryPhoto.hidden = true;
      summaryDefaultAvatar.hidden = false;
    };

    summaryPhoto.src = photo;
    summaryPhoto.hidden = false;
    summaryDefaultAvatar.hidden = true;
  } else {
    summaryPhoto.removeAttribute("src");
    summaryPhoto.hidden = true;
    summaryDefaultAvatar.hidden = false;
  }
}

function applyProfile() {
  if (!profile) return;

  pets.dog.name = profile.name;
  pets.dog.typeLabel = profile.breed
    ? "강아지 · " + profile.breed
    : "강아지 · 홈 모니터링";

  pets.dog.caption = profile.name + "의 시뮬레이션 화면";

  nameInput.value = profile.name;
  breedInput.value = profile.breed;
  birthdayInput.value = profile.birthday;
  weightInput.value = profile.weight === null
    ? ""
    : String(profile.weight);

  genderInput.value = profile.gender || "";
  activityInput.value = profile.activityHabits || "";
  dietInput.value = profile.dietHabits || "";
  notesInput.value = profile.specialNotes || "";

  photoInput.value = "";
  delete photoPreview.dataset.removePhoto;

  updateDogAge();
  updateDogPhotoPreview(profile.photo || "");
  updateDogProfileSummary();
  renderDogOptions();

  // 保留原有 dog/cat 类型标识
  renderPet();
}

    // 初始化：优先读取多狗资料；没有时迁移旧单狗资料
    try {
      const savedCollection = localStorage.getItem(PROFILES_KEY);

      if (savedCollection !== null) {
        const parsed = JSON.parse(savedCollection);

        if (!validDogCollection(parsed)) {
          throw new Error("多狗档案数据格式不正确");
        }

        dogs = parsed.dogs.map(item => ({
          id: item.id,
          ...normalizeProfile(item)
        }));

        const savedId = localStorage.getItem(CURRENT_ID_KEY);

        currentDogId = dogs.some(item => item.id === savedId)
          ? savedId
          : dogs[0].id;

      } else {
        const legacySaved = localStorage.getItem(LEGACY_KEY);

        let firstProfile = {
          name: pets.dog.name,
          breed: "",
          birthday: "",
          weight: null,
          gender: "",
          activityHabits: "",
          dietHabits: "",
          specialNotes: "",
          photo: ""
        };

        if (legacySaved !== null) {
          const parsed = JSON.parse(legacySaved);

          if (!validProfile(parsed)) {
            throw new Error("旧版狗狗资料格式不正确");
          }

          firstProfile = normalizeProfile(parsed);
        }

        dogs = [{
          id: "dog-default",
          ...firstProfile
        }];

        currentDogId = "dog-default";

        persistProfiles(dogs, currentDogId);
      }

      profile = normalizeProfile(
        dogs.find(item => item.id === currentDogId)
      );

      // 同步当前档案到旧键，保证旧页面继续正常读取
      persistProfiles(dogs, currentDogId);

    } catch (error) {
      storageReadable = false;

      console.error("读取狗狗档案失败：", error);

      showToast(
        "프로필을 불러오지 못했습니다. 기존 저장 내용은 유지됩니다."
      );

      return;
    }

    // 切换当前狗狗档案
    function selectDog(id) {
      const selected = dogs.find(item => item.id === id);

      if (!selected) return;

      try {
        persistProfiles(dogs, id);

        currentDogId = id;
        profile = normalizeProfile(selected);

        applyProfile();
        document.dispatchEvent(
  new CustomEvent("pawview:dog-profile-changed", {
    detail: {
      dogId: currentDogId
    }
  })
);
      } catch (error) {
        console.error("切换狗狗档案失败：", error);
        showToast("프로필을 전환하지 못했습니다.");
      }
    }

    profileSelect?.addEventListener("change", () => {
      selectDog(profileSelect.value);
    });

    // 添加新狗狗
 addButton?.addEventListener("click", async () => {
  if (!canModifyPetProfiles()) {
  return;
}
      if (!storageReadable) {
        showToast("프로필을 불러올 수 없어 새 프로필을 추가하지 못했습니다.");
        return;
      }

      const name = window.prompt("새 강아지의 이름을 입력해 주세요.");

      if (name === null) return;

      const trimmedName = name.trim();

      if (!trimmedName || trimmedName.length > 30) {
        showToast("이름은 1~30자 이내로 입력해 주세요.");
        return;
      }

      const newDog = {
        id: createDogId(),
        name: trimmedName,
        breed: "",
        birthday: "",
        weight: null,
        gender: "",
        activityHabits: "",
        dietHabits: "",
        specialNotes: "",
photo: "",
updatedAt: new Date().toISOString()
      };

      const nextDogs = [...dogs, newDog];


      try {
        // 1. 先保存到本地
        persistProfiles(nextDogs, newDog.id);

        dogs = nextDogs;
        currentDogId = newDog.id;
        profile = normalizeProfile(newDog);
applyProfile();

document.dispatchEvent(
  new CustomEvent("pawview:dog-profile-changed", {
    detail: {
      dogId: currentDogId
    }
  })
);

// 2. 再同步到 Firebase
        try {
          const cloudPets = window.PawViewFirebasePets;
          const currentUser = window.PawViewFirebaseUser;

          if (cloudPets && currentUser) {
            await cloudPets.saveCloudPet({
              ...newDog,
              photo: ""
            });

            showToast("새 강아지 프로필을 추가하고 클라우드에 동기화했습니다.");
          } else {
            showToast("새 강아지 프로필을 추가했습니다.");
          }

        } catch (cloudError) {
          console.error("Firebase 新宠物同步失败：", cloudError);

          showToast("프로필은 추가되었지만 클라우드 동기화에 실패했습니다.");
        }

      } catch (error) {
        console.error("添加狗狗档案失败：", error);

        showToast(
          "프로필 추가에 실패했습니다. 저장 공간을 확인해 주세요."
        );
      }
    });


// 删除当前狗狗，至少保留一只

deleteButton?.addEventListener("click", async () => {
  if (!canModifyPetProfiles()) {
  return;
}
  if (!storageReadable) {
    showToast("프로필을 불러올 수 없어 삭제하지 못했습니다.");
    return;
  }

  if (dogs.length <= 1) {
    showToast("최소 한 개의 강아지 프로필은 유지해야 합니다.");
    return;
  }

  const currentUser = window.PawViewFirebaseUser;

  if (!currentUser?.uid) {
    showToast("프로필 삭제를 위해 먼저 로그인해 주세요.");
    return;
  }

  if (!window.confirm(
    "'" + profile.name +
    "' 프로필을 삭제할까요?\n삭제한 프로필은 복구할 수 없습니다."
  )) {
    return;
  }

  const uid = currentUser.uid;
  const deletedDogId = currentDogId;
  const previousPending = readPendingDeletes(uid);

  const nextDogs = dogs.filter(
    item => item.id !== deletedDogId
  );

  const nextId = nextDogs[0].id;

  // 先记录删除任务，再修改本地资料
  try {
    addPendingDelete(uid, deletedDogId);

    try {
      persistProfiles(nextDogs, nextId);
    } catch (storageError) {
      // 本地资料没有成功删除，恢复原来的任务队列
      writePendingDeletes(uid, previousPending);
      throw storageError;
    }

  } catch (error) {
    console.error("宠物删除准备失败：", error);
    showToast("프로필 삭제 준비에 실패했습니다.");
    return;
  }

  dogs = nextDogs;
  currentDogId = nextId;
  profile = normalizeProfile(nextDogs[0]);

  applyProfile();

  document.dispatchEvent(
    new CustomEvent("pawview:dog-profile-changed", {
      detail: { dogId: currentDogId }
    })
  );

  // 尝试立即同步删除任务
  try {
    await retryPendingPetDeletes(uid);

    showToast("프로필 삭제가 클라우드에 반영되었습니다.");

  } catch (cloudError) {
    console.error("Firebase 删除同步待重试：", cloudError);

    showToast(
      "프로필은 삭제되었습니다. 클라우드 동기화는 연결 복구 후 재시도합니다."
    );
  }
});



    // 选择照片并预览
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files?.[0];

      if (!file) return;

      try {
        const compressedPhoto = await readAndCompressDogPhoto(file);

        delete photoPreview.dataset.removePhoto;
        updateDogPhotoPreview(compressedPhoto);

      } catch (error) {
        photoInput.value = "";
        updateDogPhotoPreview(profile.photo || "");

        showToast("사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.");
        console.error("照片预览失败：", error);
      }
    });

    // 标记删除照片，点击保存后才正式删除
    removePhotoButton?.addEventListener("click", () => {
      photoInput.value = "";
      updateDogPhotoPreview("");

      photoPreview.dataset.removePhoto = "true";

      showToast("사진이 삭제됩니다. 프로필 저장을 눌러 완료해 주세요.");
    });

    birthdayInput.addEventListener("input", updateDogAge);
    birthdayInput.addEventListener("change", updateDogAge);
// 输入宠物资料时，实时更新信息概览卡片
[
  nameInput,
  breedInput,
  birthdayInput,
  weightInput,
  genderInput
].forEach(input => {
  input.addEventListener("input", updateDogProfileSummary);
  input.addEventListener("change", updateDogProfileSummary);
});

    // 保存当前狗狗资料
    form.addEventListener("submit", async event => {
      event.preventDefault();
if (!canModifyPetProfiles()) {
  return;
}
      if (!storageReadable) {
        showToast("기존 프로필을 읽을 수 없어 덮어쓰지 않았습니다.");
        return;
      }

      const rawWeight = weightInput.value.trim();
      const selectedPhoto = photoInput.files?.[0] || null;

      try {
        let photo = photoPreview.dataset.removePhoto === "true"
          ? ""
          : (profile.photo || "");

        if (selectedPhoto) {
          showToast("사진을 처리하고 있습니다...");
          photo = await readAndCompressDogPhoto(selectedPhoto);
        }

        const nextProfile = {
          name: nameInput.value.trim(),
          breed: breedInput.value.trim(),
          birthday: birthdayInput.value,
          weight: rawWeight === "" ? null : Number(rawWeight),
          gender: genderInput.value,
          activityHabits: activityInput.value.trim(),
          dietHabits: dietInput.value.trim(),
          specialNotes: notesInput.value.trim(),
          photo: photo,
          updatedAt: new Date().toISOString()
        };

        if (!validProfile(nextProfile)) {
          showToast("이름, 생일, 체중을 확인해 주세요. 생일은 미래 날짜일 수 없습니다.");
          return;
        }

        const nextDogs = dogs.map(item =>
          item.id === currentDogId
            ? {
                id: currentDogId,
                ...nextProfile
              }
            : item
        );

        // 1. 먼저保存到本地
        persistProfiles(nextDogs, currentDogId);

        dogs = nextDogs;
        profile = normalizeProfile(nextProfile);

        applyProfile();

        // 2. 再同步到 Firebase
        try {
          const cloudPets = window.PawViewFirebasePets;
          const currentUser = window.PawViewFirebaseUser;

          if (cloudPets && currentUser) {
            await cloudPets.saveCloudPet({
              id: currentDogId,
              ...nextProfile,
              photo: ""
            });

            showToast("강아지 프로필을 저장하고 클라우드에 동기화했습니다.");
          } else {
            showToast("프로필을 저장했습니다. 클라우드 동기화는 로그인 후 가능합니다.");
          }

        } catch (cloudError) {
          console.error("Firebase 宠物资料同步失败：", cloudError);

          showToast("프로필은 저장되었지만 클라우드 동기화에 실패했습니다.");
        }

      } catch (error) {
        console.error("保存狗狗资料失败：", error);

        showToast(
          error.name === "QuotaExceededError"
            ? "저장 공간이 부족합니다. 사진 크기를 줄여 주세요."
            : "저장에 실패했습니다. 사진과 저장 공간을 확인해 주세요."
        );
      }
    });


    // 首次显示当前狗狗
    applyProfile();
  }

// ========================================
// PawView 宠物资料初始化与登录同步
// ========================================


let pawViewDogProfileInitialized = false;
let pawViewCloudSyncUid = null;
let pawViewCloudSyncPromise = null;

// 处理 Firebase 登录状态
async function handlePawViewAuthChange(user) {
  if (!user?.uid) {
    pawViewCloudSyncUid = null;

    console.log("PawView：用户未登录");
    return;
  }

  if (!pawViewDogProfileInitialized) {
    return;
  }

  // 已有同步正在运行，先等它结束，避免并发合并
  if (pawViewCloudSyncPromise) {
    await pawViewCloudSyncPromise;
  }

  // 等待期间可能已经退出或切换账号
  if (window.PawViewFirebaseUser?.uid !== user.uid) {
    return;
  }

  // 当前账号已经成功同步
  if (pawViewCloudSyncUid === user.uid) {
    return;
  }

  const task = (async () => {
    try {
      await window.syncPetProfilesWithCloud();

      if (window.PawViewFirebaseUser?.uid !== user.uid) {
        return;
      }

      pawViewCloudSyncUid = user.uid;

      console.log(
        "PawView：宠物云端同步成功",
        user.uid
      );

    } catch (error) {
      if (window.PawViewFirebaseUser?.uid === user.uid) {
        pawViewCloudSyncUid = null;
      }

      console.error(
        "PawView 云端同步失败：",
        error
      );
    }
  })();

  pawViewCloudSyncPromise = task;

  try {
    await task;
  } finally {
    // 不清除其他调用可能建立的新任务
    if (pawViewCloudSyncPromise === task) {
      pawViewCloudSyncPromise = null;
    }
  }
}


// 监听 Firebase 登录状态变化
window.addEventListener(
  "pawview-auth-state-changed",
  (event) => {
    handlePawViewAuthChange(event.detail?.user || null);
  }
);
// 网络恢复后重新尝试 Firebase 宠物同步
window.addEventListener("online", () => {
  const user = window.PawViewFirebaseUser;

  if (!user?.uid || !pawViewDogProfileInitialized) {
    return;
  }

  pawViewCloudSyncUid = null;
  handlePawViewAuthChange(user);
});

// APP 回到前台时检查同步
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;

  const user = window.PawViewFirebaseUser;

  if (!user?.uid || !pawViewDogProfileInitialized) {
    return;
  }

  pawViewCloudSyncUid = null;
  handlePawViewAuthChange(user);
});
// 初始化本地宠物资料
function startPawViewDogProfile() {
  initDogProfile();

  pawViewDogProfileInitialized = true;

  // 处理 Firebase 模块已经获取到的登录状态
  if (window.PawViewFirebaseUser) {
    handlePawViewAuthChange(window.PawViewFirebaseUser);
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    startPawViewDogProfile,
    { once: true }
  );
} else {
  startPawViewDogProfile();
}

})();


// PawView 备份与恢复：支持多狗档案及旧版本备份
(() => {
  const backupButton = document.getElementById("backupDataButton");
  const restoreButton = document.getElementById("restoreDataButton");
  const fileInput = document.getElementById("restoreDataFile");

  if (!backupButton || !restoreButton || !fileInput) return;

  const PROFILE_KEY = "pawview.dogProfile.v1";
  const PROFILES_KEY = "pawview.dogProfiles.v1";
  const CURRENT_DOG_KEY = "pawview.currentDogId.v1";
  const CARE_KEY = "pawview.careRecords.v1";
  const ANALYSIS_KEY = "pawview.analysisEvents.v1";
const AI_KEY = "pawview.aiHistory.v1";
const MEDIA_KEY = "pawview.mediaHistory.v1";
const FAVORITES_KEY = "pawview.historyFavorites.v1";
const ACTIVITY_PREFIX = "pawview.dogMotionDaily.v3.";
  let working = false;

  function setWorking(value) {
    working = value;
    backupButton.disabled = value;
    restoreButton.disabled = value;
  }

  function validBirthday(value) {
    if (value === "") return true;
    if (typeof value !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(value + "T00:00:00Z");
    const now = new Date();

    const today =
      now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");

    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= "0001-01-01" &&
      value <= today
    );
  }

  function validProfile(profile) {
    return profile === null || (
      typeof profile === "object" &&
      !Array.isArray(profile) &&
      typeof profile.name === "string" &&
      profile.name.trim().length > 0 &&
      profile.name.length <= 30 &&
      typeof profile.breed === "string" &&
      profile.breed.length <= 60 &&
      typeof profile.birthday === "string" &&
      validBirthday(profile.birthday) &&
      (
        profile.weight === null ||
        (
          typeof profile.weight === "number" &&
          Number.isFinite(profile.weight) &&
          profile.weight >= 0.1 &&
          profile.weight <= 150
        )
      ) &&
      (
        profile.gender === undefined ||
        ["", "male", "female", "unknown"].includes(profile.gender)
      ) &&
      (
        profile.activityHabits === undefined ||
        (
          typeof profile.activityHabits === "string" &&
          profile.activityHabits.length <= 500
        )
      ) &&
      (
        profile.dietHabits === undefined ||
        (
          typeof profile.dietHabits === "string" &&
          profile.dietHabits.length <= 500
        )
      ) &&
      (
        profile.specialNotes === undefined ||
        (
          typeof profile.specialNotes === "string" &&
          profile.specialNotes.length <= 500
        )
      ) &&
      (
        profile.photo === undefined ||
        (
          typeof profile.photo === "string" &&
          profile.photo.length <= 1500000 &&
          (
            profile.photo === "" ||
            /^data:image\/(jpeg|png|webp);base64,/u.test(profile.photo)
          )
        )
      )
    );
  }

function validDogCollection(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.dogs) ||
    value.dogs.length < 1 ||
    value.dogs.length > 100
  ) {
    return false;
  }

  const ids = new Set();

  return value.dogs.every(profile => {
    if (
      !profile ||
      typeof profile.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(profile.id) ||
      ids.has(profile.id) ||
      !validProfile(profile)
    ) {
      return false;
    }

    ids.add(profile.id);
    return true;
  });
}
  function normalizeProfile(profile) {
    return {
      name: profile.name,
      breed: profile.breed ?? "",
      birthday: profile.birthday ?? "",
      weight: profile.weight ?? null,
      gender: profile.gender ?? "",
      activityHabits: profile.activityHabits ?? "",
      dietHabits: profile.dietHabits ?? "",
      specialNotes: profile.specialNotes ?? "",
      photo: profile.photo ?? ""
    };
  }

function validCareRecords(records) {
  if (!Array.isArray(records)) return false;

  const ids = new Set();

  return records.every(record => {
    if (
      !record ||
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      ids.has(record.id) ||
      !["dog", "cat"].includes(record.pet) ||
      !["food", "water", "walk", "note"].includes(record.type) ||
      typeof record.note !== "string" ||
      record.note.length > 500 ||
      typeof record.time !== "string" ||
      !Number.isFinite(Date.parse(record.time)) ||
      !(
        record.amount === null ||
        (
          typeof record.amount === "number" &&
          Number.isFinite(record.amount) &&
          record.amount > 0 &&
          record.amount <= 100000
        )
      ) ||
      (record.type === "note" && record.amount !== null) ||
      (
        record.dogId !== undefined &&
        record.dogId !== null &&
        (
          typeof record.dogId !== "string" ||
          record.dogId.length === 0 ||
          record.dogId.length > 200
        )
      )
    ) {
      return false;
    }

    ids.add(record.id);
    return true;
  });
}


function validAnalysisRecords(records) {
  if (!Array.isArray(records) || records.length > 500) {
    return false;
  }

  const ids = new Set();

  return records.every(record => {
    if (
      !record ||
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      ids.has(record.id) ||
      typeof record.time !== "string" ||
      !Number.isFinite(Date.parse(record.time)) ||
      typeof record.message !== "string" ||
      record.message.trim().length === 0 ||
      record.message.length > 1000 ||
      !["detected", "not-detected", "unavailable"].includes(record.vision) ||
      (
        record.dogId !== undefined &&
        record.dogId !== null &&
        (
          typeof record.dogId !== "string" ||
          record.dogId.length === 0 ||
          record.dogId.length > 200
        )
      )
    ) {
      return false;
    }

    ids.add(record.id);
    return true;
  });
}


  function readStored(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  }

function getCurrentDogCollection() {
  const saved = readStored(PROFILES_KEY, null);

  if (saved !== null) {
    if (!validDogCollection(saved)) {
      throw new Error("多狗档案数据格式不正确");
    }

    return saved;
  }

  const legacy = readStored(PROFILE_KEY, null);

  if (legacy === null) {
    return {
      version: 1,
      dogs: [{
        id: "dog-default",
        name: "두두",
        breed: "",
        birthday: "",
        weight: null,
        gender: "",
        activityHabits: "",
        dietHabits: "",
        specialNotes: "",
        photo: ""
      }]
    };
  }

  if (!validProfile(legacy)) {
    throw new Error("旧狗狗资料格式不正确");
  }

  return {
    version: 1,
    dogs: [{
      id: "dog-default",
      ...normalizeProfile(legacy)
    }]
  };
}

  function getCurrentDogId(profiles) {
    const savedId = localStorage.getItem(CURRENT_DOG_KEY);

    if (profiles.some(profile => profile.id === savedId)) {
      return savedId;
    }

    if (profiles.some(profile => profile.id === "dog-default")) {
      return "dog-default";
    }

    return profiles[0].id;
  }

  backupButton.addEventListener("click", async () => {
    if (working) return;

    setWorking(true);

    let url = null;
    let link = null;

    try {
      const dogCollection = getCurrentDogCollection();
const dogProfiles = dogCollection.dogs;
      const currentDogId = getCurrentDogId(dogProfiles);
      const careRecords = readStored(CARE_KEY, []);
      const analysisEvents = readStored(ANALYSIS_KEY, []);
const aiHistory = readStored(AI_KEY, []);
const mediaHistory = readStored(MEDIA_KEY, []);
const favorites = readStored(FAVORITES_KEY, []);

const activityRecords = {};

for (const dog of dogProfiles) {
  const key = ACTIVITY_PREFIX + dog.id;
  const raw = localStorage.getItem(key);

  if (raw !== null) {
    activityRecords[dog.id] = JSON.parse(raw);
  }
}

if (
  !Array.isArray(aiHistory) ||
  !Array.isArray(mediaHistory) ||
  !Array.isArray(favorites) ||
  !Object.entries(activityRecords).every(([dogId, value]) =>
    value &&
    value.version === 3 &&
    value.dogId === dogId &&
    Array.isArray(value.days)
  )
) {
  throw new Error("历史记录备份数据格式不正确");
}
      if (
        !validDogCollection(dogCollection) ||
        !validCareRecords(careRecords) ||
        !validAnalysisRecords(analysisEvents)
      ) {
        throw new Error("本地保存的数据格式不正确");
      }

      if (
        dogProfiles.length === 0 &&
        careRecords.length === 0 &&
        analysisEvents.length === 0
      ) {
        showToast("백업할 저장 데이터가 없습니다.");
        return;
      }

      const selectedProfile = dogProfiles.find(
        profile => profile.id === currentDogId
      );

      const legacyProfile = { ...selectedProfile };
      delete legacyProfile.id;

const backup = {
  app: "PawView",
  version: 4,
  exportedAt: new Date().toISOString(),
  currentDogId,
  dogProfiles: dogCollection,
  dogProfile: legacyProfile,
  careRecords,
  analysisEvents,
  aiHistory,
  mediaHistory,
  favorites,
  activityRecords,
  mediaFilesIncluded: false
};

      const text = JSON.stringify(backup, null, 2);

      const blob = new Blob(
        [text],
        { type: "application/json;charset=utf-8" }
      );

      if (blob.size > 10 * 1024 * 1024) {
        throw new Error("备份超过当前支持的 10 MB 限制");
      }

      const fileName =
        "PawView-backup-" + Date.now() + ".json";

      const cap = window.Capacitor;

      if (cap?.getPlatform?.() === "android") {
        const Filesystem = cap.Plugins?.Filesystem;
        const Share = cap.Plugins?.Share;

        if (!Filesystem || !Share) {
          throw new Error("文件或分享插件不可用");
        }

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: text,
          directory: "CACHE",
          encoding: "utf8"
        });

        await Share.share({
          title: "PawView 데이터 백업",
          files: [savedFile.uri],
          dialogTitle: "백업 파일 저장 또는 공유"
        });

        showToast(
          "선택한 앱에서 백업 파일의 저장 여부를 확인해 주세요."
        );
        return;
      }

      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      showToast(
        "백업 파일 다운로드를 요청했습니다. 다운로드 목록을 확인해 주세요."
      );

    } catch (error) {
      console.error("备份导出未完成：", error);

      showToast(
        "백업 내보내기를 완료하지 못했습니다. 기존 데이터는 변경하지 않았습니다."
      );

    } finally {
      link?.remove();

      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      }

      setWorking(false);
    }
  });

restoreButton.addEventListener("click", () => {
  if (working) return;

  const uid = window.PawViewFirebaseUser?.uid;
  const ownerUid = localStorage.getItem(
    "pawview.localPetOwnerUid.v1"
  );

  if (!uid || !ownerUid || uid !== ownerUid) {
    showToast(
      "현재 계정과 로컬 데이터 소유자가 일치하지 않아 복원할 수 없습니다."
    );
    return;
  }

  fileInput.value = "";
  fileInput.click();
});
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file || working) return;

    setWorking(true);

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("备份文件超过 10 MB");
      }

      const text = await file.text();
      const backup = JSON.parse(text.replace(/^\uFEFF/, ""));

      if (
        !backup ||
        backup.app !== "PawView" ||
        ![1, 2, 3, 4].includes(backup.version) ||
        !validCareRecords(backup.careRecords) ||
        (
          backup.version >= 2 &&
          !validAnalysisRecords(backup.analysisEvents)
        )
      ) {
        throw new Error("不是有效的 PawView 备份");
      }
if (backup.version === 4) {
  if (
    !Array.isArray(backup.aiHistory) ||
    !Array.isArray(backup.mediaHistory) ||
    !Array.isArray(backup.favorites) ||
    !backup.activityRecords ||
    typeof backup.activityRecords !== "object" ||
    Array.isArray(backup.activityRecords) ||
    !Object.entries(backup.activityRecords).every(
      ([dogId, value]) =>
        typeof dogId === "string" &&
        dogId.length > 0 &&
        value &&
        value.version === 3 &&
        value.dogId === dogId &&
        Array.isArray(value.days)
    )
  ) {
    throw new Error("v4 历史记录备份格式不正确");
  }
}
      let restoredProfiles;
      let restoredCurrentDogId;

if (backup.version >= 3) {
        if (
  !validDogCollection(backup.dogProfiles) ||
  typeof backup.currentDogId !== "string" ||
  !backup.dogProfiles.dogs.some(
    profile => profile.id === backup.currentDogId
  )
) {
  throw new Error("多狗档案备份数据不正确");
}

        restoredProfiles = backup.dogProfiles.dogs.map(profile => ({
  id: profile.id,
  ...normalizeProfile(profile)
}));

        restoredCurrentDogId = backup.currentDogId;

      } else {
        if (!validProfile(backup.dogProfile)) {
          throw new Error("旧版狗狗资料格式不正确");
        }

        restoredProfiles = [{
          id: "dog-default",
          ...normalizeProfile(
            backup.dogProfile || {
              name: "두두",
              breed: "",
              birthday: "",
              weight: null
            }
          )
        }];

        restoredCurrentDogId = "dog-default";
      }

      const restoredSelectedProfile = restoredProfiles.find(
        profile => profile.id === restoredCurrentDogId
      );

      const legacyProfile = { ...restoredSelectedProfile };
      delete legacyProfile.id;

      const analysisNotice = backup.version >= 2
        ? "소리 감지 기록: " +
          backup.analysisEvents.length +
          "개\n현재 소리 감지 기록도 교체됩니다.\n"
        : "이전 버전 백업입니다.\n현재 소리 감지 기록은 유지됩니다.\n";

      const confirmed = window.confirm(
        "백업 파일을 복원할까요?\n\n" +
        "강아지 프로필: " +
        restoredProfiles.length + "마리\n" +
        "현재 선택: " +
        restoredSelectedProfile.name + "\n" +
        "돌봄 기록: " +
        backup.careRecords.length + "개\n" +
        analysisNotice +
        "\n현재 강아지 프로필과 모든 돌봄 기록이 교체됩니다.\n" +
        "현재 데이터의 백업이 없다면 취소해 주세요."
      );

if (!confirmed) return;

// 恢复前再次确认账号归属
const restoreUid = window.PawViewFirebaseUser?.uid;
const restoreOwnerUid = localStorage.getItem(
  "pawview.localPetOwnerUid.v1"
);

if (
  !restoreUid ||
  !restoreOwnerUid ||
  restoreUid !== restoreOwnerUid
) {
  throw new Error(
    "Firebase 账号与本地数据所属账号不一致，已取消恢复"
  );
}

const changes = [
        {
          key: PROFILES_KEY,
value: JSON.stringify({
  version: 1,
  dogs: restoredProfiles
})
        },
        {
          key: PROFILE_KEY,
          value: JSON.stringify(legacyProfile)
        },
        {
          key: CURRENT_DOG_KEY,
          value: restoredCurrentDogId
        },
        {
          key: CARE_KEY,
          value: JSON.stringify(backup.careRecords)
        }
      ];

      if (backup.version >= 2) {
        changes.push({
          key: ANALYSIS_KEY,
          value: JSON.stringify(backup.analysisEvents)
        });
      }
if (backup.version === 4) {
  changes.push(
    {
      key: AI_KEY,
      value: JSON.stringify(backup.aiHistory)
    },
    {
      key: MEDIA_KEY,
      value: JSON.stringify(backup.mediaHistory)
    },
    {
      key: FAVORITES_KEY,
      value: JSON.stringify(backup.favorites)
    }
  );

  const existingKeys = Object.keys(localStorage)
    .filter(key => key.startsWith(ACTIVITY_PREFIX));

  const incomingKeys = Object.keys(backup.activityRecords)
    .map(dogId => ACTIVITY_PREFIX + dogId);

  const activityKeys = new Set([
    ...existingKeys,
    ...incomingKeys
  ]);

  for (const key of activityKeys) {
    const dogId = key.slice(ACTIVITY_PREFIX.length);

    changes.push({
      key,
      value: Object.hasOwn(backup.activityRecords, dogId)
        ? JSON.stringify(backup.activityRecords[dogId])
        : null
    });
  }
}
      const previousValues = changes.map(change => ({
        key: change.key,
        value: localStorage.getItem(change.key)
      }));

      try {
changes.forEach(change => {
  if (change.value === null) {
    localStorage.removeItem(change.key);
  } else {
    localStorage.setItem(change.key, change.value);
  }
});

      } catch (writeError) {
        let rollbackFailed = false;

        previousValues.forEach(previous => {
          try {
            if (previous.value === null) {
              localStorage.removeItem(previous.key);
            } else {
              localStorage.setItem(previous.key, previous.value);
            }
          } catch (rollbackError) {
            rollbackFailed = true;
            console.error("恢复原数据失败：", rollbackError);
          }
        });

        console.error("恢复写入失败：", writeError);

        showToast(
          rollbackFailed
            ? "저장 및 원상 복구에 실패했습니다. 백업 파일을 보관하고 데이터를 확인해 주세요."
            : "복원에 실패하여 이전 저장 데이터를 유지했습니다."
        );

        return;
      }

      window.location.reload();

    } catch (error) {
      console.error("备份读取或校验失败：", error);

      showToast(
        "백업 파일을 읽거나 확인하지 못했습니다. 저장 데이터는 변경하지 않았습니다."
      );

    } finally {
      fileInput.value = "";
      setWorking(false);
    }
  });
})();

// 隐私保护：进入后台后关闭本机摄像头
(() => {
function stopCameraForPrivacy() {
  if (
    !cameraStream &&
    !realCameraActive &&
    !$("connectCameraButton").disabled
  ) return;

    stopRealCamera(false);

    $("playButton").disabled = !deviceOn;
    $("playButton").style.opacity = deviceOn ? "1" : ".55";

    setCameraHint(
      "백그라운드 전환으로 카메라를 껐습니다. 사용하려면 다시 연결해 주세요."
    );
  }

  // 浏览器和 WebView 的页面可见性变化
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopCameraForPrivacy();
    }
  });

  // Android 原生 APP 生命周期
  const cap = window.Capacitor;

  if (cap?.getPlatform?.() === "android") {
    const App = cap.Plugins?.App;

    if (!App) {
      console.error("App 生命周期插件不可用");
      return;
    }

    
try {
  const listenerResult = App.addListener(
    "appStateChange",
    state => {
      if (!state.isActive) {
        stopCameraForPrivacy();
      }
    }
  );

  Promise.resolve(listenerResult).catch(error => {
    console.error("注册 APP 后台监听失败：", error);
  });
} catch (error) {
  console.error("注册 APP 后台监听失败：", error);
}

  }
})();
// 网络状态只作提示，不控制本机摄像头或麦克风
(() => {
  const status = $("cameraNetworkStatus");
  if (!status) return;

  function updateNetworkStatus(showMessage = false) {
    // 浏览器报告的联网状态，不代表服务器一定可访问
    const offline = navigator.onLine === false;

    status.textContent = offline
      ? "네트워크: 연결 끊김 · 이 기기의 카메라는 계속 사용할 수 있어요."
      : "네트워크: 오프라인으로 감지되지 않음 · 실제 인터넷 접속은 별도 확인이 필요해요.";

    if (showMessage) {
      showToast(
        offline
          ? "네트워크 연결이 끊겼습니다. 이 기기의 카메라는 계속 사용할 수 있어요."
          : "기기의 네트워크 연결 상태가 복구되었습니다."
      );
    }
  }

  window.addEventListener("offline", () => {
    updateNetworkStatus(true);
  });

  window.addEventListener("online", () => {
    updateNetworkStatus(true);
  });

  updateNetworkStatus();
})();
// 首页摘要：读取现有记录，不修改分析和存储流程。
(function setupHomeSummary() {
  const eventCount = $("homeEventCount");
  const eventNote = $("homeEventNote");
  const latestTime = $("homeLatestTime");
  const latestMessage = $("homeLatestMessage");
  const viewButton = $("homeViewEventsButton");
  const visionResult = $("dogVisionResult");

  if (!eventCount || !latestTime || !latestMessage) return;

  function isSameLocalDay(date, today) {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  function updateHomeEvents() {
    // 现有分析记录属于狗狗功能，不显示成猫咪的数据。
    if (currentPet !== "dog") {
      eventCount.textContent = "—";
      if (eventNote) {
        eventNote.textContent = "강아지 감지 기능입니다";
      }
      latestTime.textContent = "고양이 데모 화면";
      latestMessage.textContent =
        "강아지를 선택하면 저장된 감지 안내를 볼 수 있습니다.";
      return;
    }

    try {
      const raw = localStorage.getItem(
        "pawview.analysisEvents.v1"
      );

      const records = raw === null ? [] : JSON.parse(raw);

      if (!Array.isArray(records)) {
        throw new Error("Invalid analysis records");
      }

      const validRecords = records.filter(record =>
        record &&
        typeof record.time === "string" &&
        Number.isFinite(Date.parse(record.time)) &&
        typeof record.message === "string" &&
        record.message.trim().length > 0
      );
      const currentDogId = localStorage.getItem(
        "pawview.currentDogId.v1"
      );

      const currentRecords = validRecords.filter(record =>
        record.dogId === currentDogId
      );
      const today = new Date();

      const todayRecords = currentRecords.filter(record =>
        isSameLocalDay(new Date(record.time), today)
      );

      eventCount.textContent = `${todayRecords.length}건`;

      if (eventNote) {
        eventNote.textContent = "저장된 소리 감지 안내 기준";
      }

     const latest = currentRecords.reduce((newest, record) => {
        if (
          !newest ||
          Date.parse(record.time) > Date.parse(newest.time)
        ) {
          return record;
        }
        return newest;
      }, null);

      if (!latest) {
        latestTime.textContent = "저장된 기록 없음";
        latestMessage.textContent =
          "아직 저장된 감지 안내가 없습니다.";
        return;
      }

      latestTime.textContent =
        new Date(latest.time).toLocaleString("ko-KR");

      latestMessage.textContent = latest.message;
    } catch (error) {
      console.error("首页分析记录读取失败：", error);

      eventCount.textContent = "—";

      if (eventNote) {
        eventNote.textContent = "기록을 불러오지 못했습니다";
      }

      latestTime.textContent = "기록 확인 필요";
      latestMessage.textContent =
        "감지 기록을 읽지 못했습니다. 보고서 페이지에서 확인해 주세요.";
    }
  }

  function syncHomeVision() {
    const status = $("currentStatus");
    const sub = $("statusSub");

    if (!status || !sub) return;

    if (currentPet !== "dog") {
      status.textContent = "데모 화면";
      sub.textContent = "강아지 감지 기능입니다";
      return;
    }

    const result = visionResult
      ? visionResult.textContent.trim()
      : "";

    status.textContent = "화면 감지";
    sub.textContent = result || "카메라를 연결해 주세요";
  }

  if (visionResult) {
    const observer = new MutationObserver(syncHomeVision);

    observer.observe(visionResult, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (viewButton) {
    viewButton.addEventListener("click", () => {
      const reportButton = document.querySelector(
        '.nav-item[data-page="report"]'
      );

      if (reportButton) reportButton.click();
    });
  }

  function refreshHomeSummary() {
    updateHomeEvents();
    syncHomeVision();
  }


window.addEventListener("storage", refreshHomeSummary);

document.addEventListener(
  "pawview:analysis-events-updated",
  refreshHomeSummary
);

// 切换或修改狗狗档案后，刷新首页检测信息
document.addEventListener(
  "pawview:dog-profile-changed",
  refreshHomeSummary
);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshHomeSummary();
});

  // 同一页面新增或删除记录时，storage 事件不会触发，
  // 因此在前台定时同步。不会启动摄像头或麦克风。
  window.setInterval(() => {
    if (!document.hidden) refreshHomeSummary();
  }, 2000);

  refreshHomeSummary();
})();
// 首页：将快速操作和照护记录放入可展开区域。
// 只移动原有元素，不复制，不删除，保留已有事件绑定。
(function setupHomeMoreSection() {
  const home = $("page-monitor");

  if (!home || $("homeMoreSection")) return;

  const quickPanel = home.querySelector(".quick-panel");
  const carePanel = home.querySelector(".care-panel");

  if (!quickPanel || !carePanel) return;

  const details = document.createElement("details");
  details.id = "homeMoreSection";
  details.className = "home-more-section";

  const summary = document.createElement("summary");
  summary.textContent = "돌봄 기록 및 추가 기능";

  const body = document.createElement("div");
  body.className = "home-more-body";

  details.append(summary, body);
  home.appendChild(details);

  body.append(quickPanel, carePanel);
})();
// 手动录像：同时录制摄像头画面和麦克风声音。
(function setupCameraRecording() {
  const button = $("recordCameraButton");
  const status = $("recordCameraStatus");
  const video = $("cameraVideo");

  if (!button || !status || !video) return;

  let recorder = null;
  let sourceStream = null;
  let recordingStream = null;
  let chunks = [];
  let startedAt = 0;
  let stopping = false;
  let recordingFailed = false;
let recordingMicStream = null;
let requestingMic = false;
let cancelMicRequest = false;
let savingRecording = false;
// Explicit state used by camera mode switching; protects permission and save phases.
window.PawViewRecording = {
  isBusy: () => requestingMic || Boolean(recorder) || stopping || savingRecording,
  stop: (releaseMicrophone = false) => {
    if (requestingMic) cancelMicRequest = true;
    if (recorder && !stopping) stopRecording();
    // 隐私模式/断线时即时停止录音，stop 事件仍负责最终清理。
    if (releaseMicrophone) {
      recordingMicStream?.getTracks().forEach(track => track.stop());
    }
  }
};

// 固定本次录像开始时的宠物身份
let recordingPet = null;
let recordingDogId = null;

  function getLiveVideoTrack() {
    const stream = video.srcObject;

    if (!stream || typeof stream.getVideoTracks !== "function") {
      return null;
    }

    return stream.getVideoTracks().find(
      track => track.readyState === "live"
    ) || null;
  }

  function stopRecording() {
    if (
      !recorder ||
      recorder.state === "inactive" ||
      stopping
    ) return;

    stopping = true;
button.disabled = true;
button.textContent = "저장 준비 중…";

status.classList.remove("is-recording");
status.textContent = "녹화 종료 · 파일 준비 중…";


    recorder.stop();
  }

  function updateRecordingUI() {

    if (requestingMic) {
  button.disabled = true;
  return;
}

    const supported = typeof MediaRecorder !== "undefined";

    if (!supported) {
      button.disabled = true;
      status.textContent =
        "이 브라우저는 녹화를 지원하지 않습니다.";
      return;
    }

    if (recorder) {
      if (stopping) return;

      const elapsed = Math.floor(
        (performance.now() - startedAt) / 1000
      );

      status.textContent =
        `녹화 중 ${elapsed}초 / 60초 · 소리 포함`;

      const originalTrack = sourceStream
        ? sourceStream.getVideoTracks()[0]
        : null;

      if (
        elapsed >= 60 ||
        document.hidden ||
        video.srcObject !== sourceStream ||
        !originalTrack ||
        originalTrack.readyState !== "live"
      ) {
        stopRecording();
      }

      return;
    }

    button.disabled = !getLiveVideoTrack();
  }

  button.addEventListener("click", async () => {

    if (recorder) {
      stopRecording();
      return;
    }
if (window.PawViewSoundMonitor?.isRequesting()) {
  showToast("마이크 연결이 완료된 뒤 녹화해 주세요.");
  return;
}
    const sourceTrack = getLiveVideoTrack();

    if (!sourceTrack || document.hidden) {
      showToast("먼저 카메라를 연결해 주세요.");
      return;
    }
    // 在申请麦克风权限之前固定身份
    recordingPet = currentPet;
    recordingDogId = recordingPet === "dog"
      ? localStorage.getItem("pawview.currentDogId.v1")
      : null;
    try {
      sourceStream = video.srcObject;
cancelMicRequest = false;
requestingMic = true;
button.disabled = true;
status.textContent = "마이크 권한 확인 중…";

const sharedMic =
  window.PawViewSoundMonitor?.cloneForRecording();

recordingMicStream = sharedMic ||
  await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
if (document.hidden || cancelMicRequest || guardianAtHome ||
    document.querySelector(".camera-panel")?.classList.contains("pi-mode")) {
  throw new Error("Recording cancelled by privacy/mode/background");
}

// 权限弹窗期间可能切后台或断开摄像头，需再次检查。
if (
  document.hidden || guardianAtHome ||
  document.querySelector(".camera-panel")?.classList.contains("pi-mode") ||
  video.srcObject !== sourceStream ||
  sourceTrack.readyState !== "live"
) {
  throw new Error("Camera unavailable after microphone permission");
}

if (
  !recordingMicStream.getAudioTracks().some(
    track => track.readyState === "live"
  )
) {
  throw new Error("No live microphone track");
}

recordingStream = new MediaStream([
  sourceTrack.clone(),
  ...recordingMicStream.getAudioTracks()
]);

requestingMic = false;


const mimeType = [
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4"
].find(type => MediaRecorder.isTypeSupported(type));


      recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);

      chunks = [];
      stopping = false;
      recordingFailed = false;

      recorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      recorder.addEventListener("error", event => {
        recordingFailed = true;
        console.error("录像失败：", event);
        status.textContent = "녹화 오류 · 파일 확인 필요";
        showToast("녹화 중 오류가 발생했습니다.");
        stopRecording();
      });

     recorder.addEventListener("stop", async () => {
  savingRecording = true;
  let downloadUrl = null;
  let link = null;

  try {
    if (recordingFailed) {
      throw new Error("Recording failed");
    }

    if (chunks.length === 0) {
      throw new Error("No recorded data");
    }

    const type =
      recorder.mimeType ||
      chunks[0].type ||
      "video/webm";

    const blob = new Blob(chunks, { type });

    const extension = type.includes("mp4")
      ? "mp4"
      : "webm";

    const timestamp = Date.now();

    const fileName =
      "PawView_" +
      new Date(timestamp).toISOString().replace(/[:.]/g, "-") +
      "." + extension;

    const cap = window.Capacitor;

    // Android：保存到系统 PawView 相册
    if (cap?.getPlatform?.() === "android") {
      const Media = window.PawViewMedia;

      if (!Media) {
        throw new Error("PawView 相册插件尚未加载");
      }



      // Blob 转为 Base64 Data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(
          new Error("视频数据读取失败")
        );

        reader.readAsDataURL(blob);
      });

      // 保存到手机系统相册
const albumIdentifier = await ensurePawViewAlbum(Media);

      // 修复 Android Media 插件对 codecs 中逗号的错误解析
      // 将带 codecs 参数的 Data URL 转为标准视频 Data URL
      const base64Video = dataUrl.slice(
        dataUrl.lastIndexOf(",") + 1
      );

      const safeVideoDataUrl =
        `data:${extension === "mp4" ? "video/mp4" : "video/webm"};base64,${base64Video}`;

const saved = await Media.saveVideo({
  path: safeVideoDataUrl,
  albumIdentifier: albumIdentifier,
  fileName: fileName.replace(/\.[^.]+$/, "")
});
      // 保存历史索引，不重复保存视频文件
      const historyKey = "pawview.mediaHistory.v1";

      const history = JSON.parse(
        localStorage.getItem(historyKey) || "[]"
      );
history.unshift({
  id: "video-" + timestamp,
  type: "video",
  name: fileName,
  filePath: saved.filePath || "",
  createdAt: new Date(timestamp).toISOString(),
  favorite: false,
  pet: recordingPet,
  dogId: recordingDogId
});
      localStorage.setItem(
        historyKey,
        JSON.stringify(history.slice(0, 500))
      );

      status.textContent = "녹화 종료 · PawView 앨범 저장 완료";
      showToast("동영상이 PawView 앨범에 저장되었습니다.");

    } else {
      // 浏览器：保留原来的下载功能
      downloadUrl = URL.createObjectURL(blob);

      link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      status.textContent = "녹화 종료 · 다운로드 확인";
      showToast("녹화 파일 다운로드를 요청했습니다.");
    }

  } catch (error) {
    console.error("录像保存失败：", error);

    status.textContent = "녹화 파일 저장 실패";
    showToast("녹화 파일을 저장하지 못했습니다.");

  } finally {
    link?.remove();

    if (downloadUrl) {
      const urlToRelease = downloadUrl;

      setTimeout(
        () => URL.revokeObjectURL(urlToRelease),
        60000
      );
    }

    // 关闭录像流中的视频副本和录音轨道
    // 不关闭摄像头预览
    recordingStream?.getTracks().forEach(
      track => track.stop()
    );

    recordingMicStream?.getTracks().forEach(
      track => track.stop()
    );

recordingMicStream = null;
recordingPet = null;
recordingDogId = null;
savingRecording = false;
requestingMic = false;
cancelMicRequest = false;
recorder = null;
sourceStream = null;
recordingStream = null;
chunks = [];
stopping = false;

    button.textContent = "● 녹화 시작";
    button.classList.remove("is-recording");
    button.setAttribute(
      "aria-label",
      "소리 포함 녹화 시작"
    );

    status.classList.remove("is-recording");

    updateRecordingUI();
  }
});

      recorder.start(1000);
      startedAt = performance.now();
button.classList.add("is-recording");
button.setAttribute("aria-label", "녹화 종료");

status.classList.add("is-recording");

      button.textContent = "■ 녹화 종료";
      button.disabled = false;
  status.textContent = "녹화 중 0초 / 60초 · 소리 포함";
    } catch (error) {
  console.error("无法开始录像：", error);

  recordingStream?.getTracks().forEach(
    track => track.stop()
  );

  recordingMicStream?.getTracks().forEach(
    track => track.stop()
  );

  recorder = null;
  sourceStream = null;
  recordingStream = null;
  recordingMicStream = null;
  recordingPet = null;
  recordingDogId = null;
  chunks = [];
  requestingMic = false;
  cancelMicRequest = false;
  stopping = false;
  button.textContent = "● 녹화 시작";
  button.classList.remove("is-recording");
  button.setAttribute("aria-label", "소리 포함 녹화 시작");
  status.classList.remove("is-recording");

  const message =
    error.name === "NotAllowedError"
      ? "마이크 권한을 허용한 뒤 다시 녹화해 주세요."
      : error.name === "NotFoundError"
        ? "사용 가능한 마이크를 찾을 수 없습니다."
        : error.name === "NotReadableError"
          ? "마이크를 사용할 수 없습니다. 다른 프로그램의 사용 상태를 확인해 주세요."
          : "녹화를 시작하지 못했습니다. 카메라와 마이크를 확인해 주세요.";

  status.textContent = message;
  showToast(message);

  updateRecordingUI();
}

  });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;

  if (requestingMic) {
    cancelMicRequest = true;
    status.textContent = "백그라운드 전환 · 녹화 취소";
    return;
  }

  stopRecording();
});
// 点击断开时，先结束录像，再由原有代码关闭摄像头。
$("stopCameraButton")?.addEventListener(
  "click",
  () => {
    if (requestingMic) {
      cancelMicRequest = true;
      status.textContent = "카메라 연결 해제 · 녹화 취소";
      return;
    }

    stopRecording();
  },
  { capture: true }
);

window.setInterval(updateRecordingUI, 500);
updateRecordingUI();
})();
// 报告页：今日检测提醒、最近7天手动饮食记录。
// 只读本地数据，不修改记录。
(function setupReportSavedData() {
  const countElement = $("alertStat");
  const intakeContainer = $("reportIntakeTable");

  if (!countElement || !intakeContainer) return;

  let previousView = "";
const rangeSelect = $("reportIntakeRange");
let intakeDays = 7;

  function readRecords(key) {
    const raw = localStorage.getItem(key);
    const records = raw === null ? [] : JSON.parse(raw);

    if (!Array.isArray(records)) {
      throw new Error("Invalid records: " + key);
    }

    return records;
  }

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validTime(record) {
    return (
      record &&
      typeof record.time === "string" &&
      Number.isFinite(Date.parse(record.time))
    );
  }

  function formatAmount(total, count, unit) {
    if (count === 0) return "미기록";

    return total.toLocaleString("ko-KR", {
      maximumFractionDigits: 2
    }) + " " + unit;
  }

  function renderIntakeTable(rows) {
    const signature = JSON.stringify(rows);

    // 数据没变化时，不重复重建表格。
    if (signature === previousView) return;
    previousView = signature;

    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent =
  `최근 ${intakeDays}일 직접 입력한 식사량과 음수량`;

    table.appendChild(caption);

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    ["날짜", "식사 기록량", "음수 기록량"].forEach(label => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      header.appendChild(cell);
    });

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach(row => {
      const tr = document.createElement("tr");

      [row.date, row.food, row.water].forEach((value, index) => {
        const cell = document.createElement(
          index === 0 ? "th" : "td"
        );

        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tr.appendChild(cell);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    intakeContainer.replaceChildren(table);
  }
function updateIntakeSummary(summary) {
  const foodTotal = $("reportFoodTotal");
  const waterTotal = $("reportWaterTotal");
  const foodDays = $("reportFoodDays");
  const waterDays = $("reportWaterDays");

  if (!foodTotal || !waterTotal || !foodDays || !waterDays) {
    return;
  }

  if (!summary) {
    foodTotal.textContent = "—";
    waterTotal.textContent = "—";
    foodDays.textContent = "집계할 수 없습니다";
    waterDays.textContent = "집계할 수 없습니다";
    return;
  }

  foodTotal.textContent = formatAmount(
    summary.foodTotal,
    summary.foodDays,
    "g"
  );

  waterTotal.textContent = formatAmount(
    summary.waterTotal,
    summary.waterDays,
    "ml"
  );

  foodDays.textContent =
    `${intakeDays}일 중 수량 기록 ${summary.foodDays}일`;

  waterDays.textContent =
    `${intakeDays}일 중 수량 기록 ${summary.waterDays}일`;
}

  function refreshReportData() {
    if (currentPet !== "dog") {
  countElement.textContent = "—";
  updateIntakeSummary(null);

      const message = "강아지를 선택하면 기록을 확인할 수 있습니다.";

      if (previousView !== "cat") {
        intakeContainer.textContent = message;
        previousView = "cat";
      }

      return;
    }
const currentDogId = localStorage.getItem(
  "pawview.currentDogId.v1"
);

if (!currentDogId) {
  console.warn("报告页面无法获取当前狗狗 ID。");
  return;
}
    const today = new Date();
    const todayKey = dateKey(today);

    // 检测提醒和照护记录分别读取：
    // 一类数据读取失败，不影响另一类。
    try {
      const events = readRecords("pawview.analysisEvents.v1");

const count = events.filter(record =>
  validTime(record) &&
  record.dogId === currentDogId &&
  typeof record.message === "string" &&
  record.message.trim().length > 0 &&
  dateKey(new Date(record.time)) === todayKey
).length;

      countElement.textContent = `${count}건`;
    } catch (error) {
      console.error("报告页检测记录读取失败：", error);
      countElement.textContent = "읽기 오류";
    }

    try {
      const records = readRecords("pawview.careRecords.v1");

      const rows = [];
const summary = {
  foodTotal: 0,
  waterTotal: 0,
  foodDays: 0,
  waterDays: 0
};

      // 按所选范围生成本地日期，缺失记录不补成0。
for (
  let offset = intakeDays - 1;
  offset >= 0;
  offset -= 1
) {

        const day = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - offset
        );

        const key = dateKey(day);

        let foodTotal = 0;
        let waterTotal = 0;
        let foodCount = 0;
        let waterCount = 0;

        records.forEach(record => {
          if (
!validTime(record) ||
record.pet !== "dog" ||
record.dogId !== currentDogId ||
            dateKey(new Date(record.time)) !== key ||
            typeof record.amount !== "number" ||
            !Number.isFinite(record.amount) ||
            record.amount <= 0
          ) {
            return;
          }

          if (record.type === "food") {
            foodTotal += record.amount;
            foodCount += 1;
          }

          if (record.type === "water") {
            waterTotal += record.amount;
            waterCount += 1;
          }
        });
summary.foodTotal += foodTotal;
summary.waterTotal += waterTotal;

if (foodCount > 0) summary.foodDays += 1;
if (waterCount > 0) summary.waterDays += 1;

        rows.push({
          date: key,

          food: formatAmount(foodTotal, foodCount, "g"),
          water: formatAmount(waterTotal, waterCount, "ml")
        });
      }

      renderIntakeTable(rows);
      updateIntakeSummary(summary);

    } catch (error) {
      console.error("报告页饮食记录读取失败：", error);
      updateIntakeSummary(null);

      intakeContainer.textContent =
        "기록을 읽지 못했습니다. 저장된 데이터는 변경하지 않았습니다.";
      previousView = "";
    }
  }
if (rangeSelect) {rangeSelect.addEventListener("change", () => {
    intakeDays = rangeSelect.value === "30" ? 30 : 7;

    // 强制更新表格及标题。
    previousView = "";
    refreshReportData();
  });
}

  window.addEventListener("storage", refreshReportData);
  document.addEventListener(
  "pawview:analysis-events-updated",
  refreshReportData
);
document.addEventListener(
  "pawview:dog-profile-changed",
  () => {
    refreshReportData();
  }
);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshReportData();
  });

  // 切换到报告页时立即更新。
  const reportPage = $("page-report");

  if (reportPage) {
    const observer = new MutationObserver(() => {
      if (reportPage.classList.contains("active")) {
        refreshReportData();
      }
    });

    observer.observe(reportPage, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  window.setInterval(() => {
    if (
      !document.hidden &&
      reportPage?.classList.contains("active")
    ) {
      refreshReportData();
    }
  }, 2000);

  refreshReportData();
})();
// 导出报告页当前显示的饮食统计，不改变原始数据。
(function setupReportIntakeExport() {
  const button = $("exportReportIntakeButton");

  if (!button) return;

  function csvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  button.addEventListener("click", () => {
    if (currentPet !== "dog") {
      showToast("강아지를 선택해 주세요.");
      return;
    }

    const table = document.querySelector(
      "#reportIntakeTable table"
    );

    if (!table || !table.tBodies[0]?.rows.length) {
      showToast("내보낼 통계가 없습니다.");
      return;
    }

    let url = null;
    let link = null;

    try {
      const selectedDays =
        $("reportIntakeRange")?.value === "30" ? 30 : 7;

      const rows = [
        ["PawView 식사·음수 기록 통계"],
        ["데이터 출처", "직접 입력한 돌봄 기록"],
        ["조회 기간", `최근 ${selectedDays}일`],
        ["안내", "미기록은 0이 아니며 실제 섭취량 측정값이 아닙니다."],
        []
      ];

      // 导出当前实际显示的表格，保留"未记录"状态。
      for (const row of table.rows) {
        rows.push(
          Array.from(row.cells, cell => cell.textContent.trim())
        );
      }

      const csv = "\uFEFF" + rows
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
      });

      const now = new Date();

      const filenameDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
      ].join("-");

      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download =
        `PawView_intake_${selectedDays}days_${filenameDate}.csv`;

      document.body.appendChild(link);
      link.click();

      showToast("CSV 다운로드를 요청했습니다.");
    } catch (error) {
      console.error("报告统计导出失败：", error);
      showToast("CSV 파일을 내보내지 못했습니다.");
    } finally {
      link?.remove();

      if (url) {
        const downloadUrl = url;

        setTimeout(
          () => URL.revokeObjectURL(downloadUrl),
          60000
        );
      }
    }
  });
})();

/* ==============================
   PawView 장치 관리 상태 연동
============================== */
(() => {
  const $ = id => document.getElementById(id);

  const cameraStatus = $("managementCameraStatus");
  const micStatus = $("managementMicStatus");
  const wifiStatus = $("managementWifiStatus");
  const batteryStatus = $("managementBatteryStatus");

  const cameraIndicator = $("managementCameraIndicator");
  const micIndicator = $("managementMicIndicator");
  const wifiIndicator = $("managementWifiIndicator");

  const errorBox = $("managementDeviceError");

  if (!cameraStatus || !micStatus) return;

  let microphoneActive = false;
  let batteryManager = null;

  function setDeviceStatus(element, indicator, message, state) {
    if (element) element.textContent = message;

    if (indicator) {
      indicator.classList.remove("online", "offline", "warning");

      if (state) {
        indicator.classList.add(state);
      }
    }
  }
// 统一管理设备异常，避免不同设备的提示互相覆盖
const deviceIssues = new Map();

function setDeviceIssue(key, title, message) {
  deviceIssues.set(key, { title, message });
  renderDeviceIssues();
}

function clearDeviceIssue(key) {
  deviceIssues.delete(key);
  renderDeviceIssues();
}

function renderDeviceIssues() {
  if (!errorBox) return;

  errorBox.innerHTML = "";

  const issues = Array.from(deviceIssues.values());

  if (issues.length === 0) {
    const strong = document.createElement("strong");
    strong.textContent = "장치 상태 확인 완료";

    const paragraph = document.createElement("p");
    paragraph.textContent = "현재 등록된 장치 오류가 없습니다.";

    errorBox.append(strong, paragraph);
    return;
  }

  const strong = document.createElement("strong");
  strong.textContent = `장치 이상 ${issues.length}건`;

  const list = document.createElement("ul");

  issues.forEach(issue => {
    const item = document.createElement("li");
    item.textContent = `${issue.title}: ${issue.message}`;
    list.appendChild(item);
  });

  errorBox.append(strong, list);
}
// 提供给设备管理区域外部调用
window.pawviewSetDeviceIssue = setDeviceIssue;
window.pawviewClearDeviceIssue = clearDeviceIssue;
// 摄像头状态
function updateCameraStatus() {
  const active =
    realCameraActive &&
    cameraStream !== null &&
    cameraStream.getVideoTracks().some(
      track => track.readyState === "live"
    );

  setDeviceStatus(
    cameraStatus,
    cameraIndicator,
    active ? "실제 카메라 연결됨" : "카메라 연결 안 됨",
    active ? "online" : "offline"
  );

  // 摄像头恢复正常时，只清除摄像头自己的异常
  if (active) {
    window.pawviewClearDeviceIssue?.("camera");
  }
}
  // 麦克风状态
  function updateMicStatus() {
    setDeviceStatus(
      micStatus,
      micIndicator,
      microphoneActive ? "마이크 사용 중" : "마이크 꺼짐",
      microphoneActive ? "online" : "offline"
    );
    // 마이크가 정상 작동하면 이전 마이크 오류 초기화
// 마이크가 정상 작동하면 마이크 오류만 제거
if (microphoneActive) {
  clearDeviceIssue("microphone");
}
  }

  document.addEventListener("pawview:mic-start", () => {
    microphoneActive = true;
    updateMicStatus();
  });

  document.addEventListener("pawview:mic-stop", () => {
    microphoneActive = false;
    updateMicStatus();
  });
// 麦克风异常接入统一设备错误管理
document.addEventListener("pawview:mic-error", event => {
  const message =
    event.detail?.message ||
    "마이크 연결에 문제가 발생했습니다.";

  setDeviceIssue(
    "microphone",
    "마이크 연결 오류",
    message
  );
});
// 网络及 Wi-Fi 状态
function updateWifiStatus() {
 // 网络恢复后，只清除网络自己的异常
if (navigator.onLine) {
  clearDeviceIssue("network");
}
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

if (!navigator.onLine) {
  setDeviceStatus(
    wifiStatus,
    wifiIndicator,
    "네트워크 연결 끊김",
    "offline"
  );

  setDeviceIssue(
    "network",
    "네트워크 연결 오류",
    "인터넷 연결 상태를 확인해 주세요."
  );

  return;
}

  const type = connection?.type;
  const effectiveType = connection?.effectiveType;

  if (type === "wifi") {
    setDeviceStatus(
      wifiStatus,
      wifiIndicator,
      "Wi-Fi 연결됨",
      "online"
    );
    return;
  }

  if (type === "cellular") {
    setDeviceStatus(
      wifiStatus,
      wifiIndicator,
      "모바일 데이터 연결됨",
      "warning"
    );
    return;
  }

  if (type === "none") {
    setDeviceStatus(
      wifiStatus,
      wifiIndicator,
      "네트워크 연결 끊김",
      "offline"
    );
    return;
  }

  setDeviceStatus(
    wifiStatus,
    wifiIndicator,
    effectiveType
      ? `네트워크 연결됨 · ${effectiveType.toUpperCase()}`
      : "네트워크 연결됨 · 연결 유형 확인 불가",
    "warning"
  );
}
  window.addEventListener("online", updateWifiStatus);
  window.addEventListener("offline", updateWifiStatus);

  const networkConnection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  networkConnection?.addEventListener?.(
    "change",
    updateWifiStatus
  );

// 手机电量状态
function updateBatteryStatus() {
  if (!batteryManager || !batteryStatus) return;

  const percentage = Math.round(
    batteryManager.level * 100
  );

  const charging = batteryManager.charging
    ? "충전 중"
    : "충전 중 아님";

  batteryStatus.textContent =
    `${percentage}% · ${charging}`;

 // 低电量异常接入统一设备错误管理
if (percentage <= 20 && !batteryManager.charging) {
  batteryStatus.textContent += " · 배터리 부족";

  setDeviceIssue(
    "battery",
    "배터리 잔량 부족",
    `현재 배터리 잔량은 ${percentage}%입니다. 충전해 주세요.`
  );

  return;
}
// 电量恢复后，只清除电池自己的异常
clearDeviceIssue("battery");
}

// 电池信息初始化
async function initializeBattery() {
  if (!navigator.getBattery || !batteryStatus) {
    if (batteryStatus) {
      batteryStatus.textContent =
        "이 기기에서 배터리 정보를 지원하지 않습니다.";
    }
    return;
  }

  try {
    batteryManager = await navigator.getBattery();

    updateBatteryStatus();

    batteryManager.addEventListener(
      "levelchange",
      updateBatteryStatus
    );

    batteryManager.addEventListener(
      "chargingchange",
      updateBatteryStatus
    );

  } catch (error) {
    console.error("배터리 정보 확인 실패:", error);

    batteryStatus.textContent =
      "배터리 정보를 가져오지 못했습니다.";
  }
}

  // 카메라 연결 버튼 감시
  $("connectCameraButton")?.addEventListener(
    "click",
    () => {
      setDeviceStatus(
        cameraStatus,
        cameraIndicator,
        "카메라 연결 중...",
        "warning"
      );

      window.setTimeout(updateCameraStatus, 1000);
    }
  );

  $("stopCameraButton")?.addEventListener(
    "click",
    () => {
      window.setTimeout(updateCameraStatus, 300);
    }
  );
// 장치 다시 연결 버튼
// 장치 다시 연결 버튼
$("managementReconnectButton")?.addEventListener(
  "click",
  async () => {
    const reconnectButton = $("managementReconnectButton");

    const smartStatus = $("managementSmartStatus");
    const temperatureStatus = $("managementTemperatureStatus");

    reconnectButton.disabled = true;
    reconnectButton.textContent = "↻ 장치 상태 확인 중...";

    try {
      // 1. 摄像头连接检查
      if (cameraStream && realCameraActive) {
        updateCameraStatus();
      } else if (typeof connectRealCamera === "function") {
       // 摄像头重新连接状态也接入统一管理
setDeviceIssue(
  "camera",
  "카메라 재연결 시도 중",
  "카메라 권한과 연결 상태를 확인하고 있습니다."
);
        reconnectButton.textContent = "↻ 카메라 연결 중...";
        await connectRealCamera();
        updateCameraStatus();
      }

      // 2. 麦克风状态检查
      updateMicStatus();

      // 3. 网络状态检查
      updateWifiStatus();

      // 4. 智能设备状态
if (smartStatus) {
  smartStatus.textContent = "외부 스마트 기기 미등록";
}

const smartIndicator = $("managementSmartIndicator");

if (smartIndicator) {
  smartIndicator.classList.remove(
    "online",
    "warning",
    "offline"
  );
  smartIndicator.classList.add("offline");
}

      // 5. 手机温度状态
      if (temperatureStatus) {
        temperatureStatus.textContent = "기기 온도 연동 전";
      }

// 6. 汇总设备状态
const cameraConnected = Boolean(
  cameraStream &&
  realCameraActive &&
  cameraStream.getVideoTracks().some(
    track => track.readyState === "live"
  )
);

const batteryLow = Boolean(
  batteryManager &&
  Math.round(batteryManager.level * 100) <= 20 &&
  !batteryManager.charging
);

// 根据实际状态更新各设备异常
if (cameraConnected) {
  clearDeviceIssue("camera");
}

if (microphoneActive) {
  clearDeviceIssue("microphone");
}

if (navigator.onLine) {
  clearDeviceIssue("network");
}

if (!batteryLow) {
  clearDeviceIssue("battery");
}

showToast("장치 상태 확인이 완료되었습니다.");
    } catch (error) {
  console.error("장치 상태 확인 실패:", error);

  // 기존 장치별 오류 목록은 유지
  renderDeviceIssues();

  showToast("장치 상태 확인 중 문제가 발생했습니다.");
}finally {
      updateCameraStatus();
      updateMicStatus();
      updateWifiStatus();

      reconnectButton.disabled = false;
      reconnectButton.textContent = "↻ 장치 다시 연결";
    }
  }
);
  // 화면 복귀 시 상태 갱신
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateCameraStatus();
      updateMicStatus();
      updateWifiStatus();
      updateBatteryStatus();
    }
  });

  // 초기 상태
  updateCameraStatus();
  updateMicStatus();
  updateWifiStatus();
  initializeBattery();
  // 外部 스마트 기기 및 온도 초기 상태
const initialSmartStatus = $("managementSmartStatus");
const initialSmartIndicator = $("managementSmartIndicator");
const initialTemperatureStatus = $("managementTemperatureStatus");

if (initialSmartStatus) {
  initialSmartStatus.textContent = "외부 스마트 기기 미등록";
}

if (initialSmartIndicator) {
  initialSmartIndicator.classList.remove(
    "online",
    "warning",
    "offline"
  );
  initialSmartIndicator.classList.add("offline");
}

if (initialTemperatureStatus) {
  initialTemperatureStatus.textContent =
    "Android 온도 센서 연동 전";
}
  // 摄像头状态定时更新
  window.setInterval(updateCameraStatus, 1500);

renderDeviceIssues();
})();

// Home data-backed daily-care summary: open existing record editor/details.
(() => {
  const details = document.getElementById("careDetails");
  if (!details) return;
  ["todayFood", "todayWater", "todayWalk"].forEach(id => {
    const card = document.getElementById(id)?.closest(".stat-card");
    if (!card) return;
    card.classList.add("paw-care-shortcut");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "돌봄 기록 상세 보기 및 작성");
    const open = () => {
      details.open = true;
      details.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); open();
      }
    });
  });
})();
