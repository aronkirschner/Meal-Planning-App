import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { createFamily, getFamilyByInviteCode, joinFamily } from '../firestore-storage';
import type { Family } from '../types';

interface FamilyManagerProps {
  onFamilySelected: (family: Family) => void;
}

export function FamilyManager({ onFamilySelected }: FamilyManagerProps) {
  const { appUser, logOut } = useAuth();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim() || !appUser) return;

    setLoading(true);
    setError(null);

    try {
      const family = await createFamily(familyName.trim(), appUser.uid);
      onFamilySelected(family);
    } catch (err) {
      console.error('Error creating family:', err);
      setError('Failed to create family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !appUser) return;

    setLoading(true);
    setError(null);

    try {
      const family = await getFamilyByInviteCode(inviteCode.trim());
      if (!family) {
        setError('Invalid invite code. Please check and try again.');
        setLoading(false);
        return;
      }

      await joinFamily(family, appUser.uid);
      onFamilySelected(family);
    } catch (err) {
      console.error('Error joining family:', err);
      setError('Failed to join family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="family-manager">
      <div className="family-card">
        <div className="family-header">
          <h2>Welcome, {appUser?.displayName || 'User'}!</h2>
          <p>Set up your family to start planning meals together</p>
        </div>

        {error && <div className="family-error">{error}</div>}

        {mode === 'choose' && (
          <div className="family-options">
            <button
              onClick={() => setMode('create')}
              className="btn-family-option"
            >
              <span className="option-icon">+</span>
              <span className="option-text">
                <strong>Create a Family</strong>
                <small>Start a new meal planning group</small>
              </span>
            </button>

            <button
              onClick={() => setMode('join')}
              className="btn-family-option"
            >
              <span className="option-icon">&#x1F517;</span>
              <span className="option-text">
                <strong>Join a Family</strong>
                <small>Enter an invite code to join</small>
              </span>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateFamily} className="family-form">
            <div className="form-group">
              <label htmlFor="familyName">Family Name</label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g., The Smiths, Our Home"
                required
              />
            </div>

            <div className="family-form-actions">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !familyName.trim()}
              >
                {loading ? 'Creating...' : 'Create Family'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinFamily} className="family-form">
            <div className="form-group">
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                maxLength={6}
                required
              />
            </div>

            <div className="family-form-actions">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? 'Joining...' : 'Join Family'}
              </button>
            </div>
          </form>
        )}

        <div className="family-footer">
          <button onClick={logOut} className="btn-link">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
