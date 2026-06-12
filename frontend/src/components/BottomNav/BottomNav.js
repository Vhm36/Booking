import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import VoucherIcon from '../VoucherIcon';
import './BottomNav.css';

const NAV_ITEMS = [
  { path: '/', icon: 'HN', label: 'Trang chủ', exact: true },
  { path: '/services', icon: 'DV', label: 'Dịch vụ' },
  { path: '/booking', icon: '+', label: 'Đặt lịch', primary: true },
  { path: '/my-vouchers', icon: 'voucher', label: 'Voucher' },
  { path: '/my-appointments', icon: 'LH', label: 'Lịch hẹn' }
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin/dashboard', icon: 'DB', label: 'Tổng quan' },
  { path: '/admin/appointments', icon: 'LH', label: 'Lịch hẹn' },
  { path: '/admin/schedule', icon: 'LC', label: 'Lịch NV' },
  { path: '/admin/staff', icon: 'NV', label: 'Nhân viên' }
];

const STAFF_NAV_ITEMS = [
  { path: '/staff/dashboard', icon: 'LV', label: 'Lịch' },
  { path: '/staff/shifts', icon: 'CL', label: 'Ca làm' },
  { path: '/profile', icon: 'TK', label: 'Tài khoản' }
];

const CASHIER_NAV_ITEMS = [
  { path: '/staff/dashboard', icon: 'LH', label: 'Lịch' },
  { path: '/staff/shifts', icon: 'CL', label: 'Ca làm' },
  { path: '/profile', icon: 'TK', label: 'Tài khoản' }
];

const isActivePath = (pathname, item) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
};

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const getNavItems = () => {
    if (user.role === 'admin') return ADMIN_NAV_ITEMS;
    if (user.role === 'staff') {
      if (normalizeRoleName(user.staff_role_name).includes('thu ngan')) {
        return CASHIER_NAV_ITEMS;
      }
      return STAFF_NAV_ITEMS;
    }
    return NAV_ITEMS;
  };

  const items = getNavItems();
  const renderNavIcon = (item) => {
    if (item.icon === 'voucher') {
      return <VoucherIcon className="bottom-nav__svg-icon" />;
    }

    return item.icon;
  };

  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính">
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
            <span className="bottom-nav__icon" aria-hidden="true">{renderNavIcon(item)}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
