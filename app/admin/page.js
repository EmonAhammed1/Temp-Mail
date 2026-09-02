'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard data state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-approve setting state
  const [autoApprove, setAutoApprove] = useState(false);
  const [togglingAutoApprove, setTogglingAutoApprove] = useState(false);

  // Outbound SMTP setting state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Toast Notification Helper
  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Check admin session on mount
  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    setCheckingSession(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsAdminAuthenticated(true);
          setUsers(data.users || []);
          fetchSettings();
        }
      }
    } catch (err) {
      console.error('Failed to verify admin status:', err);
    } finally {
      setCheckingSession(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setAutoApprove(Boolean(data.settings.autoApprove));
          if (data.settings.smtpConfig) {
            setSmtpHost(data.settings.smtpConfig.host || '');
            setSmtpPort(data.settings.smtpConfig.port || 587);
            setSmtpUser(data.settings.smtpConfig.user || '');
            setSmtpPass(data.settings.smtpConfig.pass || '');
            setSmtpSecure(Boolean(data.settings.smtpConfig.secure));
            setIsSmtpConfigured(Boolean(data.settings.smtpConfig.isConfigured));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err);
    }
  };

  const handleToggleAutoApprove = async () => {
    if (togglingAutoApprove) return;
    const targetState = !autoApprove;
    setTogglingAutoApprove(true);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApprove: targetState }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAutoApprove(Boolean(data.autoApprove));
        addToast(
          data.autoApprove
            ? '⚡ Auto-Approve Enabled: New accounts will be approved automatically!'
            : '🔒 Auto-Approve Disabled: New accounts will require manual approval.',
          'success'
        );
      } else {
        addToast(data.error || 'Failed to update auto-approval setting', 'error');
      }
    } catch (err) {
      console.error('Error toggling auto-approval:', err);
      addToast('An error occurred while updating auto-approval', 'error');
    } finally {
      setTogglingAutoApprove(false);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpConfig: {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass,
            secure: smtpSecure,
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSmtpConfigured(Boolean(smtpHost && smtpUser));
        addToast('SMTP mail server settings saved successfully! 🚀', 'success');
      } else {
        addToast(data.error || 'Failed to save SMTP settings', 'error');
      }
    } catch (err) {
      addToast('An error occurred while saving SMTP', 'error');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail || !testEmail.trim()) {
      addToast('Please enter a test recipient email address', 'error');
      return;
    }
    setTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: testEmail.trim(),
          smtpConfig: {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass,
            secure: smtpSecure,
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Test email sent successfully! 🚀', 'success');
      } else {
        addToast(data.error || 'SMTP Test Failed', 'error');
      }
    } catch (err) {
      addToast('An error occurred during SMTP test', 'error');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminAuthenticated(true);
        addToast('Admin login successful!');
        fetchUsers();
        fetchSettings();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setLoginError('An error occurred during login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      setIsAdminAuthenticated(false);
      setUsers([]);
      addToast('Logged out of Admin Portal');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      addToast('Failed to load users list', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserStatus = async (userId, newStatus) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u))
        );
        addToast(`User marked as ${newStatus}`);
      } else {
        addToast(data.error || 'Failed to update user', 'error');
      }
    } catch (err) {
      console.error('Update status error:', err);
      addToast('An error occurred', 'error');
    }
  };

  const deleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to permanently delete user:\n${userEmail}?\nAll their associated inboxes and emails will be destroyed.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((u) => u._id !== userId));
        addToast(`User ${userEmail} deleted successfully`);
      } else {
        addToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      console.error('Delete user error:', err);
      addToast('An error occurred', 'error');
    }
  };

  const impersonateUser = async (userId) => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast('Opening user workspace...', 'success');
        window.location.href = '/';
      } else {
        addToast(data.error || 'Failed to impersonate user', 'error');
      }
    } catch (err) {
      console.error('Impersonate error:', err);
      addToast('An error occurred during impersonation', 'error');
    }
  };

  // Filter users based on query
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const approvedCount = users.filter((u) => u.status === 'approved').length;

  if (checkingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', background: '#060608', color: '#fff' }}>
        <div className="loader-small" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Verifying Admin Credentials...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-glow-container">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
      </div>

      <div className="app-container" style={{ maxWidth: '1100px' }}>
        {/* Header */}
        <header className="app-header">
          <h1 className="app-logo">
            Emons <span>Admin Portal</span>
          </h1>
          {isAdminAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={handleToggleAutoApprove}
                className="btn-secondary" 
                style={{ 
                  padding: '0.45rem 1rem', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderColor: autoApprove ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  background: autoApprove ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  color: autoApprove ? '#10b981' : 'var(--muted)',
                  cursor: 'pointer'
                }}
                title="Toggle Auto-Approval for new signups"
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: autoApprove ? '#10b981' : 'var(--muted)',
                  boxShadow: autoApprove ? '0 0 8px #10b981' : 'none'
                }}></span>
                Auto-Approve: <strong>{autoApprove ? 'ON' : 'OFF'}</strong>
              </button>

              <button className="btn-secondary" style={{ padding: '0.45rem 1rem', borderRadius: '10px', fontSize: '0.8rem' }} onClick={handleAdminLogout}>
                Log Out
              </button>
            </div>
          )}
        </header>

        {!isAdminAuthenticated ? (
          /* Admin Login Form */
          <section className="auth-container">
            <div className="glass-panel auth-card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{ background: 'rgba(147, 51, 234, 0.1)', border: '1px solid rgba(147, 51, 234, 0.25)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary-hover)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="auth-title" style={{ marginBottom: '0.25rem' }}>Admin Access</h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Enter master credentials to manage users and system approval.</p>
              </div>

              {loginError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                  {loginError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="auth-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={loginLoading}
                  style={{ height: '46px', marginTop: '0.75rem', width: '100%' }}
                >
                  {loginLoading ? <div className="loader-small"></div> : 'Authorize Entry'}
                </button>
              </form>
            </div>
          </section>
        ) : (
          /* Admin Dashboard Overview & Table */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '0.75rem' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: '#fff' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Accounts</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{users.length}</div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(147, 51, 234, 0.1)', borderRadius: '12px', padding: '0.75rem' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary-hover)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Review</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>{pendingCount}</div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '0.75rem' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Approved</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{approvedCount}</div>
                </div>
              </div>

              {/* Auto-Approval Status Card */}
              <div 
                className="glass-panel auto-approve-card" 
                onClick={handleToggleAutoApprove}
                style={{ 
                  padding: '1.25rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: autoApprove ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                  background: autoApprove ? 'rgba(16, 185, 129, 0.04)' : 'var(--card-bg)',
                  transition: 'all 0.25s ease'
                }}
                title="Click to toggle auto-approval mode"
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Auto-Approve
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                    {autoApprove ? 'Instant access on signup' : 'Requires admin approval'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{
                    width: '44px',
                    height: '24px',
                    background: autoApprove ? 'var(--success)' : 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '99px',
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    boxShadow: autoApprove ? '0 0 12px rgba(16, 185, 129, 0.45)' : 'none',
                  }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      background: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: autoApprove ? '23px' : '3px',
                      transition: 'left 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: autoApprove ? 'var(--success)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {togglingAutoApprove ? 'Updating...' : (autoApprove ? 'ON' : 'OFF')}
                  </span>
                </div>
              </div>
            </div>

            {/* Outbound SMTP Mail Server Configuration Card */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: isSmtpConfigured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(147, 51, 234, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ✉️ Outbound SMTP Configuration
                    <span style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: '99px', 
                      background: isSmtpConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', 
                      color: isSmtpConfigured ? '#34d399' : '#fb7185',
                      border: isSmtpConfigured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)'
                    }}>
                      {isSmtpConfigured ? 'Active & Configured' : 'Not Configured (External mail delivery requires SMTP)'}
                    </span>
                  </h2>
                  <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    Required for delivering emails to real external inboxes (Gmail, Yahoo, Outlook, etc.). Supports Gmail App Passwords, Brevo, Resend, SendGrid, or custom SMTP.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>SMTP Host</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. smtp.gmail.com or smtp-relay.brevo.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>SMTP Port</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="587 or 465"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(parseInt(e.target.value, 10))}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>SMTP Username / Email</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="yourname@gmail.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>SMTP Password / App Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="16-digit App Password or API Key"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                    />
                    Use SSL/TLS (Default ON for port 465)
                  </label>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="email"
                        className="input-field"
                        placeholder="your_personal@gmail.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        style={{ width: '220px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleTestSmtp}
                        disabled={testingSmtp}
                        style={{ padding: '0.45rem 0.95rem', borderRadius: '10px', fontSize: '0.82rem' }}
                      >
                        {testingSmtp ? 'Testing...' : 'Send Test Email'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={savingSmtp}
                      style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem' }}
                    >
                      {savingSmtp ? 'Saving...' : 'Save SMTP Settings'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* User List Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>User Management</h2>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexGrow: 1, maxWidth: '400px', width: '100%' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search user by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.95rem', color: '#fff', fontSize: '0.85rem', width: '100%' }}
                  />
                  <button className="btn-secondary" style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }} onClick={fetchUsers}>
                    Refresh
                  </button>
                </div>
              </div>

              {/* Table / List Container */}
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                {usersLoading ? (
                  <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="shimmer" style={{ height: '35px', width: '100%' }}></div>
                    <div className="shimmer" style={{ height: '50px', width: '100%' }}></div>
                    <div className="shimmer" style={{ height: '50px', width: '100%' }}></div>
                    <div className="shimmer" style={{ height: '50px', width: '100%' }}></div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h4>No Users Found</h4>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No users match the search criteria or database is empty.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.95rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Email</th>
                        <th style={{ padding: '0.95rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined Date</th>
                        <th style={{ padding: '0.95rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                        <th style={{ padding: '0.95rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const statusColors = {
                          pending: { text: '#a855f7', bg: 'rgba(147, 51, 234, 0.08)', border: '1px solid rgba(147, 51, 234, 0.15)' },
                          approved: { text: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' },
                          rejected: { text: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)' }
                        };
                        const config = statusColors[user.status] || statusColors.pending;

                        return (
                          <tr key={user._id} className="admin-user-row" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s ease' }}>
                            <td style={{ padding: '0.95rem 1.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                              {user.email}
                            </td>
                            <td style={{ padding: '0.95rem 1.25rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                              {new Date(user.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.95rem 1.25rem' }}>
                              <span style={{ 
                                display: 'inline-flex',
                                fontSize: '0.75rem', 
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: config.text, 
                                background: config.bg, 
                                border: config.border,
                                borderRadius: '99px',
                                padding: '0.2rem 0.65rem'
                              }}>
                                {user.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.95rem 1.25rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button 
                                  className="btn-secondary" 
                                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--primary-hover)', borderColor: 'rgba(168, 85, 247, 0.2)', background: 'rgba(168, 85, 247, 0.03)' }} 
                                  onClick={() => impersonateUser(user._id)}
                                >
                                  View Activity
                                </button>
                                {user.status !== 'approved' && (
                                  <button 
                                    className="btn-primary" 
                                    style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', background: 'var(--success)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)' }} 
                                    onClick={() => updateUserStatus(user._id, 'approved')}
                                  >
                                    Approve
                                  </button>
                                )}
                                {user.status !== 'rejected' && (
                                  <button 
                                    className="btn-secondary" 
                                    style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.03)' }} 
                                    onClick={() => updateUserStatus(user._id, 'rejected')}
                                  >
                                    Reject
                                  </button>
                                )}
                                <button 
                                  className="btn-danger" 
                                  style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }} 
                                  onClick={() => deleteUser(user._id, user.email)}
                                  title="Delete User"
                                >
                                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
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

      {/* Admin specific inline CSS helper */}
      <style dangerouslySetInnerHTML={{__html: `
        .admin-user-row:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .auto-approve-card:hover {
          border-color: rgba(16, 185, 129, 0.5) !important;
          transform: translateY(-2px);
        }
      `}} />
    </>
  );
}
