import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange, signInWithGoogle, signOut } from './firebase';
import { getUser, createUser, updateUserFamily } from './firestore-storage';
import type { AppUser, Family } from './types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  family: Family | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  setFamily: (family: Family) => void;
  updateFamily: (familyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Check if user exists in Firestore
          let userData = await getUser(firebaseUser.uid);

          if (!userData) {
            // Create new user in Firestore
            userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              familyId: null,
            };
            await createUser(userData);
          }

          setAppUser(userData);
        } catch (err) {
          console.error('Error loading user data:', err);
          setError('Failed to load user data');
        }
      } else {
        setAppUser(null);
        setFamily(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Failed to sign in. Please try again.');
    }
  }, []);

  const logOut = useCallback(async () => {
    try {
      await signOut();
      setAppUser(null);
      setFamily(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out');
    }
  }, []);

  const updateFamily = useCallback(async (familyId: string) => {
    if (appUser) {
      await updateUserFamily(appUser.uid, familyId);
      setAppUser({ ...appUser, familyId });
    }
  }, [appUser]);

  const value: AuthContextType = {
    user,
    appUser,
    family,
    loading,
    error,
    signIn,
    logOut,
    setFamily,
    updateFamily,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
