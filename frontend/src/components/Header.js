import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

function Header({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsLogoutConfirmOpen(false);
  }, [location.pathname, user?.role]);

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
          { to: '/admin/customers', label: 'Khách hàng' },
          { to: '/admin/appointments', label: 'Lịch hẹn' },
          { to: '/admin/analytics', label: 'Phân tích' }
        ]
      };
    }

    if (user.role === 'staff') {
      return {
        label: 'Công việc',
        links: [
          { to: '/staff/appointments', label: 'Lịch hẹn' },
          { to: '/staff/customers', label: 'Khách hàng' }
        ]
      };
    }

    return {
      label: 'Tài khoản',
      links: [
        { to: '/my-appointments', label: 'Lịch của tôi' },
        { to: '/profile', label: 'Hồ sơ' }
      ]
    };
  }, [user]);

  const isActivePath = (to) => {
    if (to === '/') {
      return location.pathname === '/';
    }

    return location.pathname.startsWith(to);
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.role === 'admin') return 'Quản trị viên';
    if (user.role === 'staff') return 'Nhân viên';
    return 'Khách hàng';
  };

  const renderNavLink = (link, extraClass = '') => (
    <Link
      key={link.to}
      to={link.to}
      onClick={closeMenus}
      className={`nav-link ${isActivePath(link.to) ? 'is-active' : ''} ${extraClass}`.trim()}
    >
      {link.label}
    </Link>
  );

  return (
    <>
      <header className="header">
        <div className="header-container">
          <div className="header-brand-row">
            <Link to="/" className="logo" aria-label="Trang chủ BeautyBook" onClick={closeMenus}>
              <span className="logo-mark">BB</span>
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
                  <div className="user-menu">
                    <span className="user-name">{user.name}</span>
                    <small>{getRoleLabel()}</small>
                  </div>
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