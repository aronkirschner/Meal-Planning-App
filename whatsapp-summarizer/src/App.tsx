import { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import WhatsAppSummary from './components/WhatsAppSummary';
import './App.css';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">💬</div>
          <h1>WhatsApp Summarizer</h1>
          <p>Sign in to generate AI summaries of your WhatsApp groups.</p>
          <button
            className="btn btn-primary"
            onClick={() => signInWithPopup(auth, googleProvider)}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <span className="header-icon">💬</span>
            <h1>WhatsApp Summarizer</h1>
          </div>
          <div className="header-user">
            {user.photoURL && (
              <img src={user.photoURL} alt={user.displayName ?? ''} className="user-avatar" />
            )}
            <span className="user-name">{user.displayName}</span>
            <button className="btn btn-ghost" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <WhatsAppSummary userId={user.uid} />
      </main>
    </div>
  );
}
