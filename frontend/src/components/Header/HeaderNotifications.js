import React, { useEffect, useMemo, useRef, useState } from 'react';
import bookingService from '../../services/bookingService';
import voucherService from '../../services/voucherService';
import connectDashboardRealtime from '../../services/dashboardRealtimeService';

// const REFRESH_INTERVAL_MS = 60 * 1000; // Đã loại bỏ polling
const MAX_VISIBLE_NOTIFICATIONS = 12;

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const hasCancellationRequest = (appointment) =>
  Number(appointment?.cancellation_requested) === 1 && appointment?.status !== 'cancelled';

const isAwaitingStaffConfirmation = (appointment) =>
  appointment?.status === 'pending' && !hasCancellationRequest(appointment);

const toTimeLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.length >= 5 ? raw.slice(0, 5) : raw;
};

const getDatePart = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const date = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

const buildAppointmentDateTime = (appointment) => {
  const datePart = getDatePart(appointment?.appointment_date);
  const timePart = toTimeLabel(appointment?.appointment_time) || '00:00';

  if (!datePart) {
    return appointment?.created_at || new Date().toISOString();
  }

  return `${datePart}T${timePart}:00`;
};

const toTimestamp = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');

  return `ngày ${day} tháng ${month} năm ${year}, ${hour} giờ ${minute} phút`;
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'cash') return 'Tiền mặt';
  if (paymentMethod === 'banking') return 'Ngân hàng';
  if (paymentMethod === 'vietqr') return 'VietQR';
  if (paymentMethod === 'vnpay') return 'VNPay';
  return 'Thanh toán';
};

const getCustomerNotificationPath = (notification) => {
  if (notification.type === 'payment_paid' && notification.paymentId) {
    return `/payment-bill/${notification.paymentId}`;
  }

  if (notification.type === 'voucher') {
    return '/my-vouchers';
  }

  return '/my-appointments';
};

const getStaffActionPath = (user) => {
  if (user?.role === 'admin') {
    return '/admin/appointments';
  }

  return '/staff/dashboard';
};

const buildCustomerNotifications = (appointments = [], vouchers = []) => {
  const voucherNotifications = vouchers
    .filter((voucher) => ['active', 'expiring_soon'].includes(String(voucher.status || '').toLowerCase()))
    .map((voucher) => {
      const time = voucher.assigned_date || voucher.created_at || voucher.expiry_date || new Date().toISOString();
      const expiryLabel = voucher.expiry_date ? `Hết hạn ${formatDateTime(voucher.expiry_date)}` : '';
      const discountLabel = voucher.discount_label || voucher.description || 'Ưu đãi dành cho bạn';

      return {
        id: `voucher-${voucher.assignment_id || voucher.id}`,
        type: 'voucher',
        tone: 'voucher',
        title: `Bạn có voucher ${voucher.code}`,
        description: [discountLabel, expiryLabel].filter(Boolean).join(' - '),
        time,
        timestamp: toTimestamp(time),
        actionPath: '/my-vouchers'
      };
    });

  const confirmedNotifications = appointments
    .filter((appointment) => appointment.status === 'confirmed' && !hasCancellationRequest(appointment))
    .map((appointment) => {
      const time = appointment.updated_at || buildAppointmentDateTime(appointment);
      return {
        id: `confirmed-${appointment.id}`,
        type: 'appointment_confirmed',
        tone: 'success',
        title: `Lịch #${appointment.id} đã được xác nhận`,
        description: `${appointment.service_name || 'Dịch vụ'} - ${appointment.staff_name || 'Nhân viên'} - ${formatDateTime(buildAppointmentDateTime(appointment))}`,
        time,
        timestamp: toTimestamp(time),
        actionPath: '/my-appointments'
      };
    });

  const paidNotifications = appointments
    .filter((appointment) => appointment.payment_status === 'paid')
    .map((appointment) => {
      const time = appointment.payment_paid_at || appointment.payment_created_at || buildAppointmentDateTime(appointment);
      return {
        id: `paid-${appointment.payment_id || appointment.id}`,
        type: 'payment_paid',
        tone: 'paid',
        title: `Thanh toán lịch #${appointment.id} thành công`,
        description: `${formatVnd(appointment.payment_amount || appointment.total_amount)} - ${formatPaymentMethodLabel(
          appointment.payment_method
        )}`,
        time,
        timestamp: toTimestamp(time),
        paymentId: appointment.payment_id,
        actionPath: getCustomerNotificationPath({
          type: 'payment_paid',
          paymentId: appointment.payment_id
        })
      };
    });

  return [...paidNotifications, ...confirmedNotifications, ...voucherNotifications];
};

const buildStaffNotifications = (appointments = [], user) => {
  const actionPath = getStaffActionPath(user);

  const pendingNotifications = appointments
    .filter(isAwaitingStaffConfirmation)
    .map((appointment) => {
      const time = buildAppointmentDateTime(appointment);
      return {
        id: `staff-pending-${appointment.id}`,
        type: 'staff_pending',
        tone: 'urgent',
        title: `Lịch #${appointment.id} cần xác nhận nhanh`,
        description: `${appointment.customer_name || 'Khách hàng'} - ${
          appointment.service_name || 'Dịch vụ'
        } - ${formatDateTime(time)}`,
        time,
        timestamp: toTimestamp(time),
        actionPath,
        appointmentId: appointment.id,
        quickAction: 'confirm'
      };
    });

  const cancelNotifications = appointments
    .filter(hasCancellationRequest)
    .map((appointment) => {
      const time = appointment.cancellation_requested_at || buildAppointmentDateTime(appointment);
      return {
        id: `staff-cancel-${appointment.id}`,
        type: 'staff_cancel_request',
        tone: 'warning',
        title: `Yêu cầu hủy lịch #${appointment.id}`,
        description: `${appointment.customer_name || 'Khách hàng'} đang chờ xử lý - ${formatDateTime(
          buildAppointmentDateTime(appointment)
        )}`,
        time,
        timestamp: toTimestamp(time),
        actionPath
      };
    });

  return [...pendingNotifications, ...cancelNotifications];
};

function HeaderNotifications({ user, navigate, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const rootRef = useRef(null);
  const isCashier = user?.role === 'staff' && normalizeRoleName(user.staff_role_name) === 'thu ngan';

  const visibleNotifications = useMemo(
    () =>
      [...notifications]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_VISIBLE_NOTIFICATIONS),
    [notifications]
  );

  const notificationCount = notifications.length;

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!user) {
      setNotifications([]);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      if (user.role === 'customer') {
        const [appointmentsResult, vouchersResult] = await Promise.allSettled([
          bookingService.getMyBookings(),
          voucherService.getMyVouchers()
        ]);

        const appointments =
          appointmentsResult.status === 'fulfilled' ? appointmentsResult.value.data?.data || [] : [];
        const vouchers = vouchersResult.status === 'fulfilled' ? vouchersResult.value.data?.data || [] : [];

        setNotifications(buildCustomerNotifications(appointments, vouchers));
        return;
      }

      if (user.role === 'staff' || user.role === 'admin') {
        const response = await bookingService.getAllBookings({ limit: 100 });
        setNotifications(buildStaffNotifications(response.data?.data || [], user));
        return;
      }

      setNotifications([]);
    } catch (err) {
      setNotifications([]);
      setError('Không thể tải thông báo.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadNotifications();

    let socket;
    const initSocket = async () => {
      try {
        socket = await connectDashboardRealtime({
          onUpdate: () => loadNotifications({ silent: true })
        });
      } catch (err) {
        console.error('Lỗi kết nối Socket trong HeaderNotifications', err);
      }
    };
    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.staff_role_name]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    setStatusMessage('');
    if (nextOpen) {
      loadNotifications({ silent: notifications.length > 0 });
    }
  };

  const handleNavigate = (path) => {
    setIsOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const handleQuickConfirm = async (event, notification) => {
    event.stopPropagation();
    if (!notification.appointmentId) {
      return;
    }

    try {
      setActionLoadingId(notification.id);
      setStatusMessage('');
      await bookingService.updateBookingStatus(notification.appointmentId, 'confirmed');
      setStatusMessage('Đã xác nhận lịch hẹn.');
      await loadNotifications({ silent: true });
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Không thể xác nhận lịch hẹn.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        type="button"
        className={`notification-trigger ${notificationCount > 0 ? 'has-items' : ''}`}
        onClick={handleOpen}
        aria-label="Mở thông báo"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="notification-bell" aria-hidden="true">
          🔔
        </span>
        {notificationCount > 0 && (
          <span className="notification-badge">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="menu">
          <div className="notification-dropdown-head">
            <div>
              <strong>Thông báo</strong>
              <span>
                {user.role === 'customer'
                  ? 'Voucher, lịch xác nhận và thanh toán'
                  : isCashier
                    ? 'Lịch cần thu ngân xử lý'
                    : 'Lịch cần xác nhận nhanh'}
              </span>
            </div>
            <button type="button" onClick={() => loadNotifications()} disabled={loading}>
              Làm mới
            </button>
          </div>

          {statusMessage && <div className="notification-status-message">{statusMessage}</div>}
          {error && <div className="notification-error">{error}</div>}

          <div className="notification-list">
            {loading && visibleNotifications.length === 0 ? (
              <div className="notification-empty">Đang tải thông báo...</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-empty">Chưa có thông báo mới.</div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item tone-${notification.tone}`}
                  onClick={() => handleNavigate(notification.actionPath)}
                  role="menuitem"
                >
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-item-main">
                    <strong>{notification.title}</strong>
                    <small>{notification.description}</small>
                    <time>{formatDateTime(notification.time)}</time>
                  </span>
                  {notification.quickAction === 'confirm' && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="notification-quick-action"
                      onClick={(event) => handleQuickConfirm(event, notification)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          handleQuickConfirm(event, notification);
                        }
                      }}
                    >
                      {actionLoadingId === notification.id ? 'Đang xác nhận...' : 'Xác nhận nhanh'}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HeaderNotifications;
