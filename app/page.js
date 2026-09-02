'use client';

import { useState, useEffect, useRef } from 'react';
import LoginCartoon from './components/LoginCartoon';

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
  const [isImpersonated, setIsImpersonated] = useState(false);

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

  // Email Selection & Filtering state
  const [selectedEmailIds, setSelectedEmailIds] = useState([]);
  const [emailFilter, setEmailFilter] = useState('all'); // 'all', 'unread', 'read'

  // Email Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyRecipient, setReplyRecipient] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Compose New Email state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);

  // Resizable Panes state (Sidebar & List widths)
  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [listWidth, setListWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(null); // 'sidebar' | 'list' | null
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // General UI state
  const [toasts, setToasts] = useState([]);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef(null);
  const [focusedField, setFocusedField] = useState('');

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
    }, 3500);
  };

  // 1. Session check on mount & restore pane widths
  useEffect(() => {
    checkSession();
    try {
      const savedSidebar = localStorage.getItem('temp_mail_sidebar_width');
      const savedList = localStorage.getItem('temp_mail_list_width');
      if (savedSidebar) setSidebarWidth(Math.max(220, Math.min(500, parseInt(savedSidebar, 10))));
      if (savedList) setListWidth(Math.max(280, Math.min(650, parseInt(savedList, 10))));
    } catch (e) {}
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

  // Pane Resizing Drag Handlers
  const startResizing = (type) => (e) => {
    e.preventDefault();
    setIsDragging(type);
    const startX = e.clientX;
    const startSidebarWidth = sidebarWidth;
    const startListWidth = listWidth;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (type === 'sidebar') {
        const newWidth = Math.max(220, Math.min(500, startSidebarWidth + deltaX));
        setSidebarWidth(newWidth);
      } else if (type === 'list') {
        const newWidth = Math.max(280, Math.min(650, startListWidth + deltaX));
        setListWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      try {
        if (type === 'sidebar') localStorage.setItem('temp_mail_sidebar_width', sidebarWidth.toString());
        if (type === 'list') localStorage.setItem('temp_mail_list_width', listWidth.toString());
      } catch (e) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const checkSession = async () => {
    setCheckingSession(true);
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        setUser(data.user);
        setIsImpersonated(!!data.isImpersonated);
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
        addToast('SMS message deleted successfully');
      } else {
        addToast('Failed to delete SMS message', 'error');
      }
    } catch (err) {
      console.error('Error deleting SMS:', err);
      addToast('An error occurred while deleting', 'error');
    }
  };

  const copyTwilioNumber = () => {
    const num = (process.env.NEXT_PUBLIC_TWILIO_NUMBER || '+13342318047').trim();
    navigator.clipboard.writeText(num);
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
        setIsImpersonated(!!data.isImpersonated);
        addToast(authMode === 'login' ? 'Welcome back!' : 'Registered successfully!');
        if (data.user?.status === 'approved') {
          fetchInboxes();
        }
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
        setSelectedEmailIds([]);
        setIsComposeOpen(false);
        localStorage.removeItem('temp_mail_active_inbox');
        addToast('Logged out successfully.');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleExitImpersonation = async () => {
    try {
      const res = await fetch('/api/admin/impersonate/exit', { method: 'POST' });
      if (res.ok) {
        addToast('Exiting user account view...', 'success');
        window.location.href = '/admin';
      }
    } catch (err) {
      console.error('Failed to exit impersonation:', err);
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
        setSelectedEmailIds((prev) => prev.filter((item) => item !== id));
        if (selectedEmail && selectedEmail._id === id) {
          setSelectedEmail(null);
          setIsReplying(false);
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

  // Multi-Selection Toggle
  const handleToggleSelectEmail = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedEmailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select/Deselect All in filtered list
  const handleToggleSelectAll = () => {
    if (selectedEmailIds.length === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(filteredEmails.map((em) => em._id));
    }
  };

  // Bulk Delete Selected Emails
  const handleBulkDeleteEmails = async () => {
    if (selectedEmailIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedEmailIds.length} selected email(s)?`)) return;

    try {
      const res = await fetch('/api/emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedEmailIds }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) => prev.filter((em) => !selectedEmailIds.includes(em._id)));
        if (selectedEmail && selectedEmailIds.includes(selectedEmail._id)) {
          setSelectedEmail(null);
          setIsReplying(false);
        }
        addToast(`${data.deletedCount || selectedEmailIds.length} email(s) deleted successfully`);
        setSelectedEmailIds([]);
      } else {
        addToast(data.error || 'Failed to delete selected emails', 'error');
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      addToast('An error occurred while deleting emails', 'error');
    }
  };

  // Bulk Mark Read / Unread
  const handleBulkMarkRead = async (isRead) => {
    if (selectedEmailIds.length === 0) return;
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedEmailIds, isRead }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) =>
          prev.map((em) =>
            selectedEmailIds.includes(em._id) ? { ...em, isRead } : em
          )
        );
        if (selectedEmail && selectedEmailIds.includes(selectedEmail._id)) {
          setSelectedEmail((prev) => (prev ? { ...prev, isRead } : null));
        }
        addToast(`Marked ${selectedEmailIds.length} email(s) as ${isRead ? 'read' : 'unread'}`);
        setSelectedEmailIds([]);
      } else {
        addToast(data.error || 'Failed to update email status', 'error');
      }
    } catch (err) {
      console.error('Mark read error:', err);
      addToast('An error occurred while updating status', 'error');
    }
  };

  // Single Email Read / Unread toggle
  const handleToggleEmailReadStatus = async (id, isRead) => {
    try {
      setEmails((prev) =>
        prev.map((em) => (em._id === id ? { ...em, isRead } : em))
      );
      if (selectedEmail && selectedEmail._id === id) {
        setSelectedEmail((prev) => (prev ? { ...prev, isRead } : null));
      }

      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(`Marked as ${isRead ? 'read' : 'unread'}`);
      }
    } catch (err) {
      console.error('Failed to update read status:', err);
    }
  };

  // Open email and automatically mark as read
  const handleOpenEmail = async (email) => {
    setIsComposeOpen(false);
    setSelectedEmail(email);
    setIsReplying(false);
    setReplyBody('');

    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((em) => (em._id === email._id ? { ...em, isRead: true } : em))
      );
      try {
        await fetch('/api/emails', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: email._id, isRead: true }),
        });
      } catch (err) {
        console.error('Error marking email as read:', err);
      }
    }
  };

  // Start Reply Flow
  const handleStartReply = () => {
    if (!selectedEmail) return;
    const match = selectedEmail.from.match(/<([^>]+)>/) || [null, selectedEmail.from.trim()];
    const targetTo = match[1] || selectedEmail.from.trim();

    setReplyRecipient(targetTo);
    setReplySubject(selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`);
    setReplyBody('');
    setIsReplying(true);
  };

  // Send Reply Request
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyBody.trim()) {
      addToast('Please type a reply message', 'error');
      return;
    }
    setReplySending(true);

    try {
      const res = await fetch('/api/emails/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: activeInbox,
          to: replyRecipient,
          subject: replySubject,
          message: replyBody,
          quotedText: selectedEmail?.bodyText || '',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Reply sent successfully! 🚀');
        setIsReplying(false);
        setReplyBody('');
      } else {
        addToast(data.error || 'Failed to send reply', 'error');
      }
    } catch (err) {
      console.error('Reply send error:', err);
      addToast('An error occurred while sending reply', 'error');
    } finally {
      setReplySending(false);
    }
  };

  // Compose New Email Flow
  const handleOpenCompose = () => {
    setComposeFrom(activeInbox || (inboxes[0]?.address || ''));
    setComposeTo('');
    setComposeSubject('');
    setComposeMessage('');
    setSelectedEmail(null);
    setIsComposeOpen(true);
  };

  const handleSendCompose = async (e) => {
    e.preventDefault();
    if (!composeFrom || !composeTo.trim() || !composeMessage.trim()) {
      addToast('Please fill in sender, recipient, and message', 'error');
      return;
    }
    setComposeSending(true);

    try {
      console.log(`[API Hit]: POST /api/emails/send`);
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: composeFrom,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          message: composeMessage.trim(),
        }),
      });

      const data = await res.json();
      console.log(`[API Response]: POST /api/emails/send status=${res.status}`, data);

      if (res.ok && data.success) {
        addToast(data.message || `Email sent successfully to ${composeTo}! 🚀`, 'success');
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeMessage('');
      } else {
        addToast(data.error || 'Failed to send email', 'error');
      }
    } catch (err) {
      console.error('Send email error:', err);
      addToast('An error occurred while sending email', 'error');
    } finally {
      setComposeSending(false);
    }
  };

  const copyAddress = () => {
    if (!activeInbox) return;
    navigator.clipboard.writeText(activeInbox);
    setCopied(true);
    addToast('Copied address to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate read / unread counts
  const unreadCount = emails.filter((em) => !em.isRead).length;
  const readCount = emails.filter((em) => em.isRead).length;

  // Filtered emails based on selected tab
  const filteredEmails = emails.filter((em) => {
    if (emailFilter === 'unread') return !em.isRead;
    if (emailFilter === 'read') return em.isRead;
    return true;
  });

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

      {/* Impersonation Warning Banner */}
      {isImpersonated && (
        <div style={{
          width: '100%',
          background: 'rgba(147, 51, 234, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(147, 51, 234, 0.3)',
          padding: '0.65rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.85rem',
          fontWeight: '600',
          color: '#fff',
          zIndex: 9999,
          position: 'relative',
          animation: 'fadeInDown 0.4s ease'
        }}>
          <span>👀 Impersonating User: <strong style={{ color: 'var(--primary-hover)' }}>{user?.email}</strong></span>
          <button 
            onClick={handleExitImpersonation}
            className="btn-primary" 
            style={{ 
              padding: '0.35rem 0.85rem', 
              borderRadius: '8px', 
              fontSize: '0.75rem', 
              boxShadow: 'none',
              background: 'var(--primary)',
            }}
          >
            Exit and Return to Admin
          </button>
        </div>
      )}

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
              <span className="badge-new-dot" />
              Service Online
            </div>
          </div>
        </header>

        {/* Dynamic Body Content */}
        {!isAuthenticated ? (
          <section className="auth-container">
            <div className="glass-panel auth-card" style={{ maxWidth: '850px', width: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Main Heading & Mode Switcher */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 className="auth-title" style={{ textAlign: 'left', marginBottom: '0.25rem' }}>
                    {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                  </h2>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                    {authMode === 'login' ? 'Sign in to access your disposable temporary emails & SMS.' : 'Sign up to generate customized domains, SMS, and inboxes.'}
                  </p>
                </div>

                <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', padding: '0.35rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <button 
                    type="button" 
                    className={`btn-secondary ${authMode === 'login' ? 'btn-primary' : ''}`}
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', border: authMode === 'login' ? 'none' : 'transparent', background: authMode === 'login' ? 'var(--primary)' : 'transparent', color: authMode === 'login' ? '#fff' : 'var(--muted)' }}
                  >
                    Login
                  </button>
                  <button 
                    type="button" 
                    className={`btn-secondary ${authMode === 'signup' ? 'btn-primary' : ''}`}
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', border: authMode === 'signup' ? 'none' : 'transparent', background: authMode === 'signup' ? 'var(--primary)' : 'transparent', color: authMode === 'signup' ? '#fff' : 'var(--muted)' }}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {authError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--error)', padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '0.88rem', textAlign: 'center' }}>
                  {authError}
                </div>
              )}

              {/* Side-by-Side Cartoon Avatar & Inputs Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                
                {/* Left Side: Interactive Cartoon Characters */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem 1rem' }}>
                  <LoginCartoon 
                    isTypingEmail={focusedField === 'email'} 
                    isTypingPassword={focusedField === 'password'} 
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.75rem', fontWeight: 600 }}>
                    {focusedField === 'password' ? '🙈 Closing eyes for password privacy!' : focusedField === 'email' ? '👀 Watching your email input...' : '👋 Ready to secure your mailbox!'}
                  </span>
                </div>

                {/* Right Side: Auth Form Inputs */}
                <form onSubmit={handleAuthSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="name@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={authLoading}
                    style={{ height: '48px', marginTop: '0.5rem', width: '100%', fontSize: '0.95rem' }}
                  >
                    {authLoading ? <div className="loader-small"></div> : authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>
              </div>

            </div>
          </section>
        ) : user?.status === 'pending' || user?.status === 'rejected' ? (
          /* User is logged in but pending admin approval */
          <section className="auth-container">
            <div className="glass-panel auth-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ 
                background: user.status === 'rejected' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(147, 51, 234, 0.1)', 
                border: `1px solid ${user.status === 'rejected' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(147, 51, 234, 0.25)'}`, 
                borderRadius: '50%', 
                width: '64px', 
                height: '64px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {user.status === 'rejected' ? (
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--error)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary-hover)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <h2 className="auth-title" style={{ marginBottom: 0 }}>
                {user.status === 'rejected' ? 'Account Rejected' : 'Approval Pending'}
              </h2>

              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {user.status === 'rejected' 
                  ? 'Your account request was rejected by the administrator. Contact support if this is a mistake.' 
                  : 'Your account has been created and is currently pending administrator approval.'}
              </p>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem 1.25rem', width: '100%', fontSize: '0.85rem', color: '#fff' }}>
                Account: <strong style={{ color: user.status === 'rejected' ? 'var(--error)' : 'var(--primary-hover)' }}>{user.email}</strong>
              </div>

              <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </section>
        ) : (
          /* User is logged in and approved -> show dashboard */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            
            {/* Top Workspace Tab Switcher */}
            <div className="workspace-tabs-wrapper">
              <div className="workspace-tabs">
                <button
                  className={`workspace-tab ${activeTab === 'mail' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mail')}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Service
                </button>
                <button
                  className={`workspace-tab ${activeTab === 'sms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sms')}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  SMS Service
                </button>
              </div>
            </div>

            {activeTab === 'mail' ? (
              <>
                {/* Active Temporary Email Display Banner */}
                <div className="glass-panel address-display">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Active Temporary Address
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="address-text">{activeInbox || 'No active address selected'}</span>
                      {activeInbox && (
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
                      )}
                    </div>
                  </div>
                  <div className="address-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                      className="btn-primary" 
                      onClick={handleOpenCompose}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Compose Mail
                    </button>
                    {activeInbox && (
                      <button 
                        className="btn-danger" 
                        onClick={() => deleteInbox(activeInbox)}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                      >
                        Discard Address
                      </button>
                    )}
                  </div>
                </div>

                {/* Resizable 3-Column Workspace Layout */}
                <div className="resizable-workspace-layout">
                  
                  {/* Column 1: Left Sidebar (Custom resizable width) */}
                  {!isSidebarCollapsed ? (
                    <div className="sidebar-pane" style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}>
                      
                      {/* Compose Button */}
                      <button className="btn-compose" onClick={handleOpenCompose}>
                        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Compose New Mail
                      </button>

                      {/* Inbox Generator Panel */}
                      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="pane-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create Inbox</h3>
                          <button 
                            className="panel-ctrl-btn" 
                            onClick={() => setIsSidebarCollapsed(true)}
                            title="Collapse Sidebar"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                        </div>

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
                          <button 
                            className="btn-primary" 
                            onClick={() => createInbox('random')}
                            style={{ width: '100%', height: '46px', gap: '0.5rem' }}
                          >
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
                                    setSelectedEmail(null);
                                    setSelectedEmailIds([]);
                                    setIsReplying(false);
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
                  ) : (
                    /* Collapsed Sidebar Rail */
                    <div style={{ width: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <button 
                        className="glass-panel" 
                        onClick={() => setIsSidebarCollapsed(false)}
                        title="Expand Sidebar"
                        style={{ padding: '0.65rem 0.5rem', width: '100%', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary-hover)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button 
                        className="btn-primary" 
                        onClick={handleOpenCompose}
                        title="Compose New Mail"
                        style={{ width: '40px', height: '40px', padding: 0, borderRadius: '12px' }}
                      >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Splitter Resizer 1 (Between Sidebar & Email List) */}
                  {!isSidebarCollapsed && (
                    <div 
                      className={`pane-resizer ${isDragging === 'sidebar' ? 'active' : ''}`} 
                      onMouseDown={startResizing('sidebar')}
                      title="Drag horizontally to resize Sidebar"
                    >
                      <div className="pane-resizer-line" />
                    </div>
                  )}

                  {/* Column 2: Emails List (Custom resizable width) */}
                  <div className={`glass-panel inbox-list-pane ${selectedEmail || isComposeOpen ? 'hide-mobile-pane' : 'mobile-view-list'}`} style={{ width: `${listWidth}px`, flexShrink: 0 }}>
                    
                    {/* Pane Header with Title, Stats & Filter */}
                    <div className="pane-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="pane-title">
                          Emails
                          <span className="badge">{emails.length}</span>
                        </h2>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className="btn-primary"
                            onClick={handleOpenCompose}
                            style={{ padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Compose new mail"
                          >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Compose
                          </button>
                          {emails.length > 0 && (
                            <button 
                              onClick={() => fetchEmails(true)}
                              className="btn-secondary" 
                              style={{ padding: '0.25rem 0.55rem', borderRadius: '8px', fontSize: '0.78rem' }}
                              title="Manual refresh"
                            >
                              Refresh
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Tabs (All / Unread / Read) */}
                      {emails.length > 0 && (
                        <div className="email-filter-bar">
                          <button
                            className={`email-filter-btn ${emailFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setEmailFilter('all')}
                          >
                            All <span className="email-filter-badge">{emails.length}</span>
                          </button>
                          <button
                            className={`email-filter-btn ${emailFilter === 'unread' ? 'active' : ''}`}
                            onClick={() => setEmailFilter('unread')}
                          >
                            Unread <span className="email-filter-badge" style={{ color: unreadCount > 0 ? '#34d399' : 'inherit', fontWeight: unreadCount > 0 ? 800 : 600 }}>{unreadCount}</span>
                          </button>
                          <button
                            className={`email-filter-btn ${emailFilter === 'read' ? 'active' : ''}`}
                            onClick={() => setEmailFilter('read')}
                          >
                            Read <span className="email-filter-badge">{readCount}</span>
                          </button>
                        </div>
                      )}

                      {/* Bulk Actions Toolbar (Active when 1 or more emails are checked) */}
                      {selectedEmailIds.length > 0 && (
                        <div className="bulk-actions-toolbar">
                          <div className="bulk-actions-left">
                            <div 
                              className={`custom-checkbox ${selectedEmailIds.length === filteredEmails.length && filteredEmails.length > 0 ? 'checked' : ''}`}
                              onClick={handleToggleSelectAll}
                              title={selectedEmailIds.length === filteredEmails.length ? "Deselect All" : "Select All"}
                            >
                              {selectedEmailIds.length === filteredEmails.length && filteredEmails.length > 0 && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span>{selectedEmailIds.length} Selected</span>
                          </div>
                          <div className="bulk-actions-right">
                            <button 
                              className="bulk-btn"
                              onClick={() => handleBulkMarkRead(true)}
                              title="Mark selected as read"
                            >
                              Mark Read
                            </button>
                            <button 
                              className="bulk-btn"
                              onClick={() => handleBulkMarkRead(false)}
                              title="Mark selected as unread"
                            >
                              Mark Unread
                            </button>
                            <button 
                              className="bulk-btn bulk-btn-danger"
                              onClick={handleBulkDeleteEmails}
                              title="Delete selected emails"
                            >
                              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete ({selectedEmailIds.length})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Emails List Body */}
                    <div className="emails-scroll">
                      {emailsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="shimmer shimmer-card" />
                        ))
                      ) : filteredEmails.length === 0 ? (
                        <div className="empty-state">
                          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                          </svg>
                          <h3 style={{ fontSize: '1rem', color: '#fff' }}>
                            {emailFilter === 'unread' ? 'No Unread Messages' : emailFilter === 'read' ? 'No Read Messages' : 'No Messages Received'}
                          </h3>
                          <p style={{ fontSize: '0.8rem' }}>Waiting for emails... refreshes every 5 seconds.</p>
                        </div>
                      ) : (
                        filteredEmails.map((email, idx) => {
                          const isSelected = selectedEmail && selectedEmail._id === email._id;
                          const isChecked = selectedEmailIds.includes(email._id);
                          const isUnread = !email.isRead;
                          const timeStr = new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <div 
                              key={email._id} 
                              className={`email-card ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                              onClick={() => handleOpenEmail(email)}
                              style={{ animationDelay: `${idx * 0.04}s` }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                {/* Checkbox for bulk selection */}
                                <div 
                                  className={`custom-checkbox ${isChecked ? 'checked' : ''}`}
                                  onClick={(e) => handleToggleSelectEmail(email._id, e)}
                                  title={isChecked ? "Deselect email" : "Select email"}
                                  style={{ marginTop: '2px' }}
                                >
                                  {isChecked && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1, minWidth: 0 }}>
                                  <div className="email-card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                      {isUnread && <span className="badge-new-dot" title="Unread email" />}
                                      <span className="email-card-sender" title={email.from}>{email.from}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                      {isUnread && <span className="badge-unread-pill">NEW</span>}
                                      <span className="email-card-time">{timeStr}</span>
                                    </div>
                                  </div>
                                  <span className="email-card-subject" title={email.subject}>{email.subject}</span>
                                  <span className="email-card-preview">{email.bodyText || '(HTML message only)'}</span>
                                </div>
                              </div>

                              {/* Action Buttons on Card */}
                              <div className="email-card-actions" style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                  className="btn-card-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleEmailReadStatus(email._id, !email.isRead);
                                  }}
                                  title={email.isRead ? "Mark as unread" : "Mark as read"}
                                >
                                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </button>
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

                  {/* Splitter Resizer 2 (Between Email List & Reader/Composer) */}
                  <div 
                    className={`pane-resizer ${isDragging === 'list' ? 'active' : ''}`} 
                    onMouseDown={startResizing('list')}
                    title="Drag horizontally to resize Reader width"
                  >
                    <div className="pane-resizer-line" />
                  </div>

                  {/* Column 3: Email Reader OR New Email Composer (Flex 1 - Takes remaining space) */}
                  <div className="content-pane" style={{ flexGrow: 1, minWidth: '320px' }}>
                    {isComposeOpen ? (
                      /* Compose New Email Panel */
                      <div className="glass-panel compose-card">
                        <div className="compose-header">
                          <div className="compose-title">
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary-hover)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Compose New Email
                          </div>
                          <button 
                            className="panel-ctrl-btn"
                            onClick={() => setIsComposeOpen(false)}
                            title="Close Composer"
                          >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <form onSubmit={handleSendCompose} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flexGrow: 1 }}>
                          <div className="compose-field-group">
                            {/* Sender From Select */}
                            <div className="compose-field-row">
                              <span className="compose-field-label">From:</span>
                              <select 
                                className="compose-select"
                                value={composeFrom}
                                onChange={(e) => setComposeFrom(e.target.value)}
                                required
                              >
                                {inboxes.map((ib) => (
                                  <option key={ib._id} value={ib.address}>
                                    {ib.address}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Recipient To Input */}
                            <div className="compose-field-row">
                              <span className="compose-field-label">To:</span>
                              <input 
                                type="email"
                                className="compose-field-input"
                                placeholder="recipient@example.com"
                                value={composeTo}
                                onChange={(e) => setComposeTo(e.target.value)}
                                required
                                autoFocus
                              />
                            </div>

                            {/* Subject Input */}
                            <div className="compose-field-row">
                              <span className="compose-field-label">Subject:</span>
                              <input 
                                type="text"
                                className="compose-field-input"
                                placeholder="Subject"
                                value={composeSubject}
                                onChange={(e) => setComposeSubject(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Message Body Textarea */}
                          <textarea 
                            className="compose-textarea"
                            placeholder="Type your email message here..."
                            value={composeMessage}
                            onChange={(e) => setComposeMessage(e.target.value)}
                            required
                          />

                          {/* Action Buttons */}
                          <div className="compose-actions">
                            <button 
                              type="button" 
                              className="btn-secondary" 
                              onClick={() => setIsComposeOpen(false)}
                              style={{ padding: '0.5rem 1.25rem', borderRadius: '10px' }}
                            >
                              Discard
                            </button>
                            <button 
                              type="submit" 
                              className="btn-primary" 
                              disabled={composeSending}
                              style={{ padding: '0.5rem 1.5rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              {composeSending ? (
                                <>
                                  <div className="loader-small" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                  Send Email
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : selectedEmail ? (
                      /* Email Reader View */
                      <div className={`glass-panel email-reader-pane ${selectedEmail ? 'mobile-view-reader' : 'hide-mobile-pane'}`}>
                        {/* Back to list button for mobile */}
                        <button className="btn-back-mobile" onClick={() => setSelectedEmail(null)}>
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          Back to Inbox
                        </button>

                        <div className="reader-header">
                          <div className="reader-meta">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <h2 className="reader-subject">{selectedEmail.subject}</h2>
                              {!selectedEmail.isRead && (
                                <span className="badge-unread-pill">NEW</span>
                              )}
                            </div>
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
                          <div className="reader-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button 
                              className="btn-primary" 
                              onClick={handleStartReply}
                              style={{ padding: '0.4rem 0.95rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '10px' }}
                            >
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m-15-7l6-6m-6 6l6 6" />
                              </svg>
                              Reply
                            </button>
                            <button 
                              className="btn-secondary" 
                              onClick={() => handleToggleEmailReadStatus(selectedEmail._id, !selectedEmail.isRead)}
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '10px' }}
                            >
                              {selectedEmail.isRead ? 'Mark Unread' : 'Mark Read'}
                            </button>
                            <button 
                              className="btn-danger" 
                              onClick={() => deleteSingleEmail(selectedEmail._id)}
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '10px' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Reader Body */}
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

                        {/* Reply Message Composer Form */}
                        {isReplying && (
                          <div className="reader-reply-card">
                            <div className="reader-reply-header">
                              <div className="reader-reply-title">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary-hover)' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m-15-7l6-6m-6 6l6 6" />
                                </svg>
                                Reply Message
                              </div>
                              <button 
                                onClick={() => setIsReplying(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0.2rem' }}
                                title="Close reply composer"
                              >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            <div className="reader-reply-meta">
                              <div>From: <strong>{activeInbox}</strong></div>
                              <div>To: <strong>{replyRecipient}</strong></div>
                              <div>Subject: <strong>{replySubject}</strong></div>
                            </div>

                            {selectedEmail.bodyText && (
                              <div className="reader-reply-quote-preview">
                                <strong>Quoted:</strong> {selectedEmail.bodyText.substring(0, 180)}...
                              </div>
                            )}

                            <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <textarea 
                                className="reader-reply-textarea"
                                placeholder="Type your reply message here..."
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                required
                                autoFocus
                              />
                              <div className="reader-reply-actions">
                                <button 
                                  type="button" 
                                  className="btn-secondary" 
                                  onClick={() => setIsReplying(false)}
                                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', borderRadius: '10px' }}
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="submit" 
                                  className="btn-primary" 
                                  disabled={replySending}
                                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                                >
                                  {replySending ? (
                                    <>
                                      <div className="loader-small" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      Send Reply
                                    </>
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Empty State View */
                      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '480px', color: 'var(--muted)', gap: '0.75rem', textAlign: 'center' }}>
                        <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.75">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <h3 style={{ color: '#fff', fontSize: '1.1rem' }}>No Email Selected</h3>
                        <p style={{ fontSize: '0.85rem', maxWidth: '320px' }}>
                          Select an email from the list to view its contents, or click <strong>Compose</strong> to write a new email.
                        </p>
                        <button 
                          className="btn-primary" 
                          onClick={handleOpenCompose}
                          style={{ marginTop: '0.5rem', padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
                        >
                          Compose Mail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Active Phone Number Display Banner */}
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
                  </div>
                </div>

                {/* SMS Grid Workspace (Left Sidebar Info, Right SMS Content) */}
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
                    <div className="glass-panel inbox-list-pane" style={{ width: '100%', minHeight: '500px' }}>
                      <div className="pane-header">
                        <h2 className="pane-title">
                          Received SMS Messages
                          <span className="badge">{smsList.length}</span>
                        </h2>
                        {smsList.length > 0 && (
                          <button 
                            onClick={() => fetchSms(true)}
                            className="btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}
                            title="Manual refresh"
                          >
                            Refresh
                          </button>
                        )}
                      </div>

                      <div className="emails-scroll" style={{ maxHeight: '650px' }}>
                        {smsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="shimmer shimmer-card" />
                          ))
                        ) : smsList.length === 0 ? (
                          <div className="empty-state">
                            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <h3 style={{ fontSize: '1rem', color: '#fff' }}>No SMS Messages Received</h3>
                            <p style={{ fontSize: '0.8rem' }}>Send SMS to the temporary number above. Refreshes every 5 seconds.</p>
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
                                  <span className="email-card-sender" style={{ color: 'var(--primary-hover)', fontWeight: 700 }}>
                                    From: {sms.from}
                                  </span>
                                  <span className="email-card-time">{timeStr}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                  To: {sms.to}
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#fff', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                  {sms.body}
                                </div>
                                <div className="email-card-actions">
                                  <button 
                                    className="btn-card-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSms(sms._id);
                                    }}
                                    title="Delete SMS"
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
