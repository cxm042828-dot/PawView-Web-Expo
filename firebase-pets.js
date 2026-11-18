
import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
// ========================================
// PawView Firebase 宠物云端管理
// ========================================

const PETS_COLLECTION = "pets";

// 当前登录用户
let currentFirebaseUser = null;

// 获取当前登录用户
function getCurrentUser() {
  const user = auth.currentUser || currentFirebaseUser;

  if (!user) {
    throw new Error("사용자 로그인이 필요합니다.");
  }

  return user;
}

// 生成固定的云端文档 ID
function getPetDocumentId(userId, dogId) {
  return userId + "_" + dogId;
}

// ========================================
// 监听登录状态
// ========================================

onAuthStateChanged(auth, (user) => {
  currentFirebaseUser = user;

  window.PawViewFirebaseUser = user;

  window.dispatchEvent(
    new CustomEvent("pawview-auth-state-changed", {
      detail: { user }
    })
  );

  if (user) {
    console.log("PawView Firebase 用户已登录：", user.uid);
  } else {
    console.log("PawView Firebase 用户已退出登录");
  }
});

// ========================================
// 读取当前用户的宠物资料
// ========================================

async function loadCloudPets() {
  const user = getCurrentUser();

  const petsRef = collection(db, PETS_COLLECTION);

  const q = query(
    petsRef,
    where("userId", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .filter((item) => {
      const data = item.data();

      return (
        typeof data.dogId === "string" &&
        data.dogId.length > 0
      );
    })
    .map((item) => {
      const data = item.data();

return {
  id: data.dogId,
  name: data.name || "",
  breed: data.breed || "",
  birthday: data.birthday || "",
  weight: data.weight ?? null,
  gender: data.gender || "",
  activityHabits: data.activityHabits || "",
  dietHabits: data.dietHabits || "",
  specialNotes: data.specialNotes || "",
  photo: "",
  updatedAt: data.updatedAt || "",
  deleted: data.deleted === true,
  deletedAt: data.deletedAt || ""
};
    });
}

// ========================================
// 保存或更新宠物资料
// ========================================

async function saveCloudPet(pet) {
  const user = getCurrentUser();

  if (
    !pet ||
    typeof pet.id !== "string" ||
    !pet.id
  ) {
    throw new Error("宠物资料格式不正确");
  }

  const documentId = getPetDocumentId(
    user.uid,
    pet.id
  );

  const petRef = doc(
    db,
    PETS_COLLECTION,
    documentId
  );


const updatedAt = pet.updatedAt || new Date().toISOString();
const localTime = Date.parse(updatedAt);

if (!Number.isFinite(localTime)) {
  throw new Error("本地宠物更新时间无效，已停止上传");
}

await runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(petRef);

  if (snapshot.exists()) {
    const remote = snapshot.data();

    if (remote.userId !== user.uid) {
      throw new Error("云端宠物资料不属于当前账号");
    }

    if (remote.deleted === true) {
      throw new Error(
        "该宠物已在云端删除，禁止旧设备重新上传"
      );
    }

    const remoteTime = Date.parse(remote.updatedAt || "");

    // 禁止较旧的本地资料覆盖较新的云端资料
    if (
      Number.isFinite(remoteTime) &&
      localTime < remoteTime
    ) {
      throw new Error(
        "云端宠物资料更新，请先重新同步再保存"
      );
    }

    // 同一时间戳但资料可能不同，避免静默覆盖
if (
  Number.isFinite(remoteTime) &&
  localTime === remoteTime
) {
  const fields = [
    "name",
    "breed",
    "birthday",
    "weight",
    "gender",
    "activityHabits",
    "dietHabits",
    "specialNotes"
  ];

  const sameData = fields.every(field => {
    const localValue = pet[field] ?? null;
    const remoteValue = remote[field] ?? null;

    return localValue === remoteValue;
  });

  if (sameData) {
    // 时间与资料都相同，不需要重复写入
    return;
  }

  // 时间相同，但内容不同，交给用户处理冲突
  throw new Error(
    "本地与云端资料更新时间相同，但内容不同，请重新同步后再保存"
  );
}
  }

  transaction.set(
    petRef,
    {
      userId: user.uid,
      dogId: pet.id,
      name: pet.name || "",
      breed: pet.breed || "",
      birthday: pet.birthday || "",
      weight: pet.weight ?? null,
      gender: pet.gender || "",
      activityHabits: pet.activityHabits || "",
      dietHabits: pet.dietHabits || "",
      specialNotes: pet.specialNotes || "",
      updatedAt,
      deleted: false,
      deletedAt: ""
    },
    { merge: true }
  );
});


  console.log("PawView 宠物云端保存成功：", pet.name);

  return true;
}

// ========================================
// 删除宠物资料
// ========================================

async function deleteCloudPet(dogId) {
  const user = getCurrentUser();

  if (
    typeof dogId !== "string" ||
    !dogId
  ) {
    throw new Error("宠物 ID 不正确");
  }

  const documentId = getPetDocumentId(
    user.uid,
    dogId
  );


const petRef = doc(db, PETS_COLLECTION, documentId);

await runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(petRef);

  if (snapshot.exists()) {
    const data = snapshot.data();

    if (data.userId !== user.uid) {
      throw new Error("没有权限删除该宠物");
    }

    // 已经删除的宠物无需再次写入
    if (data.deleted === true) {
      return;
    }
  }

  const deletedAt = new Date().toISOString();

  transaction.set(
    petRef,
    {
      userId: user.uid,
      dogId,
      deleted: true,
      deletedAt,
      updatedAt: deletedAt
    },
    { merge: true }
  );
});


  console.log("PawView 宠物云端删除成功：", dogId);

  return true;
}

// ========================================
// 提供给 main.js 调用
// ========================================

window.PawViewFirebasePets = {
  loadCloudPets,
  saveCloudPet,
  deleteCloudPet
};

console.log("PawView Firebase 宠物同步模块已加载");
