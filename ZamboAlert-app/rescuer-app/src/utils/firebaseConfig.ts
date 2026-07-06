import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAx5V8eT8FoZmUKG9s9MtWSm58xCQz2imQ",
  authDomain: "zamboalertapp.firebaseapp.com",
  projectId: "zamboalertapp",
  storageBucket: "zamboalertapp.firebasestorage.app",
  messagingSenderId: "612474003737",
  appId: "1:612474003737:web:12dc339ecff1bfb2b0a588",
  measurementId: "G-XZLSYQEZB4"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { app, auth };
