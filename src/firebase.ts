import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

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

const googleProvider = new GoogleAuthProvider();

// Sign in with Google
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Sign out
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Subscribe to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
