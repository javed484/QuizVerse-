import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCVZCh-Av-CMxIZm2yUOnTrDo81HVbsu60",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-5867411344-2dab3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-5867411344-2dab3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-5867411344-2dab3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "424322869679",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:424322869679:web:35e5d41c7ec41a3fcbe75a"
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
