
import { auth } from "./firebase-init.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

// 页面元素
const authScreen = document.getElementById("authScreen");
const appShell = document.querySelector(".app-shell");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const showRegisterButton = document.getElementById("showRegisterButton");
const showLoginButton = document.getElementById("showLoginButton");
const resetPasswordButton = document.getElementById("resetPasswordButton");

const authMessage = document.getElementById("authMessage");

// Keep the app private until Firebase has restored persisted credentials.
if (appShell) appShell.style.display = "none";
if (authScreen) {
  authScreen.hidden = false;
  authScreen.setAttribute("aria-busy", "true");
}
const authLoading = document.createElement("p");
authLoading.id = "authRestoreStatus";
authLoading.className = "auth-restore-status";
authLoading.textContent = "로그인 상태 확인 중…";
authLoading.setAttribute("role", "status");
loginForm?.before(authLoading);
const retryAuthButton = document.createElement("button");
retryAuthButton.type = "button";
retryAuthButton.className = "auth-submit";
retryAuthButton.textContent = "다시 시도";
retryAuthButton.hidden = true;
retryAuthButton.addEventListener("click", () => window.location.reload());
authLoading.after(retryAuthButton);
if (loginForm) loginForm.hidden = true;
if (registerForm) registerForm.hidden = true;
let authResolved = false;
let authRestoreTimer = window.setTimeout(() => {
  if (!authResolved) {
    authLoading.textContent = "연결 상태를 확인하고 있습니다. 인터넷 연결을 확인해 주세요.";
    retryAuthButton.hidden = false;
  }
}, 8000);
function finishAuthRestore() {
  authResolved = true;
  clearTimeout(authRestoreTimer);
  authLoading.hidden = true;
  retryAuthButton.hidden = true;
  authScreen?.removeAttribute("aria-busy");
}

// 显示提示信息
function showMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#d45b4d" : "#208653";
}

// 切换到登录表单
function showLogin() {
  loginForm.hidden = false;
  registerForm.hidden = true;
  showMessage("");
}

// 切换到注册表单
function showRegister() {
  loginForm.hidden = true;
  registerForm.hidden = false;
  showMessage("");
}

// 登录与注册页面切换
showRegisterButton.addEventListener("click", showRegister);
showLoginButton.addEventListener("click", showLogin);

// 登录
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const button = loginForm.querySelector(".auth-submit");
  button.disabled = true;
  button.textContent = "로그인 중...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("로그인 성공", false);
  } catch (error) {
    console.error("Firebase 로그인 오류:", error);

    const messages = {
      "auth/invalid-email": "이메일 주소를 확인해 주세요.",
      "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
      "auth/user-disabled": "사용이 중지된 계정입니다.",
      "auth/too-many-requests": "잠시 후 다시 시도해 주세요."
    };

    showMessage(
      messages[error.code] || "로그인에 실패했습니다. 다시 시도해 주세요."
    );
  } finally {
    button.disabled = false;
    button.textContent = "로그인";
  }
});

// 注册
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword =
    document.getElementById("registerPasswordConfirm").value;

  if (password !== confirmPassword) {
    showMessage("비밀번호가 서로 일치하지 않습니다.");
    return;
  }

  const button = registerForm.querySelector(".auth-submit");
  button.disabled = true;
  button.textContent = "가입 중...";

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showMessage("회원가입이 완료되었습니다.", false);
  } catch (error) {
    console.error("Firebase 회원가입 오류:", error);

    const messages = {
      "auth/email-already-in-use": "이미 가입된 이메일입니다.",
      "auth/invalid-email": "이메일 주소를 확인해 주세요.",
      "auth/weak-password": "비밀번호는 6자 이상 입력해 주세요.",
      "auth/operation-not-allowed": "Firebase 이메일 로그인 기능을 확인해 주세요."
    };

    showMessage(
      messages[error.code] || "회원가입에 실패했습니다. 다시 시도해 주세요."
    );
  } finally {
    button.disabled = false;
    button.textContent = "회원가입";
  }
});

// 忘记密码
resetPasswordButton.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showMessage("먼저 이메일 주소를 입력해 주세요.");
    document.getElementById("loginEmail").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("비밀번호 재설정 이메일을 확인해 주세요.", false);
  } catch (error) {
    console.error("비밀번호 재설정 오류:", error);

    showMessage(
      "이메일 주소를 확인하거나 잠시 후 다시 시도해 주세요."
    );
  }
});

// Firebase 登录状态监听
onAuthStateChanged(auth, (user) => {
  finishAuthRestore();
  if (user) {
    authScreen.hidden = true;

    if (appShell) {
      appShell.style.display = "";
    }

    console.log("PawView 로그인 상태:", user.uid);
  } else {
    authScreen.hidden = false;

    if (appShell) {
      appShell.style.display = "none";
    }

    showLogin();
  }
}, (error) => {
  finishAuthRestore();
  console.error("Firebase 로그인 상태 복원 실패:", error);
  if (appShell) appShell.style.display = "none";
  if (authScreen) authScreen.hidden = false;
  showLogin();
  retryAuthButton.hidden = false;
  showMessage("로그인 상태를 확인하지 못했습니다. 인터넷을 확인하고 다시 시도해 주세요.");
});
// 로그아웃 버튼
const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      // Unregister before Firebase drops the authenticated Firestore session.
      await window.PawViewPushUnregister?.();
      await signOut(auth);
      showMessage("로그아웃되었습니다.", false);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      alert("로그아웃에 실패했습니다. 다시 시도해 주세요.");
    }
  });
}