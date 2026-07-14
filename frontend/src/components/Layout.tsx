/**
 * Layout component providing the app shell for authenticated users.
 *
 * Renders:
 * - A collapsible sidebar with role-based navigation (admin / support / org menus)
 * - A top navbar with language selector, notification bell (with polling), and user profile dropdown
 * - An edit-profile modal for updating name, username, email, photo, and password
 * - The main content area via React Router's Outlet equivalent (props.children)
 *
 * The sidebar highlights the active route and the notification bell polls every 10 seconds.
 */
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { userAPI, notificationAPI, extractArrayData, API_BASE_URL } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import { useModalEscape } from '../hooks/useModalEscape';
import './Layout.css';

// Describes a single notification from the backend API
interface NotificationItem {
  id: number;
  isRead: boolean;
  type: string;
  message: string;
  createdAt: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'fa' || i18n.language === 'ps';
  const { show, ToastContainer } = useSimpleToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUsersRolesMenu, setShowUsersRolesMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showReadNotifications, setShowReadNotifications] = useState(false);
  const [language, setLanguage] = useState(i18n.language === 'en' ? 'English' : i18n.language === 'fa' ? 'Dari' : 'Pashto');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    oldPassword: '',
    newPassword: '',
    photo: '' as string
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [oldPasswordError, setOldPasswordError] = useState('');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };

    if (showUserMenu || showNotificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, showNotificationDropdown]);

  // Close modal on Esc key press
  useModalEscape(() => handleCloseEditProfile(), showEditProfileModal);

  // Load notifications from backend
  const loadNotifications = async () => {
    if (user?.id && isAuthenticated) {
      try {
        const response = await notificationAPI.getAll(user.id);
                    setNotifications(extractArrayData<NotificationItem>(response.data));
        const countResponse = await notificationAPI.getUnreadCount(user.id);
              setUnreadCount(countResponse.data || 0);
      } catch (error) {
            }
    }
  };

  const notificationsLoaded = useRef(false);

  // Load notifications on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && user?.id && !notificationsLoaded.current) {
      notificationsLoaded.current = true;
      loadNotifications();
    }
  }, [user?.id, isAuthenticated]);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      // Optimistically remove from local state so it hides immediately (WhatsApp-like)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: unknown) {
      show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      await loadNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user?.id) {
      try {
              await notificationAPI.markAllAsRead(user.id);
              // Reload notifications immediately
        await loadNotifications();
      } catch (error: unknown) {
        show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      }
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    try {
      await notificationAPI.delete(notificationId);
      loadNotifications();
    } catch (error: unknown) {
        show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      }
  };

  const handleDeleteAllNotifications = async () => {
    if (user?.id) {
      try {
        await notificationAPI.deleteAll(user.id);
        loadNotifications();
      } catch (error: unknown) {
        show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    const langCode = lang === 'English' ? 'en' : lang === 'Dari' ? 'fa' : 'ps';
    i18n.changeLanguage(langCode);
    // Set document direction based on language
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
  };

  // Set initial direction on mount
  useEffect(() => {
    const langCode = i18n.language;
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
    }, [i18n.language]);

  const handleOpenEditProfile = () => {
    setEditFormData({
      fullName: user?.fullName || '',
      username: user?.username || '',
      email: user?.email || '',
      oldPassword: '',
      newPassword: '',
      photo: user?.photo || ''
    });
    setSelectedPhotoFile(null);
    setShowEditProfileModal(true);
    setShowUserMenu(false);
  };

  const handleCloseEditProfile = () => {
    setShowEditProfileModal(false);
    setEditFormData({
      fullName: user?.fullName || '',
      username: user?.username || '',
      email: user?.email || '',
      oldPassword: '',
      newPassword: '',
      photo: user?.photo || ''
    });
    setSelectedPhotoFile(null);
    setShowOldPassword(false);
    setShowNewPassword(false);
    setOldPasswordError('');
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (user?.id) {
        // Validate password fields if new password is provided
        if (editFormData.newPassword) {
          if (!editFormData.oldPassword && user?.role !== 'ADMIN') {
            setOldPasswordError(t('pleaseEnterOldPassword'));
            show('error', t('error'), t('pleaseEnterOldPassword'));
            return;
          }
          if (editFormData.newPassword.length < 8) {
            show('error', t('error'), t('newPasswordMinLength'));
            return;
          }
          // Change password using old password verification
          try {
            await userAPI.changePassword(user.id, editFormData.oldPassword || '', editFormData.newPassword);
          } catch (passwordError: unknown) {
            setOldPasswordError(t('oldPasswordIncorrect'));
            show('error', t('error'), t('oldPasswordIncorrect'));
            return;
          }
        }

        // Upload profile picture if a new file was selected
        let photoUrl = editFormData.photo;
        if (selectedPhotoFile) {
            const uploadRes = await userAPI.updateProfilePicture(user.id, selectedPhotoFile);
            photoUrl = uploadRes.data?.url || uploadRes.data?.photo || uploadRes.data || photoUrl;
            if (photoUrl && !photoUrl.startsWith('data:') && !photoUrl.startsWith('http')) {
              photoUrl = API_BASE_URL + photoUrl;
            }
          }

        // Update fullName, username, email, and photo
        await userAPI.update(user.id, {
          fullName: editFormData.fullName,
          username: editFormData.username,
          email: editFormData.email,
          photo: photoUrl
        });

        updateUser({
          fullName: editFormData.fullName,
          username: editFormData.username,
          email: editFormData.email,
          photo: photoUrl
        });

        show('success', t('success'), t('updateProfile'));
        handleCloseEditProfile();
      }
    } catch (error: unknown) {
          const message = error instanceof Error ? (error as any).response?.data?.message || error.message : t('somethingWentWrong');
          show('error', t('error'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isSupport = user?.role?.includes('SUPPORT') || isAdmin || (user?.role && user?.role !== 'ORGANIZATION' && user?.role !== 'USER');
  const isOrg = user?.role === 'ORGANIZATION' || user?.role === 'USER';

  return (
    <>
    <div className="layout">
      <a href="#main-content" className="skip-to-content">
        {t('skipToContent')}
      </a>
      <div className="layout-body">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div
            className="sidebar-overlay"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Left Sidebar */}
        <aside id="sidebar" className={`sidebar ${showSidebar ? 'open' : ''}`}>
          {/* Sidebar Header with Logo */}
          <div className="sidebar-header">
            <div className="logo">
              <img src="/logo.gif" alt={t('logo')} style={{ width: '32px', height: '32px', display: 'block' }} />
              <h2>{t('ticketSystem')}</h2>
            </div>
          </div>

          <nav className="nav">
            {isAdmin && (
              <>
                <Link to="/admin/dashboard" className={location.pathname === '/admin/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/admin/services" className={location.pathname === '/admin/services' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                  {t('services')}
                </Link>
                <div className="nav-group">
                  <button 
                    className="nav-group-toggle"
                    onClick={() => setShowUsersRolesMenu(!showUsersRolesMenu)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'inherit', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 24px',
                      width: '100%',
                      textAlign: isRtl ? 'right' : 'left',
                      fontSize: '15px',
                      fontWeight: 700,
                      letterSpacing: '0.3px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    {t('users')}
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      style={{ 
                        marginInlineStart: 'auto',
                        transform: showUsersRolesMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  {showUsersRolesMenu && (
                    <div className="nav-submenu" style={{ paddingLeft: '44px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Link 
                        to="/admin/create-role" 
                        className={location.pathname === '/admin/create-role' ? 'active' : ''}
                        style={{ fontSize: '13px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setShowSidebar(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        {t('addRole')}
                      </Link>
                      <Link 
                        to="/admin/create-user" 
                        className={location.pathname === '/admin/create-user' ? 'active' : ''}
                        style={{ fontSize: '13px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setShowSidebar(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="20" y1="8" x2="20" y2="14"></line>
                          <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        {t('addUser')}
                      </Link>
                    </div>
                  )}
                </div>
                <Link to="/admin/organizations" className={location.pathname === '/admin/organizations' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  {t('organizations')}
                </Link>
                <Link to="/admin/my-tickets" className={location.pathname === '/admin/my-tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('adminTickets')}
                </Link>
                <Link to="/admin/tickets" className={location.pathname === '/admin/tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('ticketManagement')}
                </Link>
                <Link to="/admin/reports" className={location.pathname === '/admin/reports' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  {t('reports')}
                </Link>
              </>
            )}
            {isSupport && !isAdmin && (
              <>
                <Link to="/support/dashboard" className={location.pathname === '/support/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/support/my-tickets" className={location.pathname === '/support/my-tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('myAssignedTickets')}
                </Link>
              </>
            )}
            {isOrg && (
              <>
                <Link to="/org/dashboard" className={location.pathname === '/org/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/org/tickets" className={location.pathname === '/org/tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('myTickets')}
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Content Wrapper - contains header and main content */}
        <div className="content-wrapper">
          {/* Top Header */}
          <header className="top-navbar">
            <button
              className="mobile-menu-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? 'Close sidebar menu' : 'Open sidebar menu'}
              aria-expanded={showSidebar}
              aria-controls="sidebar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="navbar-right" ref={null} style={{ width: 'auto', minWidth: '300px', overflow: 'visible' }}>
              {/* Language Selector */}
              <div className="language-selector">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="lang-select"
                >
                  <option value="English">{t('english')}</option>
                  <option value="Dari">{t('dari')}</option>
                  <option value="Pashto">{t('pashto')}</option>
                </select>
              </div>

              {/* Notifications */}
              <div className="notification-bell" ref={notificationRef}>
                <button
                  className="bell-btn"
                  onClick={() => { setShowNotificationDropdown(!showNotificationDropdown); if (!showNotificationDropdown) loadNotifications(); }}
                  aria-label={t('notifications')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="notification-dropdown">
                    <div className="notification-dropdown-header">
                      <h3>{t('notifications')}</h3>
                      {notifications.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="mark-all-read-btn"
                            onClick={handleMarkAllAsRead}
                          >
                            {t('markAllAsRead')}
                          </button>
                          <button
                            className="mark-all-read-btn"
                            onClick={handleDeleteAllNotifications}
                            style={{ borderColor: '#ef4444', color: '#ef4444' }}
                          >
                            {t('deleteAllNotifications')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tabs */}
                    <div className="notification-tabs">
                      <button
                        className={`notification-tab ${notificationTab === 'all' ? 'active' : ''}`}
                        onClick={() => setNotificationTab('all')}
                      >
                        {t('all')} ({notifications.length})
                      </button>
                      <button
                        className={`notification-tab ${notificationTab === 'unread' ? 'active' : ''}`}
                        onClick={() => setNotificationTab('unread')}
                      >
                        {t('unread')} ({unreadCount})
                      </button>
                    </div>

                    <div className="notification-dropdown-content">
                      {notifications.length === 0 ? (
                        <div className="no-notifications">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                          </svg>
                          <p>{t('noNotifications')}</p>
                        </div>
                      ) : (
                        (notificationTab === 'unread'
                          ? notifications.filter((n) => !n.isRead).slice(0, 5)
                          : [
                              ...notifications.filter((n) => !n.isRead),
                              ...(showReadNotifications ? notifications.filter((n) => n.isRead) : [])
                            ]
                        ).map((notification) => (
                          <div
                            key={notification.id}
                            className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                            onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                          >
                            <div className="notification-icon">
                              {notification.type === 'NEW_TICKET' && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                                  <path d="M12 5v14M5 12h14"></path>
                                </svg>
                              )}
                              {notification.type === 'ASSIGNMENT' && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="8.5" cy="7" r="4"></circle>
                                  <line x1="20" y1="8" x2="20" y2="14"></line>
                                  <line x1="23" y1="11" x2="17" y2="11"></line>
                                </svg>
                              )}
                              {notification.type === 'STATUS_CHANGE' && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                              )}
                              {notification.type === 'NEW_COMMENT' && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                              )}
                            </div>
                            <div className="notification-details">
                              <h4>{notification.type === 'NEW_TICKET' ? t('notificationNewTicket') : notification.type === 'ASSIGNMENT' ? t('notificationAssignment') : notification.type === 'STATUS_CHANGE' ? t('notificationStatusChange') : notification.type === 'NEW_COMMENT' ? t('notificationComment') : notification.type.replace('_', ' ')}</h4>
                              <p>{notification.message}</p>
                              <span className="notification-time">
                                {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              className="notification-dismiss"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(notification.id);
                              }}
                              aria-label={t('delete')}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                      {notificationTab === 'all' && notifications.filter((n) => n.isRead).length > 0 && (
                        <div className="notification-show-read-wrapper">
                          <button
                            className="notification-show-read"
                            onClick={() => setShowReadNotifications(!showReadNotifications)}
                          >
                              {showReadNotifications
                                ? t('hideRead')
                                : `${t('showRead')} (${notifications.filter((n) => n.isRead).length})`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="user-profile" ref={userMenuRef}>
                <button
                  className="profile-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="avatar">
                    {user?.photo ? (
                      <img src={user.photo} alt={t('profile')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <span>{user?.username?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{user?.username}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="dropdown-divider" style={{ margin: 0 }}></div>
                    <button className="dropdown-item" onClick={handleOpenEditProfile}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {t('editProfile')}
                    </button>
                    <button className="dropdown-item" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>
        </div>

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="fixed inset-0 bg-transparent bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-auto animate-fadeIn" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '20px', color: 'white' }}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-bold text-white">{t('changePassword')}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEditProfile}
                  style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: '4px' }}
                  aria-label={t('close')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditProfile} className="p-4">
                {/* Clickable Profile Picture */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div
                    onClick={() => document.getElementById('photo-input')?.click()}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {editFormData.photo ? (
                      <img
                        src={editFormData.photo}
                        alt={t('profile')}
                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                      />
                    ) : (
                      <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', fontWeight: 'bold', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                        {user?.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '0', right: '0', width: '36px', height: '36px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="photo-input"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                        if (!validTypes.includes(file.type)) {
                          show('error', t('error'), t('imageTypeNotSupported'));
                          e.target.value = '';
                          return;
                        }
                        setSelectedPhotoFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditFormData({ ...editFormData, photo: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>

                {/* Full Name field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fullName')}</label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Two fields in one row */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('username')}</label>
                    <input
                      type="text"
                      id="username"
                      value={editFormData.username}
                      onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="email" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('email')}</label>
                    <input
                      type="email"
                      id="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="oldPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('currentPassword')}</label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        id="oldPassword"
                        value={editFormData.oldPassword}
                        onChange={(e) => {
                          setEditFormData({ ...editFormData, oldPassword: e.target.value });
                          setOldPasswordError('');
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        placeholder={t('enterCurrentPassword')}
                        style={{ paddingRight: isRtl ? '12px' : '40px', paddingLeft: isRtl ? '40px' : '12px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        style={{ right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showOldPassword ? (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                    {oldPasswordError && (
                      <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{oldPasswordError}</p>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('newPassword')}</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={editFormData.newPassword}
                        onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        placeholder={t('enterNewPassword')}
                        minLength={8}
                        style={{ paddingRight: isRtl ? '12px' : '40px', paddingLeft: isRtl ? '40px' : '12px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        style={{ right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showNewPassword ? (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleCloseEditProfile}
                    className="w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-24 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#2b51b1' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isSubmitting ? t('submitting') : t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
    <ToastContainer />
    </>
  );
}
