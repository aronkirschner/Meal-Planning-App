import { useState } from 'react';

interface InviteModalProps {
  inviteCode: string;
  familyName: string;
  onClose: () => void;
}

export function InviteModal({ inviteCode, familyName, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const appUrl = 'https://mealplanningapp-omega.vercel.app/';

  const inviteMessage = `You're invited to join "${familyName}" on Meal Planner!

Use this invite code to join: ${inviteCode}

1. Go to ${appUrl}
2. Sign in with Google
3. Click "Join a Family"
4. Enter the code: ${inviteCode}

See you there!`;

  const handleSendEmail = () => {
    if (!email.trim()) return;

    const subject = encodeURIComponent(`Join ${familyName} on Meal Planner`);
    const body = encodeURIComponent(inviteMessage);

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${familyName} on Meal Planner`,
          text: inviteMessage,
          url: appUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Invite Family Members</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <div className="invite-code-section">
          <p>Your invite code:</p>
          <code className="invite-code-large">{inviteCode}</code>
        </div>

        <div className="invite-email-section">
          <label htmlFor="inviteEmail">Send invite via email:</label>
          <div className="invite-email-row">
            <input
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
            />
            <button
              onClick={handleSendEmail}
              className="btn-primary"
              disabled={!email.trim()}
            >
              Send
            </button>
          </div>
        </div>

        <div className="invite-actions">
          <button onClick={handleCopyMessage} className="btn-secondary">
            {copied ? 'Copied!' : 'Copy Invite Message'}
          </button>

          {'share' in navigator && (
            <button onClick={handleShare} className="btn-secondary">
              Share...
            </button>
          )}
        </div>

        <div className="invite-preview">
          <p className="preview-label">Message preview:</p>
          <pre className="preview-text">{inviteMessage}</pre>
        </div>
      </div>
    </div>
  );
}
