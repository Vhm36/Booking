import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import HeaderNotifications from './HeaderNotifications';
import { API_ORIGIN } from '../../services/api';
import './Header.css';

const HEADER_SCROLL_THRESHOLD = 24;

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function Header({ user, onLogout, presenceStatus = 'offline' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsLogoutConfirmOpen(false);
  }, [location.pathname, user?.role]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > HEADER_SCROLL_THRESHOLD);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isLogoutConfirmOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsLogoutConfirmOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isLogoutConfirmOpen]);

  const confirmLogout = () => {
    setIsMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsLogoutConfirmOpen(false);
    onLogout();
    navigate('/');
  };

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsRoleMenuOpen(false);
  };

  const primaryLinks = useMemo(
    () => [
      { to: '/', label: 'Trang chủ' },
      { to: '/services', label: 'Dịch vụ' }
    ],
    []
  );

  const roleConfig = useMemo(() => {
    if (!user) {
      return { label: '', links: [] };
    }

    if (user.role === 'admin') {
      return {
        label: 'Quản trị',
        links: [
          { to: '/admin/dashboard', label: 'Tổng quan' },
          { to: '/admin/services', label: 'Dịch vụ' },
          { to: '/admin/staff', label: 'Nhân viên' },
          { to: '/admin/vouchers', label: 'Voucher' },
          { to: '/admin/appointments', label: 'Lịch hẹn' },
          { to: '/admin/schedule', label: 'Lịch NV' },
          { to: '/admin/analytics', label: 'Phân tích' },
          { to: '/profile', label: 'Hồ sơ' }
        ]
      };
    }

    if (user.role === 'staff') {
      const isCashier = ['thu ngan', 'quan ly'].includes(normalizeRoleName(user.staff_role_name));

      if (isCashier) {
        return {
          label: 'Thu ngân',
          links: [
            { to: '/staff/dashboard', label: 'Quản lý lịch hẹn' },
            { to: '/profile', label: 'Hồ sơ' }
          ]
        };
      }

      return {
        label: 'Nhân viên dịch vụ',
        links: [
          { to: '/staff/dashboard', label: 'Lịch làm việc' },
          { to: '/staff/shifts', label: 'Ca làm' },
          { to: '/profile', label: 'Hồ sơ' }
        ]
      };
    }

    return {
      label: 'Tài khoản',
      links: [
        { to: '/my-appointments', label: 'Lịch của tôi' },
        { to: '/my-vouchers', label: 'Voucher' },
        { to: '/profile', label: 'Hồ sơ' }
      ]
    };
  }, [user]);

  const isActivePath = (link) => {
    const to = typeof link === 'string' ? link : link.to;
    const exact = typeof link === 'object' && link.exact;

    if (to === '/' || exact) {
      return location.pathname === to;
    }

    return location.pathname.startsWith(to);
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.role === 'admin') return 'Quản trị viên';
    if (user.role === 'staff') {
      const isCashier = ['thu ngan', 'quan ly'].includes(normalizeRoleName(user.staff_role_name));
      return isCashier ? 'Thu ngân' : 'Nhân viên dịch vụ';
    }
    return 'Khách hàng';
  };

  const isUserOnline = presenceStatus === 'online';

  const renderNavLink = (link, extraClass = '') => (
    <Link
      key={link.to}
      to={link.to}
      onClick={closeMenus}
      className={`nav-link ${isActivePath(link) ? 'is-active' : ''} ${extraClass}`.trim()}
    >
      {link.label}
    </Link>
  );

  return (
    <>
      <header className={`header ${isScrolled ? 'is-scrolled' : ''}`.trim()}>
        <div className="header-container">
          <div className="header-brand-row">
            <Link to="/" className="logo" aria-label="Trang chủ BeautyBook" onClick={closeMenus}>
              <img src="/icons/logo_1.jpg" alt="BeautyBook Logo" className="logo-img" />
              <span className="logo-text">
                <strong>BeautyBook</strong>
                <small>Đặt lịch nhanh trong vài giây</small>
              </span>
            </Link>

            <button
              type="button"
              className={`menu-toggle ${isMenuOpen ? 'is-open' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={isMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
              aria-expanded={isMenuOpen}
              aria-controls="header-panel"
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <div id="header-panel" className={`header-panel ${isMenuOpen ? 'is-open' : ''}`}>
            <div className="header-nav-shell">
              <nav className="nav nav-desktop">{primaryLinks.map((link) => renderNavLink(link))}</nav>

              {roleConfig.links.length > 0 && (
                <div className={`role-menu ${isRoleMenuOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="role-menu-trigger"
                    onClick={() => setIsRoleMenuOpen((prev) => !prev)}
                    aria-expanded={isRoleMenuOpen}
                    aria-haspopup="true"
                  >
                    <span>{roleConfig.label}</span>
                    <small>{roleConfig.links.length}</small>
                  </button>

                  <div className="role-dropdown">
                    {roleConfig.links.map((link) => renderNavLink(link, 'role-link'))}
                  </div>
                </div>
              )}

              <div className="nav-mobile-sections">
                <div className="nav-section">
                  <span className="nav-section-label">Đi nhanh</span>
                  <div className="nav-section-links">{primaryLinks.map((link) => renderNavLink(link))}</div>
                </div>

                {roleConfig.links.length > 0 && (
                  <div className="nav-section">
                    <span className="nav-section-label">{roleConfig.label}</span>
                    <div className="nav-section-links">
                      {roleConfig.links.map((link) => renderNavLink(link))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="header-actions">
              {user ? (
                <>
                  <HeaderNotifications user={user} navigate={navigate} onNavigate={closeMenus} />
                  <Link to="/profile" className="user-menu" onClick={closeMenus}>
                    <span className="user-avatar-presence">
                      {user.avatar ? (
                        <img
                          src={`${API_ORIGIN}${user.avatar}`}
                          alt={user.name}
                          className="user-avatar-small"
                        />
                      ) : (
                        <span className="user-avatar-placeholder">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span
                        className={`user-presence-dot ${isUserOnline ? 'is-online' : 'is-offline'}`}
                        title={isUserOnline ? 'Đang hoạt động' : 'Không hoạt động'}
                        aria-label={isUserOnline ? 'Đang hoạt động' : 'Không hoạt động'}
                      />
                    </span>
                    <div className="user-menu-info">
                      <span className="user-name">{user.name}</span>
                      <small>{getRoleLabel()}</small>
                    </div>
                  </Link>
                  <button type="button" onClick={() => setIsLogoutConfirmOpen(true)} className="btn-logout">
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-login" onClick={closeMenus}>
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="btn-register" onClick={closeMenus}>
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {isLogoutConfirmOpen && (
        <div className="logout-confirm-overlay" onClick={() => setIsLogoutConfirmOpen(false)}>
          <div
            className="logout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="logout-confirm-title" className="logout-confirm-title">
              Bạn có muốn đăng xuất?
            </p>
            <div className="logout-confirm-actions">
              <button type="button" className="btn-logout-confirm" onClick={confirmLogout}>
                Có
              </button>
              <button
                type="button"
                className="btn-logout-cancel"
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                Không
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
