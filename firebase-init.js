
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// PawView Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDtWhWvaTyXmi-3gxD7SOZI8kexXsbAO90",
  authDomain: "pawview.firebaseapp.com",
  projectId: "pawview",
  storageBucket: "pawview.firebasestorage.app",
  messagingSenderId: "909099193167",
  appId: "1:909099193167:web:e49fa60ef8b9a202ce2b3a",
  measurementId: "G-V5XR1HDVJB"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化用户身份验证，优先使用本地持久化
const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence
  ]
});

// 初始化云数据库
const db = getFirestore(app);

// 提供给 PawView 其他模块使用
export { app, auth, db };
