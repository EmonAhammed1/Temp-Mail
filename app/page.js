'use client';

import { useState, useEffect, useRef } from 'react';

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'lumina-mail.my';

export default function Home() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // Inboxes state
  const [inboxes, setInboxes] = useState([]);
  const [activeInbox, setActiveInbox] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [inboxesLoading, setInboxesLoading] = useState(false);

  // Emails state
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // General UI state
  const [toasts, setToasts] = useState([]);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef(null);

  // Workspace active tab ('mail' or 'sms')
  const [activeTab, setActiveTab] = useState('mail');

  // SMS state
  const [smsList, setSmsList] = useState([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsRefreshing, setSmsRefreshing] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const smsPollIntervalRef = useRef(null);

  // Toast Notification Helper
  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // 1. Session check on mount
  useEffect(() => {
    checkSession();
  }, []);

  // 2. Fetch emails & start polling whenever activeInbox or activeTab changes
  useEffect(() => {
    if (activeTab !== 'mail' || !activeInbox) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    fetchEmails(true); // Initial load with shimmer loading

    // Setup polling every 5 seconds
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(() => {
      fetchEmails(false); // Silent background reload
    }, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeInbox, activeTab]);

  // 3. Fetch SMS & start polling when activeTab === 'sms'
  useEffect(() => {
    if (activeTab !== 'sms') {
      if (smsPollIntervalRef.current) clearInterval(smsPollIntervalRef.current);
      return;
    }

    fetchSms(true); // Initial load with shimmer loading

    if (smsPollIntervalRef.current) clearInterval(smsPollIntervalRef.current);

    smsPollIntervalRef.current = setInterval(() => {
      fetchSms(false); // Silent background reload
    }, 5000);

    return () => {
      if (smsPollIntervalRef.current) clearInterval(smsPollIntervalRef.current);
    };
  }, [activeTab]);

  const checkSession = async () => {
    setCheckingSession(true);
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        setUser(data.user);
        if (data.user.status === 'approved') {
          fetchInboxes(data.user.id);
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setCheckingSession(false);
    }
  };

  const fetchInboxes = async () => {
    setInboxesLoading(true);
    try {
      const res = await fetch('/api/inboxes');
      const data = await res.json();
      if (data.success) {
        setInboxes(data.inboxes || []);
        
        // Auto-select first inbox if activeInbox not found or empty
        const savedInbox = localStorage.getItem('temp_mail_active_inbox');
        const list = data.inboxes || [];
        
        if (savedInbox && list.some(item => item.address === savedInbox)) {
          setActiveInbox(savedInbox);
        } else if (list.length > 0) {
          setActiveInbox(list[0].address);
          localStorage.setItem('temp_mail_active_inbox', list[0].address);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inboxes:', err);
    } finally {
      setInboxesLoading(false);
    }
  };

  const fetchEmails = async (showShimmer = false) => {
    if (!activeInbox) return;
    if (showShimmer) setEmailsLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/emails?address=${encodeURIComponent(activeInbox)}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
      } else {
        console.error('Failed to fetch emails:', data.error);
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setEmailsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSms = async (showShimmer = false) => {
    if (showShimmer) setSmsLoading(true);
    setSmsRefreshing(true);
    try {
      console.log(`[API Hit]: GET /api/sms`);
      const res = await fetch('/api/sms');
      const data = await res.json();
      console.log(`[API Response]: GET /api/sms status=${res.status}`, data);
      
      if (data.success) {
        setSmsList(data.messages || []);
      } else {
        console.error('Failed to fetch SMS:', data.error);
        if (data.error === 'Unauthorized') {
          setIsAuthenticated(false);
        }
      }
    } catch (err) {
      console.error('Error fetching SMS:', err);
    } finally {
      setSmsLoading(false);
      setSmsRefreshing(false);
    }
  };

  const deleteSms = async (id) => {
    if (!confirm('Are you sure you want to delete this SMS message?')) return;
    try {
      console.log(`[API Hit]: DELETE /api/sms?id=${id}`);
      const res = await fetch(`/api/sms?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      console.log(`[API Response]: DELETE /api/sms status=${res.status}`, data);
      
      if (data.success) {
        setSmsList((prev) => prev.filter((sms) => sms._id !== id));
        addToast('SMS deleted successfully');
      } else {
        addToast(data.error || 'Failed to delete SMS', 'error');
      }
    } catch (err) {
      console.error('Error deleting SMS:', err);
      addToast('An error occurred while deleting SMS', 'error');
    }
  };

  const copyTwilioNumber = () => {
    const TWILIO_NUMBER = (process.env.NEXT_PUBLIC_TWILIO_NUMBER || '+13342318047').trim();
    navigator.clipboard.writeText(TWILIO_NUMBER);
    setCopiedSms(true);
    addToast('Copied phone number to clipboard!');
    setTimeout(() => setCopiedSms(false), 2000);
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setUser(data.user);
        addToast(authMode === 'login' ? 'Welcome back!' : 'Registered successfully!');
        // Load inboxes if user is approved
        if (data.user.status === 'approved') {
          fetchInboxes();
        }
        // Reset auth fields
        setAuthEmail('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error(err);
      setAuthError('An error occurred during authentication');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setIsAuthenticated(false);
        setUser(null);
        setInboxes([]);
        setActiveInbox('');
        setEmails([]);
        setSelectedEmail(null);
        localStorage.removeItem('temp_mail_active_inbox');
        addToast('Logged out successfully.');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Inbox creation & deletion
  const createInbox = async (type) => {
    try {
      const body = type === 'random' ? { type } : { type, prefix: customPrefix };
      const res = await fetch('/api/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setInboxes((prev) => [data.inbox, ...prev]);
        setActiveInbox(data.inbox.address);
        localStorage.setItem('temp_mail_active_inbox', data.inbox.address);
        setCustomPrefix('');
        addToast('Temporary inbox created!');
      } else {
        addToast(data.error || 'Failed to create inbox', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while creating inbox', 'error');
    }
  };

  const deleteInbox = async (address) => {
    if (!confirm(`Are you sure you want to discard ${address}?\nAll received emails will be deleted permanently.`)) return;

    try {
      const res = await fetch(`/api/inboxes?address=${encodeURIComponent(address)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setInboxes((prev) => prev.filter((i) => i.address !== address));
        addToast('Inbox discarded successfully');
        
        // If we deleted the active inbox, select another one
        if (activeInbox === address) {
          const remaining = inboxes.filter((i) => i.address !== address);
          if (remaining.length > 0) {
            setActiveInbox(remaining[0].address);
            localStorage.setItem('temp_mail_active_inbox', remaining[0].address);
          } else {
            setActiveInbox('');
            localStorage.removeItem('temp_mail_active_inbox');
          }
        }
      } else {
        addToast(data.error || 'Failed to delete inbox', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred', 'error');
    }
  };

  // Individual Email delete
  const deleteSingleEmail = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/emails?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) => prev.filter((email) => email._id !== id));
        if (selectedEmail && selectedEmail._id === id) {
          setSelectedEmail(null);
        }
        addToast('Email deleted successfully');
      } else {
        addToast('Failed to delete email', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while deleting', 'error');
    }
  };

  const copyAddress = () => {
    if (!activeInbox) return;
    navigator.clipboard.writeText(activeInbox);
    setCopied(true);
    addToast('Copied address to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Render Shimmer for check session
  if (checkingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', background: '#060608', color: '#fff' }}>
        <div className="loader-small" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Initializing Emons Temp Mail...</span>
      </div>
    );
  }

  return (
    <>
      {/* Background Animated Glows */}
      <div className="bg-glow-container">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
      </div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-logo">
            Emons <span>Temp Mail</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {isAuthenticated && (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Logged in as: <span style={{ color: '#fff', fontWeight: 700 }}>{user?.email}</span>
                </div>
                <button className="btn-secondary" style={{ padding: '0.45rem 1rem', borderRadius: '10px', fontSize: '0.8rem' }} onClick={handleLogout}>
                  Log Out
                </button>
              </>
            )}
            <div className="status-badge">
              <span className="bounce-dot"></span>
              {activeTab === 'mail' 
                ? (refreshing ? 'Refreshing...' : 'Live auto-refresh (5s)')
                : (smsRefreshing ? 'Refreshing...' : 'Live auto-refresh (5s)')
              }
            </div>
          </div>
        </header>

        {/* 1. Unauthenticated Login/Signup Views */}
        {!isAuthenticated ? (
          <section className="auth-container">
            <div className="glass-panel auth-card">
              <h2 className="auth-title">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
              
              {authError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--error)', padding: '0.85rem 1.15rem', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="auth-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="name@email.com" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={authLoading} style={{ marginTop: '0.5rem', height: '48px' }}>
                  {authLoading ? <div className="loader-small"></div> : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
                </button>
              </form>

              <div className="auth-toggle">
                {authMode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <span className="auth-toggle-link" onClick={() => { setAuthMode('signup'); setAuthError(''); }}>
                      Sign Up
                    </span>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <span className="auth-toggle-link" onClick={() => { setAuthMode('login'); setAuthError(''); }}>
                      Sign In
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : user?.status === 'pending' || user?.status === 'rejected' ? (
          /* Pending / Rejected Approval view */
          <section className="auth-container">
            <div className="glass-panel auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', border: user?.status === 'rejected' ? '1px solid rgba(244, 63, 94, 0.2)' : '1px solid rgba(147, 51, 234, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: user?.status === 'rejected' ? 'var(--error)' : 'var(--primary-hover)' }}>
                {user?.status === 'rejected' ? (
                  <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h2 className="auth-title" style={{ background: user?.status === 'rejected' ? 'linear-gradient(to right, #fff, #f43f5e)' : 'linear-gradient(to right, #fff, #c084fc)' }}>
                {user?.status === 'rejected' ? 'Access Denied' : 'Approval Pending'}
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                Hello <strong>{user?.email}</strong>, {user?.status === 'rejected' 
                  ? 'your account registration was rejected or suspended by the administrator.' 
                  : 'your account has been created and is currently pending administrator approval.'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.5', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                {user?.status === 'rejected' 
                  ? 'Please contact support if you believe this is a mistake.' 
                  : 'Please check back later or contact the administrator to activate your account.'}
              </p>
              <button className="btn-secondary" onClick={handleLogout} style={{ marginTop: '0.5rem', height: '48px', width: '100%' }}>
                Log Out
              </button>
            </div>
          </section>
        ) : (
          /* 2. Authenticated Dashboard Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            
            {/* Workspace Tabs */}
            <div className="workspace-tabs-wrapper">
              <div className="workspace-tabs">
                <button 
                  className={`workspace-tab ${activeTab === 'mail' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mail')}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Temp Mail
                </button>
                <button 
                  className={`workspace-tab ${activeTab === 'sms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sms')}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Temp SMS
                </button>
              </div>
            </div>

            {activeTab === 'mail' ? (
              <>
                {/* Selected Address Display Banner (Full Width at the Top) */}
                {activeInbox && (
                  <div className="glass-panel address-display">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Active Temporary Inbox
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="address-text">{activeInbox}</span>
                        <button className="btn-primary btn-icon" onClick={copyAddress} title="Copy Address" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                          {copied ? (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--success)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="address-actions">
                      <button className="btn-secondary btn-icon" style={{ color: 'var(--error)', borderColor: 'rgba(244, 63, 94, 0.2)' }} onClick={() => deleteInbox(activeInbox)} title="Discard Inbox">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Dashboard Workspace Grid (Left Sidebar for controls, Right Sidebar for content) */}
                <div className="main-dashboard-grid">
                  
                  {/* Left Sidebar Pane: Create Inbox & My Inboxes stacked */}
                  <div className="sidebar-pane">
                    {/* Inbox Creator Control */}
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create Inbox</h3>
                      
                      <div className="tabs-container">
                        <button 
                          className={`tab-btn ${!isCustomMode ? 'active' : ''}`}
                          onClick={() => setIsCustomMode(false)}
                        >
                          Random
                        </button>
                        <button 
                          className={`tab-btn ${isCustomMode ? 'active' : ''}`}
                          onClick={() => setIsCustomMode(true)}
                        >
                          Custom
                        </button>
                      </div>

                      {!isCustomMode ? (
                        <button className="btn-primary" onClick={() => createInbox('random')} style={{ width: '100%' }}>
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Generate Random
                        </button>
                      ) : (
                        <form onSubmit={(e) => { e.preventDefault(); createInbox('custom'); }} className="custom-email-form">
                          <div style={{ display: 'flex', width: '100%' }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="custom.name" 
                              value={customPrefix}
                              onChange={(e) => setCustomPrefix(e.target.value)}
                              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                            />
                            <span className="domain-suffix" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }}>
                              @{DOMAIN}
                            </span>
                          </div>
                          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            Create Address
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Owned Inboxes list */}
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Inboxes</h3>
                      
                      <div className="inbox-list-box">
                        {inboxesLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="shimmer shimmer-inbox-item" style={{ marginBottom: '0.6rem' }} />
                          ))
                        ) : inboxes.length === 0 ? (
                          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '1.25rem 0', textAlign: 'center' }}>
                            No active temporary inboxes. Generate one above!
                          </div>
                        ) : (
                          inboxes.map((inbox) => {
                            const isActive = activeInbox === inbox.address;
                            return (
                              <div 
                                key={inbox._id}
                                className={`inbox-item-row ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                  setActiveInbox(inbox.address);
                                  localStorage.setItem('temp_mail_active_inbox', inbox.address);
                                  setSelectedEmail(null); // Clear selected email on inbox change
                                }}
                              >
                                <span className="inbox-item-address" title={inbox.address}>
                                  {inbox.address}
                                </span>
                                <button 
                                  className="btn-card-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteInbox(inbox.address);
                                  }}
                                  title="Discard Inbox"
                                  style={{ padding: '0.15rem', marginLeft: '0.4rem' }}
                                >
                                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Content Pane: Emails grid split pane or Fallback display */}
                  <div className="content-pane">
                    {activeInbox ? (
                      <div className="dashboard-grid">
                        
                        {/* Emails List */}
                        <div className={`glass-panel inbox-list-pane ${selectedEmail ? 'hide-mobile-pane' : 'mobile-view-list'}`}>
                          <div className="pane-header">
                            <h2 className="pane-title">
                              Emails
                              <span className="badge">{emails.length}</span>
                            </h2>
                            {emails.length > 0 && (
                              <button 
                                onClick={() => fetchEmails(true)}
                                className="btn-secondary" 
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}
                                title="Manual refresh"
                              >
                                Refresh
                              </button>
                            )}
                          </div>

                          <div className="emails-scroll">
                            {emailsLoading ? (
                              Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="shimmer shimmer-card" />
                              ))
                            ) : emails.length === 0 ? (
                              <div className="empty-state">
                                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                                </svg>
                                <h3 style={{ fontSize: '1rem', color: '#fff' }}>No Messages Received</h3>
                                <p style={{ fontSize: '0.8rem' }}>Waiting for emails... refreshes every 5 seconds.</p>
                              </div>
                            ) : (
                              emails.map((email, idx) => {
                                const isSelected = selectedEmail && selectedEmail._id === email._id;
                                const timeStr = new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div 
                                    key={email._id} 
                                    className={`email-card ${isSelected ? 'active' : ''}`}
                                    onClick={() => setSelectedEmail(email)}
                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                  >
                                    <div className="email-card-header">
                                      <span className="email-card-sender">{email.from}</span>
                                      <span className="email-card-time">{timeStr}</span>
                                    </div>
                                    <span className="email-card-subject">{email.subject}</span>
                                    <span className="email-card-preview">{email.bodyText || '(HTML message only)'}</span>
                                    <div className="email-card-actions">
                                      <button 
                                        className="btn-card-delete"
                                        onClick={(e) => deleteSingleEmail(email._id, e)}
                                        title="Delete Email"
                                      >
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Email Reader */}
                        <div className={`glass-panel email-reader-pane ${selectedEmail ? 'mobile-view-reader' : 'hide-mobile-pane'}`}>
                          {selectedEmail ? (
                            <>
                              {/* Back to list button for mobile */}
                              <button className="btn-back-mobile" onClick={() => setSelectedEmail(null)}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back to Inbox
                              </button>

                              <div className="reader-header">
                                <div className="reader-meta">
                                  <h2 className="reader-subject">{selectedEmail.subject}</h2>
                                  <div className="reader-from">
                                    From: <span>{selectedEmail.from}</span>
                                  </div>
                                  <div className="reader-to">
                                    To: {selectedEmail.to}
                                  </div>
                                  <div className="reader-date">
                                    Received: {new Date(selectedEmail.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <div className="reader-actions">
                                  <button 
                                    className="btn-danger" 
                                    onClick={() => deleteSingleEmail(selectedEmail._id)}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              <div className="reader-body-wrapper">
                                {selectedEmail.bodyHtml ? (
                                  (() => {
                                    const cleanedHtml = selectedEmail.bodyHtml
                                      .replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ')
                                      .replace(/target="_self"/gi, '')
                                      .replace(/target="_parent"/gi, '')
                                      .replace(/target="_top"/gi, '');
                                    
                                    return (
                                      <iframe 
                                        className="reader-body-iframe"
                                        title="Email Body HTML"
                                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                                        srcDoc={`
                                          <!DOCTYPE html>
                                          <html>
                                            <head>
                                              <style>
                                                body {
                                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                                  font-size: 14px;
                                                  line-height: 1.6;
                                                  color: #333333;
                                                  margin: 16px;
                                                  word-break: break-word;
                                                }
                                                img { max-width: 100%; height: auto; }
                                              </style>
                                            </head>
                                            <body>
                                              ${cleanedHtml}
                                            </body>
                                          </html>
                                        `}
                                      />
                                    );
                                  })()
                                ) : (
                                  <div className="reader-body-text">
                                    {selectedEmail.bodyText || '(No text content available)'}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '350px', color: 'var(--muted)', gap: '0.5rem' }}>
                              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <p style={{ fontSize: '0.9rem' }}>Select an email from the left pane to view its content.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', color: 'var(--muted)', gap: '0.75rem', textAlign: 'center', height: '100%' }}>
                        <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.75">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <h3 style={{ color: '#fff' }}>No Active Inbox</h3>
                        <p style={{ fontSize: '0.9rem' }}>Generate a random email or create a custom prefix above to start receiving mails.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Active Phone Number Display Banner (Full Width at the Top of SMS workspace) */}
                <div className="glass-panel address-display">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Active Temporary Phone Number
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="address-text">{(process.env.NEXT_PUBLIC_TWILIO_NUMBER || '+13342318047').trim()}</span>
                      <button className="btn-primary btn-icon" onClick={copyTwilioNumber} title="Copy Number" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                        {copiedSms ? (
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--success)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="address-actions" style={{ minHeight: '46px' }}>
                    {/* Placeholder space to match delete button height for spacing */}
                  </div>
                </div>

                {/* SMS Grid Workspace */}
                <div className="main-dashboard-grid">
                  {/* Left Sidebar Pane: Instructions */}
                  <div className="sidebar-pane">
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SMS Workspace Info</h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <p>
                          This is a shared temporary phone number provided by your Twilio account.
                        </p>
                        <p>
                          Use this number to receive SMS verifications, OTPs, and text messages.
                        </p>
                        <p style={{ color: 'var(--primary-hover)', fontWeight: '600' }}>
                          ⚠️ IMPORTANT: As a shared Twilio trial number, anyone using this app can see messages received on this number.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Content Pane: SMS Messages List */}
                  <div className="content-pane">
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minHeight: '400px' }}>
                      <div className="pane-header">
                        <h2 className="pane-title">
                          SMS Inbox
                          <span className="badge">{smsList.length}</span>
                        </h2>
                        <button 
                          onClick={() => fetchSms(true)}
                          className="btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}
                          title="Manual refresh"
                        >
                          Refresh
                        </button>
                      </div>

                      <div className="emails-scroll" style={{ maxHeight: '600px' }}>
                        {smsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="shimmer shimmer-card" style={{ height: '110px' }} />
                          ))
                        ) : smsList.length === 0 ? (
                          <div className="empty-state">
                            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <h3 style={{ fontSize: '1rem', color: '#fff' }}>No SMS Received Yet</h3>
                            <p style={{ fontSize: '0.8rem' }}>Send an SMS/OTP to the number above. Refreshes every 5 seconds.</p>
                          </div>
                        ) : (
                          smsList.map((sms, idx) => {
                            const timeStr = new Date(sms.createdAt).toLocaleString();
                            return (
                              <div 
                                key={sms._id} 
                                className="email-card"
                                style={{ animationDelay: `${idx * 0.05}s`, cursor: 'default' }}
                              >
                                <div className="email-card-header">
                                  <span className="email-card-sender" style={{ color: 'var(--primary-hover)' }}>
                                    From: {sms.from}
                                  </span>
                                  <span className="email-card-time">{timeStr}</span>
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {sms.body}
                                </div>
                                <div className="email-card-actions">
                                  <button 
                                    className="btn-card-delete"
                                    onClick={() => deleteSms(sms._id)}
                                    title="Delete Message"
                                  >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        )}
      </div>

      {/* Toast Notification System */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" style={{ borderColor: toast.type === 'error' ? 'var(--error)' : 'rgba(255,255,255,0.1)' }}>
            {toast.type === 'success' ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--error)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
