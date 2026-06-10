import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 必要な環境変数が揃っているかチェック
const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

let app;
let db: ReturnType<typeof getFirestore>;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebaseの初期化に失敗しました。モックモードで動作します。', error);
    // モックオブジェクトとしてダミーで定義
    db = {} as any;
  }
} else {
  console.warn(
    'Firebaseの環境変数が設定されていません。ローカルモックモード（データの保存はセッション内のみ）で動作します。'
  );
  db = {} as any;
}

export { db, isFirebaseConfigured };
export default app;
