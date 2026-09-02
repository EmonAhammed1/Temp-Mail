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

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Toast Notification Helper
  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
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
        addToast('Welcome Admin!', 'success');
        fetchUsers();
        fetchSettings();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setLoginError('An error occurred during admin login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    if (!confirm('Are you sure you want to log out from Admin Panel?')) return;
    try {
      const res = await fetch('/api/admin/auth/logout', { method: 'POST' });
      if (res.ok) {
        setIsAdminAuthenticated(false);
        setUsers([]);
        setUsername('');
        setPassword('');
        addToast('Admin logged out successfully.', 'success');
      }
    } catch (err) {
      console.error('Admin logout failed:', err);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        addToast('Failed to fetch users', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while fetching users', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserStatus = async (userId, newStatus) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) =>
          prev.map((user) => (user._id === userId ? { ...user, status: newStatus } : user))
        );
        addToast(`User status updated to ${newStatus}`, 'success');
      } else {
        addToast(data.error || 'Failed to update user status', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while updating status', 'error');
    }
  };

  const deleteUser = async (userId, email) => {
    if (!confirm(`Are you absolutely sure you want to permanently delete user "${email}"?\nThis will delete their account, all inboxes, and all received emails.`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((user) => user._id !== userId));
        addToast('User permanently deleted', 'success');
      } else {
        addToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while deleting user', 'error');
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
        addToast('Entering user account view...', 'success');
        window.location.href = '/';
      } else {
        addToast(data.error || 'Failed to enter user account', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred during impersonation', 'error');
    }
  };

  // Stats calculation
  const totalUsers = users.length;
  const pendingApprovals = users.filter((u) => u.status === 'pending').length;
  const activeUsers = users.filter((u) => u.status === 'approved').length;

  // Filter users by search query
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Initial loader
  if (checkingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', background: '#060608', color: '#fff' }}>
        <div className="loader-small" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Loading Admin Portal...</span>
      </div>
    );
  }

  return (
    <>
      {/* Background Animated Glows */}
      <div className="bg-glow-container">
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2" style={{ background: 'radial-gradient(circle, rgba(147, 51, 234, 0.05) 0%, transparent 70%)' }}></div>
      </div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-logo">
            Emons <span>Admin Panel</span>
          </h1>
          {isAdminAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              {/* Header Auto-Approve Toggle */}
              <button
                onClick={handleToggleAutoApprove}
                disabled={togglingAutoApprove}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.42rem 0.95rem',
                  background: autoApprove ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: autoApprove ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                  borderRadius: '10px',
                  cursor: togglingAutoApprove ? 'wait' : 'pointer',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  transition: 'all 0.25s ease',
                  userSelect: 'none',
                }}
                title={autoApprove ? "Click to disable Auto-Approve" : "Click to enable Auto-Approve"}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: autoApprove ? 'var(--success)' : 'var(--muted)',
                  boxShadow: autoApprove ? '0 0 8px var(--success)' : 'none',
                }} />
                <span>Auto-Approve: <strong style={{ color: autoApprove ? 'var(--success)' : 'var(--muted)' }}>{autoApprove ? 'ON' : 'OFF'}</strong></span>
                {/* Switch indicator */}
                <div style={{
                  width: '32px',
                  height: '18px',
                  background: autoApprove ? 'var(--success)' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '99px',
                  position: 'relative',
                  transition: 'background 0.25s ease',
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: autoApprove ? '16px' : '2px',
                    transition: 'left 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </button>

              <button className="btn-secondary" style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem' }} onClick={handleAdminLogout}>
                Log Out Admin
              </button>
            </div>
          )}
        </header>

        {/* Admin Login UI */}
        {!isAdminAuthenticated ? (
          <section className="auth-container">
            <div className="glass-panel auth-card">
              <h2 className="auth-title">Admin Login</h2>

              {loginError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--error)', padding: '0.85rem 1.15rem', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                  {loginError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="auth-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff' }}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loginLoading} style={{ marginTop: '0.5rem', height: '48px', width: '100%' }}>
                  {loginLoading ? <div className="loader-small"></div> : 'Sign In as Admin'}
                </button>
              </form>
            </div>
          </section>
        ) : (
          /* Admin Dashboard Content */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            
            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</span>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff' }}>{totalUsers}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem', color: 'var(--muted)' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-hover)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Approvals</span>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary-hover)' }}>{pendingApprovals}</span>
                </div>
                <div style={{ background: 'rgba(147, 51, 234, 0.08)', borderRadius: '12px', padding: '0.75rem', color: 'var(--primary-hover)' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Approved Users</span>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--success)' }}>{activeUsers}</span>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '0.75rem', color: 'var(--success)' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {/* Interactive Auto-Approval Card */}
              <div 
                className="glass-panel auto-approve-card" 
                onClick={handleToggleAutoApprove}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '1.25rem 1.5rem', 
                  border: autoApprove ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: autoApprove ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 15, 20, 0.7) 100%)' : 'var(--card-bg)',
                  cursor: togglingAutoApprove ? 'wait' : 'pointer',
                  transition: 'all 0.25s ease',
                  userSelect: 'none',
                }}
                title={autoApprove ? "Click to turn OFF auto-approval" : "Click to turn ON auto-approval"}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: autoApprove ? 'var(--success)' : 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Auto-Approval Mode
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.45rem', fontWeight: 800, color: autoApprove ? 'var(--success)' : '#fff' }}>
                      {autoApprove ? 'Enabled' : 'Disabled'}
                    </span>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: autoApprove ? 'var(--success)' : 'var(--muted)',
                      boxShadow: autoApprove ? '0 0 8px var(--success)' : 'none',
                      display: 'inline-block',
                    }} />
                  </div>
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
