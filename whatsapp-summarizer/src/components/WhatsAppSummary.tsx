import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import type { WhatsAppConfig, WhatsAppSummary as SummaryType } from '../types';
import './WhatsAppSummary.css';

interface Props {
  userId: string;
}

const CONFIG_DOC = (userId: string) => `users/${userId}/whatsappConfig/settings`;
const SUMMARIES_COL = (userId: string) => `users/${userId}/whatsappSummaries`;

const DEFAULT_MESSAGE_COUNT = 200;

export default function WhatsAppSummary({ userId }: Props) {
  const [config, setConfig] = useState<WhatsAppConfig>({
    instanceId: '',
    apiToken: '',
    chatId: '',
    chatName: '',
    messageCount: DEFAULT_MESSAGE_COUNT,
  });
  const [configSaved, setConfigSaved] = useState(false);
  const [summaries, setSummaries] = useState<SummaryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  // Load saved config
  useEffect(() => {
    getDoc(doc(db, CONFIG_DOC(userId))).then((snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as WhatsAppConfig);
        setConfigSaved(true);
      }
    });
  }, [userId]);

  // Subscribe to summaries
  useEffect(() => {
    const q = query(
      collection(db, SUMMARIES_COL(userId)),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setSummaries(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SummaryType, 'id'>),
        }))
      );
    });
  }, [userId]);

  const saveConfig = async () => {
    setSavingConfig(true);
    setError('');
    try {
      await setDoc(doc(db, CONFIG_DOC(userId)), config);
      setConfigSaved(true);
      setActiveTab('dashboard');
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSummarize = useCallback(async () => {
    if (!configSaved) {
      setActiveTab('settings');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json() as { summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');

      await addDoc(collection(db, SUMMARIES_COL(userId)), {
        createdAt: Timestamp.now().toDate().toISOString(),
        messageCount: config.messageCount,
        content: data.summary,
        generatedBy: userId,
        chatName: config.chatName || config.chatId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  }, [configSaved, userId, config]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="wa-container">
      <div className="wa-card">
        {/* Tabs */}
        <div className="wa-tabs">
          <button
            className={`wa-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Summaries
          </button>
          <button
            className={`wa-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings {!configSaved && <span className="badge-dot" />}
          </button>
        </div>

        {/* ── Dashboard tab ── */}
        {activeTab === 'dashboard' && (
          <div className="wa-content">
            <div className="dashboard-header">
              <div>
                <h2>Group Summaries</h2>
                {config.chatName && (
                  <p className="chat-name-label">Group: {config.chatName || config.chatId}</p>
                )}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSummarize}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-sm" />
                    Summarizing…
                  </>
                ) : (
                  'Summarize Now'
                )}
              </button>
            </div>

            {error && <div className="wa-error">{error}</div>}

            {!configSaved && (
              <div className="wa-notice">
                Configure your Green API credentials in{' '}
                <button className="link-btn" onClick={() => setActiveTab('settings')}>
                  Settings
                </button>{' '}
                to get started.
              </div>
            )}

            {summaries.length === 0 && configSaved && !loading && (
              <div className="wa-empty">
                No summaries yet. Hit <strong>Summarize Now</strong> to generate your first one.
              </div>
            )}

            <div className="summaries-list">
              {summaries.map((s) => (
                <div key={s.id} className="summary-card">
                  <div
                    className="summary-header"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    <div className="summary-meta">
                      <span className="summary-date">{formatDate(s.createdAt)}</span>
                      <span className="summary-chip">{s.messageCount} messages</span>
                    </div>
                    <span className="expand-icon">{expanded === s.id ? '▲' : '▼'}</span>
                  </div>
                  {expanded === s.id && (
                    <div className="summary-body">
                      <div className="summary-text">{s.content}</div>
                      <button
                        className="btn btn-secondary copy-btn"
                        onClick={() => navigator.clipboard.writeText(s.content)}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Settings tab ── */}
        {activeTab === 'settings' && (
          <div className="wa-content">
            <h2>Green API Settings</h2>
            <p className="settings-hint">
              Create a free account at{' '}
              <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
                console.green-api.com
              </a>
              , create an instance, and scan the QR code to connect your WhatsApp.
            </p>

            <div className="form-group">
              <label>Instance ID</label>
              <input
                type="text"
                placeholder="e.g. 1101234567"
                value={config.instanceId}
                onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>API Token</label>
              <input
                type="password"
                placeholder="Your Green API token"
                value={config.apiToken}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Group Chat ID</label>
              <input
                type="text"
                placeholder="e.g. 12345678901234567890@g.us"
                value={config.chatId}
                onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
              />
              <span className="field-hint">
                In WhatsApp, open the group → tap the group name → scroll to the bottom. The
                chat ID ends in <code>@g.us</code>. You can also use the Green API console to
                list your chats.
              </span>
            </div>

            <div className="form-group">
              <label>Group Display Name (optional)</label>
              <input
                type="text"
                placeholder="e.g. Family Group"
                value={config.chatName}
                onChange={(e) => setConfig({ ...config, chatName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Messages to include per summary</label>
              <input
                type="number"
                min={10}
                max={1000}
                value={config.messageCount}
                onChange={(e) =>
                  setConfig({ ...config, messageCount: Math.max(10, Number(e.target.value)) })
                }
              />
              <span className="field-hint">
                200 messages ≈ ~$0.002 per summary with GPT-4o-mini.
              </span>
            </div>

            {error && <div className="wa-error">{error}</div>}

            <button className="btn btn-primary" onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
