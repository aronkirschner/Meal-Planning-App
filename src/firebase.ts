import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
export const auth = getAuth(app);

// Sign in anonymously and return a promise that resolves when auth is ready
export function initializeAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        console.log('User authenticated:', user.uid);
        resolve();
      } else {
        // Not signed in, sign in anonymously
        signInAnonymously(auth)
          .then(() => {
            console.log('Signed in anonymously');
            resolve();
          })
          .catch((error) => {
            console.error('Auth error:', error);
            reject(error);
          });
      }
    });
  });
}
