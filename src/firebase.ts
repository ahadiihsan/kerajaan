// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBFc-VO0FQZMfsenFGblZuHV8ywGKKQKYU",
  authDomain: "kerajaan-app.firebaseapp.com",
  projectId: "kerajaan-app",
  storageBucket: "kerajaan-app.firebasestorage.app",
  messagingSenderId: "650616858471",
  appId: "1:650616858471:web:30028c03f6b4e218d971c2",
  measurementId: "G-GB5KSRBD47"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics if supported in environment (e.g. browser vs SSR)
export const analyticsPromise = isSupported().then((supported) => {
  if (supported) {
    return getAnalytics(app);
  }
  return null;
});
