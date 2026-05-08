import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const NAV_ITEMS = [
  { path: '/', icon: 'HN', label: 'Home', exact: true },
  { path: '/services', icon: 'DV', label: 'Dich vu' },
  { path: '/booking', icon: '+', label: 'Dat lich', primary: true },
  { path: '/my-vouchers', icon: '%', label: 'Voucher' },
  { path: '/my-appointments', icon: 'LH', label: 'Lich hen' }
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin/dashboard', icon: 'DB', label: 'Dash' },
  { path: '/admin/appointments', icon: 'LH', label: 'Lich' },
  { path: '/admin/schedule', icon: '📅', label: 'Lich NV' },
  { path: '/admin/staff', icon: 'NV', label: 'Nhan vien' },
  { path: '/admin/customers', icon: 'KH', label: 'Khach' }
];

const STAFF_NAV_ITEMS = [
  { path: '/staff/dashboard', icon: 'DB', label: 'Dash' },
  { path: '/my-appointments', icon: 'LH', label: 'Lich' },
  { path: '/profile', icon: 'TK', label: 'Tai khoan' }
];

const isActivePath = (pathname, item) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
};

function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const getNavItems = () => {
    if (user.role === 'admin') return ADMIN_NAV_ITEMS;
    if (user.role === 'staff') return STAFF_NAV_ITEMS;
    return NAV_ITEMS;
  };

  const items = getNavItems();

  return (
    <nav className="bottom-nav" aria-label="Dieu huong chinh">
      {items.map((item) => {
        const isActive = isActivePath(location.pathname, item);
        return (
          <button
            key={item.path}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}${item.primary ? ' bottom-nav__item--primary' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
