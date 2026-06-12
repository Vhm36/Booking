import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './RoleSidebar.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const Icon = ({ name }) => {
  const icons = {
    dashboard: (
      <>
        <path d="M4 4h7v7H4z" />
        <path d="M15 4h5v7h-5z" />
        <path d="M4 15h7v5H4z" />
        <path d="M15 15h5v5h-5z" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4 8h16" />
        <path d="M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      </>
    ),
    service: (
      <>
        <path d="M6 19h12" />
        <path d="M7 15a5 5 0 0 1 10 0" />
        <path d="M12 4v3" />
        <path d="M9 7h6" />
      </>
    ),
    staff: (
      <>
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M3 20a5 5 0 0 1 10 0" />
        <path d="M13 19a4 4 0 0 1 7 0" />
      </>
    ),
    customer: (
      <>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    voucher: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h16v5a2 2 0 0 0 0 4v5H6a2 2 0 0 1-2-2v-5a2 2 0 0 0 0-4z" />
        <path d="M10 9h.01" />
        <path d="M16 15h.01" />
        <path d="M17 8l-8 8" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h18" />
        <path d="M8 16v-5" />
        <path d="M13 16V8" />
        <path d="M18 16v-9" />
      </>
    ),
    leave: (
      <>
        <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" />
        <path d="M9 9h6" />
        <path d="M9 12h4" />
      </>
    ),
    profile: (
      <>
        <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </>
    )
  };

  return (
    <svg className="role-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.dashboard}
    </svg>
  );
};

const getRoleLabel = (user) => {
  if (user?.role === 'admin') return 'Quản trị viên';
  if (user?.role === 'staff') {
    return normalizeRoleName(user.staff_role_name) === 'thu ngan' ? 'Thu ngân' : 'Nhân viên dịch vụ';
  }
  return 'Tài khoản';
};

const getNavItems = (user) => {
  if (user?.role === 'admin') {
    return [
      { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/admin/appointments', label: 'Lịch hẹn', icon: 'calendar' },
      { to: '/admin/schedule', label: 'Lịch nhân viên', icon: 'calendar' },
      { to: '/admin/services', label: 'Dịch vụ', icon: 'service' },

      { to: '/admin/vouchers', label: 'Voucher', icon: 'voucher' },
      { to: '/admin/staff', label: 'Nhân sự', icon: 'staff' },
      { to: '/admin/staff-leave', label: 'Ca làm', icon: 'leave' },
      { to: '/admin/analytics', label: 'Báo cáo', icon: 'analytics' },
      { to: '/profile', label: 'Cài đặt', icon: 'profile' }
    ];
  }

  if (
    user?.role === 'staff' &&
    ['thu ngan', 'quan ly'].includes(normalizeRoleName(user.staff_role_name))
  ) {
    return [
      { to: '/staff/dashboard', label: 'Lịch hẹn', icon: 'calendar' },
      { to: '/staff/shifts', label: 'Ca làm', icon: 'leave' },
      { to: '/profile', label: 'Cài đặt', icon: 'profile' }
    ];
  }

  return [
    { to: '/staff/dashboard', label: 'Lịch làm việc', icon: 'calendar' },
    { to: '/staff/shifts', label: 'Ca làm', icon: 'leave' },
    { to: '/profile', label: 'Cài đặt', icon: 'profile' }
  ];
};

function RoleSidebar({ user, onLogout, presenceStatus = 'offline' }) {
  const navigate = useNavigate();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const navItems = useMemo(() => getNavItems(user), [user]);
  const userInitial = (user?.name || 'B').charAt(0).toUpperCase();
  const isUserOnline = presenceStatus === 'online';

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onLogout();
    navigate('/');
  };

  if (!user || !['admin', 'staff'].includes(user.role)) {
    return null;
  }

  return (
    <>
    <aside className="role-sidebar" aria-label="Điều hướng quản trị và nhân viên">
      <NavLink to="/" className="role-sidebar__brand" aria-label="Trang chủ BeautyBook">
        <span className="role-sidebar__logo-wrap">
          <img src="/icons/logo_1.jpg" alt="" className="role-sidebar__logo" />
        </span>
        <span className="role-sidebar__brand-copy">
          <strong>BeautyBook</strong>
          <small>{getRoleLabel(user)}</small>
        </span>
      </NavLink>

      <nav className="role-sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `role-sidebar__link${isActive ? ' role-sidebar__link--active' : ''}`
            }
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="role-sidebar__account">
        <NavLink to="/profile" className="role-sidebar__user">
          <span className="role-sidebar__avatar-wrap">
            {user.avatar ? (
              <img src={`${API_URL}${user.avatar}`} alt={user.name} className="role-sidebar__avatar" />
            ) : (
              <span className="role-sidebar__avatar-placeholder">{userInitial}</span>
            )}
            <span
              className={`role-sidebar__presence-dot ${isUserOnline ? 'is-online' : 'is-offline'}`}
              title={isUserOnline ? 'Đang hoạt động' : 'Không hoạt động'}
              aria-label={isUserOnline ? 'Đang hoạt động' : 'Không hoạt động'}
            />
          </span>
          <span className="role-sidebar__user-copy">
            <strong>{user.name || 'BeautyBook'}</strong>
            <small>{getRoleLabel(user)}</small>
          </span>
        </NavLink>

        <button type="button" className="role-sidebar__logout" onClick={handleLogout}>
          <Icon name="logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>

    {isLogoutConfirmOpen && (
      <div
        className="role-sidebar__logout-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-sidebar-logout-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsLogoutConfirmOpen(false);
          }
        }}
      >
        <div className="role-sidebar__logout-modal">
          <div>
            <p className="role-sidebar__logout-kicker">Xác nhận</p>
            <h2 id="role-sidebar-logout-title">Bạn có muốn đăng xuất?</h2>
            <span>Phiên làm việc hiện tại sẽ kết thúc và bạn sẽ quay về trang chủ.</span>
          </div>
          <div className="role-sidebar__logout-actions">
            <button type="button" className="role-sidebar__logout-cancel" onClick={() => setIsLogoutConfirmOpen(false)}>
              Ở lại
            </button>
            <button type="button" className="role-sidebar__logout-confirm" onClick={confirmLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default RoleSidebar;
