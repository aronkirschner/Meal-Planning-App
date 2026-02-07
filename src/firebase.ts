import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBaheO9addOAAEzAFaIFSX8A2dTtWyOBC8",
  authDomain: "ak-ji-meal-planning-app.firebaseapp.com",
  projectId: "ak-ji-meal-planning-app",
  storageBucket: "ak-ji-meal-planning-app.firebasestorage.app",
  messagingSenderId: "330062156014",
  appId: "1:330062156014:web:8fb13d998013e6bde0a3ff",
  measurementId: "G-3X3YWB5ZRK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
