import React, { useCallback, useEffect, useMemo, useState } from 'react';
import authService from '../../../services/authService';
import bookingService from '../../../services/bookingService';
import { exportToExcel } from '../../../utils/exportExcel';
import CustomerInsightBadge from '../../../components/CustomerInsightBadge/CustomerInsightBadge';
import './ManageAppointments.css';

const formatRating = (rating) => {
  const safeRating = Number(rating);
  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    return '-';
  }

  return `${'\u2605'.repeat(safeRating)}${'\u2606'.repeat(5 - safeRating)} (${safeRating}/5)`;
};

const hasCancellationRequest = (appointment) =>
  Number(appointment?.cancellation_requested) === 1 && appointment?.status !== 'cancelled';

const getDepositRequiredAmount = (appointment) => Number(appointment?.deposit_amount || 0);

const getDepositPaidAmount = (appointment) => {
  const required = getDepositRequiredAmount(appointment);
  const explicitPaid = Number(appointment?.deposit_paid_amount || 0);

  if (explicitPaid > 0) {
    return Math.min(required, explicitPaid);
  }

  if (appointment?.payment_status === 'paid') {
    return Math.min(required, Number(appointment?.payment_amount || 0));
  }

  return 0;
};

const getRemainingAmount = (appointment) => {
  if (typeof appointment?.remaining_amount !== 'undefined' && appointment?.remaining_amount !== null) {
    return Number(appointment.remaining_amount || 0);
  }

  return Math.max(Number(appointment?.total_amount || 0) - getDepositPaidAmount(appointment), 0);
};

const isAwaitingDeposit = (appointment) =>
  appointment?.status !== 'cancelled' &&
  Number(appointment?.deposit_required) === 1 &&
  getDepositRequiredAmount(appointment) > 0 &&
  getDepositPaidAmount(appointment) < getDepositRequiredAmount(appointment);

const isAwaitingStaffConfirmation = (appointment) =>
  appointment?.status === 'pending' && !hasCancellationRequest(appointment) && !isAwaitingDeposit(appointment);

const getDisplayStatus = (appointment) => {
  if (hasCancellationRequest(appointment)) {
    return 'Chờ xác nhận hủy';
  }

  if (isAwaitingDeposit(appointment)) {
    return 'Chờ đặt cọc VietQR';
  }

  const statusMap = {
    pending: 'Chờ nhân viên xác nhận',
    confirmed: 'Đã xác nhận làm',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };

  return statusMap[appointment?.status] || appointment?.status || 'Không rõ';
};

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isCashierStaffUser = (user) =>
  user?.role === 'staff' &&
  ['thu ngan', 'quan ly'].includes(normalizeRoleName(user?.staff_role_name));

const getStatusToneClass = (appointment) => {
  if (hasCancellationRequest(appointment)) {
    return 'status-pill-warning';
  }

  if (isAwaitingDeposit(appointment)) {
    return 'status-pill-warning';
  }

  if (appointment?.status === 'completed') {
    return 'status-pill-success';
  }

  if (appointment?.status === 'cancelled') {
    return 'status-pill-danger';
  }

  if (isAwaitingStaffConfirmation(appointment)) {
    return 'status-pill-pending';
  }

  return 'status-pill-neutral';
};

const getPaymentLabel = (appointment) => {
  if (isAwaitingDeposit(appointment)) {
    return appointment?.payment_status === 'pending' ? 'Chờ cọc VietQR' : 'Chưa đặt cọc';
  }

  if (
    Number(appointment?.deposit_required) === 1 &&
    getDepositRequiredAmount(appointment) > 0 &&
    getDepositPaidAmount(appointment) >= getDepositRequiredAmount(appointment) &&
    getRemainingAmount(appointment) > 0
  ) {
    return 'Đã cọc VietQR';
  }

  if (appointment?.payment_status === 'paid') {
    return 'Đã thanh toán';
  }

  if (appointment?.payment_status === 'failed') {
    return 'Thất bại';
  }

  if (appointment?.payment_status === 'pending') {
    return 'Chờ thanh toán';
  }

  return 'Chưa tạo';
};

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'cash') {
    return 'Tiền mặt';
  }

  if (paymentMethod === 'banking') {
    return 'Ngân hàng';
  }

  if (paymentMethod === 'vietqr') {
    return 'VietQR';
  }

  if (paymentMethod === 'vnpay') {
    return 'VNPay';
  }

  return paymentMethod ? String(paymentMethod).toUpperCase() : 'Chưa chọn';
};

const formatAppointmentSlot = (appointment) => {
  if (!appointment?.appointment_date) {
    return '-';
  }

  return `${new Date(appointment.appointment_date).toLocaleDateString('vi-VN')} • ${
    appointment?.appointment_time || '--:--'
  }`;
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

const parseServiceNames = (serviceName = '') =>
  String(serviceName || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const getCancelDialogConfig = (dialog) => {
  if (!dialog?.appointment) {
    return null;
  }

  switch (dialog?.type) {
    case 'cancel_appointment':
      return {
        type: 'cancel_appointment',
        title: 'Hủy lịch hẹn',
        message: 'Bạn đang chuẩn bị hủy lịch hẹn này.',
        confirmLabel: 'Xác nhận hủy',
        cancelLabel: 'Không',
        tone: 'danger'
      };
    case 'confirm_cancel':
      return {
        title: 'Xác nhận hủy lịch',
        message: 'Sau khi xác nhận, lịch hẹn của khách sẽ được chuyển sang trạng thái đã hủy.',
        confirmLabel: 'Xác nhận hủy',
        cancelLabel: 'Không',
        tone: 'danger'
      };
    case 'reject_cancel':
      return {
        title: 'Giữ lại lịch hẹn',
        message: 'Bạn có muốn giữ lại lịch này và đóng yêu cầu hủy hiện tại không?',
        confirmLabel: 'Giữ lịch',
        cancelLabel: 'Không',
        tone: 'neutral'
      };
    default:
      return null;
  }
};

function ManageAppointments() {
  const currentUser = authService.getUser();
  const isStaffView = currentUser?.role === 'staff';
  const isCashierView = isCashierStaffUser(currentUser);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [serverStats, setServerStats] = useState(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingService.getAllBookings({ page, limit: 50, status: filter });
      setAppointments(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, total: 0, totalPages: 1 });
      setServerStats(response.data.stats || null);
      setError('');
    } catch (err) {
      const apiMessage =
        typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      setError(apiMessage || 'Không thể tải danh sách lịch hẹn.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const stats = useMemo(() => {
    const fallbackStats = {
      total: appointments.length,
      depositPending: appointments.filter((item) => isAwaitingDeposit(item)).length,
      pending: appointments.filter((item) => isAwaitingStaffConfirmation(item)).length,
      confirmed: appointments.filter((item) => item.status === 'confirmed' && !hasCancellationRequest(item)).length,
      cancellationRequested: appointments.filter((item) => hasCancellationRequest(item)).length,
      completed: appointments.filter((item) => item.status === 'completed').length,
      cancelled: appointments.filter((item) => item.status === 'cancelled').length
    };
    const sourceStats = serverStats || fallbackStats;

    return {
      ...sourceStats,
      depositPending: Number(sourceStats.depositPending ?? sourceStats.deposit_pending ?? fallbackStats.depositPending)
    };
  }, [appointments, serverStats]);

  const pageTitle = isStaffView
    ? isCashierView
      ? 'Lịch hẹn - quản lý phân công'
      : 'Lịch hẹn được phân công'
    : 'Quản lý lịch hẹn';

  const pageNote = isStaffView
    ? isCashierView
      ? 'Theo dõi toàn bộ lịch hẹn đã giao cho nhân viên dịch vụ, xử lý nhanh các yêu cầu xác nhận và hủy lịch từ một màn hình gọn hơn.'
      : 'Bạn chỉ thấy các lịch hẹn được giao cho mình, có thể xác nhận nhận lịch hoặc hủy lịch khi không thể tiếp nhận.'
    : 'Theo dõi toàn bộ lịch hẹn, tình trạng xác nhận của nhân viên và các yêu cầu hủy để điều phối thuận tiện hơn.';

  const statCards = useMemo(
    () => [
      { key: 'total', label: 'Tổng lịch', value: stats.total, tone: 'total' },
      { key: 'depositPending', label: 'Chờ cọc', value: stats.depositPending, tone: 'warning' },
      { key: 'pending', label: 'Chờ xác nhận', value: stats.pending, tone: 'pending' },
      { key: 'confirmed', label: 'Đã nhận làm', value: stats.confirmed, tone: 'confirmed' },
      { key: 'cancellationRequested', label: 'Yêu cầu hủy', value: stats.cancellationRequested, tone: 'warning' },
      { key: 'completed', label: 'Hoàn thành', value: stats.completed, tone: 'success' },
      { key: 'cancelled', label: 'Đã hủy', value: stats.cancelled, tone: 'danger' }
    ],
    [stats]
  );

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: 'Tất cả', count: stats.total },
      { key: 'deposit_pending', label: 'Chờ cọc', count: stats.depositPending },
      { key: 'pending', label: 'Chờ xác nhận', count: stats.pending },
      { key: 'confirmed', label: 'Đã nhận làm', count: stats.confirmed },
      { key: 'cancellation_requested', label: 'Yêu cầu hủy', count: stats.cancellationRequested },
      { key: 'completed', label: 'Hoàn thành', count: stats.completed },
      { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled }
    ],
    [stats]
  );

  const handleAcceptAppointment = async (id) => {
    if (!window.confirm('Xác nhận bạn sẽ nhận và thực hiện lịch hẹn này?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'confirmed');
      await fetchAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể xác nhận nhận lịch.');
    } finally {
      setProcessingId(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Xác nhận hủy lịch hẹn này vì nhân viên không thể nhận lịch?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'cancelled');
      await fetchAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể hủy lịch hẹn này.');
    } finally {
      setProcessingId(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleConfirmCancel = async (id) => {
    if (!window.confirm('Xác nhận hủy lịch hẹn này cho khách hàng?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.confirmCancelBooking(id);
      await fetchAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Xác nhận hủy thất bại.');
    } finally {
      setProcessingId(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleRejectCancel = async (id) => {
    if (!window.confirm('Giữ lại lịch hẹn này và đóng yêu cầu hủy?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.rejectCancelBooking(id);
      await fetchAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể đóng yêu cầu hủy.');
    } finally {
      setProcessingId(null);
    }
  };

  const openCancelDialog = (type, appointment) => {
    setCancelDialog({ type, appointment });
    setCancelReason('');
  };

  const closeCancelDialog = () => {
    if (processingId === cancelDialog?.appointment?.id) {
      return;
    }

    setCancelDialog(null);
  };

  const executeCancelAppointment = async (id) => {
    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'cancelled', cancelReason.trim());
      await fetchAppointments();
      return true;
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể hủy lịch hẹn này.');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const executeConfirmCancel = async (id) => {
    try {
      setProcessingId(id);
      await bookingService.confirmCancelBooking(id);
      await fetchAppointments();
      return true;
    } catch (err) {
      window.alert(err.response?.data?.message || 'Xác nhận hủy thất bại.');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const executeRejectCancel = async (id) => {
    try {
      setProcessingId(id);
      await bookingService.rejectCancelBooking(id);
      await fetchAppointments();
      return true;
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể đóng yêu cầu hủy.');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmCancelDialog = async () => {
    if (!cancelDialog?.appointment) {
      return;
    }

    let success = false;

    if (cancelDialog.type === 'cancel_appointment') {
      success = await executeCancelAppointment(cancelDialog.appointment.id);
    } else if (cancelDialog.type === 'confirm_cancel') {
      success = await executeConfirmCancel(cancelDialog.appointment.id);
    } else if (cancelDialog.type === 'reject_cancel') {
      success = await executeRejectCancel(cancelDialog.appointment.id);
    }

    if (success) {
      setCancelDialog(null);
    }
  };

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        if (filter === 'all') return true;
        if (filter === 'deposit_pending') return isAwaitingDeposit(appointment);
        if (filter === 'cancellation_requested') return hasCancellationRequest(appointment);
        if (filter === 'pending') return isAwaitingStaffConfirmation(appointment);
        if (filter === 'confirmed') {
          return appointment.status === 'confirmed' && !hasCancellationRequest(appointment);
        }
        return appointment.status === filter;
      }),
    [appointments, filter]
  );

  const activeFilterLabel =
    filterOptions.find((option) => option.key === filter)?.label || 'Tất cả';

  const cancelDialogConfig = getCancelDialogConfig(cancelDialog);
  const isCancelDialogProcessing =
    Boolean(cancelDialog?.appointment) && processingId === cancelDialog.appointment.id;

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-appointments">
      <section className="appointments-hero">
        <div className="appointments-hero-copy">
          <p className="appointments-kicker">
            {isStaffView ? (isCashierView ? 'Thu ngân' : 'Nhân viên dịch vụ') : 'Bảng điều phối'}
          </p>
          <h1>{pageTitle}</h1>
          <p className="appointment-page-note">{pageNote}</p>
        </div>

        <div className="appointments-stats">
          {statCards.map((item) => (
            <article key={item.key} className={`appointment-stat-card tone-${item.tone}`}>
              <span className="appointment-stat-label">{item.label}</span>
              <strong className="appointment-stat-value">{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <div className="appointments-toolbar">
        <div className="filter-buttons">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              className={`filter-btn ${filter === option.key ? 'active' : ''}`}
              onClick={() => {
                setFilter(option.key);
                setPage(1);
              }}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>
        <button
          className="btn-export-excel"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            exportToExcel({
              fileName: `lich-hen_${today}`,
              sheets: [
                {
                  name: 'Lịch hẹn',
                  columns: [
                    { key: 'id', header: 'ID', width: 8 },
                    { key: 'customer_name', header: 'Khách hàng', width: 22 },
                    { key: 'customer_email', header: 'Email', width: 26 },
                    { key: 'customer_phone', header: 'SĐT', width: 14 },
                    {
                      key: 'customer_insight',
                      header: 'Nhận diện KH',
                      width: 22,
                      transform: (value) => value
                        ? `${value.customer_potential_label || ''} - Cụm ${value.customer_dec_cluster_number || ''}`
                        : ''
                    },
                    { key: 'service_name', header: 'Dịch vụ', width: 28 },
                    { key: 'staff_name', header: 'Nhân viên', width: 20 },
                    { key: 'appointment_date', header: 'Ngày hẹn', width: 14, transform: (v) => v ? new Date(v).toLocaleDateString('vi-VN') : '' },
                    { key: 'appointment_time', header: 'Giờ hẹn', width: 10 },
                    { key: 'status', header: 'Trạng thái', width: 16, transform: (v, row) => getDisplayStatus(row) },
                    { key: 'total_amount', header: 'Tổng tiền (VNĐ)', width: 18, transform: (v) => Number(v || 0) },
                    { key: 'deposit_amount', header: 'Cọc yêu cầu (VNĐ)', width: 18, transform: (v) => Number(v || 0) },
                    { key: 'deposit_paid_amount', header: 'Đã cọc (VNĐ)', width: 16, transform: (v, row) => getDepositPaidAmount(row) },
                    { key: 'remaining_amount', header: 'Còn thu (VNĐ)', width: 16, transform: (v, row) => getRemainingAmount(row) },
                    { key: 'payment_method', header: 'Phương thức TT', width: 16, transform: (v) => formatPaymentMethodLabel(v) },
                    { key: 'payment_status', header: 'TT thanh toán', width: 16, transform: (v, row) => getPaymentLabel(row) },
                    { key: 'staff_rating', header: 'Đánh giá NV', width: 12, transform: (v) => { const n = Number(v); return n >= 1 && n <= 5 ? `${n}/5` : ''; } },
                    { key: 'notes', header: 'Ghi chú', width: 30 }
                  ],
                  rows: filteredAppointments
                }
              ]
            });
          }}
        >
          📥 Xuất Excel
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!error && appointments.length === 0 && (
        <div className="alert alert-info">Chưa có lịch hẹn nào để hiển thị.</div>
      )}

      <section className="appointments-table-shell">
        <div className="appointments-table-header">
          <div>
            <p className="appointments-table-kicker">Danh sách lịch</p>
            <h2>Lịch hẹn chi tiết</h2>
          </div>
          <span className="appointments-table-meta">Bộ lọc: {activeFilterLabel}</span>
        </div>

        <div className="appointments-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Dịch vụ</th>
                <th>Nhân viên</th>
                <th>Lịch hẹn</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Đánh giá NV</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-cell">
                    Không có lịch hẹn phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}

              {filteredAppointments.map((appointment) => {
                const requestPending = hasCancellationRequest(appointment);
                const awaitingDeposit = isAwaitingDeposit(appointment);
                const awaitingStaffConfirmation = isAwaitingStaffConfirmation(appointment);
                const rowClass = requestPending
                  ? 'has-cancellation-request'
                  : awaitingDeposit
                    ? 'has-deposit-pending'
                    : awaitingStaffConfirmation
                      ? 'has-pending-confirmation'
                      : '';
                const serviceNames = parseServiceNames(appointment.service_name);
                const serviceCount = Number(appointment.service_count) || serviceNames.length;
                const serviceCountLabel =
                  serviceCount > 1 ? `${serviceCount} dịch vụ` : serviceCount === 1 ? '1 dịch vụ' : 'Chưa có';
                const secondaryServiceNames = serviceNames.slice(1, 3);
                const hiddenServiceCount = Math.max(serviceCount - 1 - secondaryServiceNames.length, 0);

                return (
                  <tr key={appointment.id} className={rowClass}>
                    <td>{appointment.id}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{appointment.customer_name}</strong>
                        <small>{appointment.customer_email || '-'}</small>
                        <CustomerInsightBadge insight={appointment.customer_insight} />
                      </div>
                    </td>
                    <td className="appointment-service-cell">
                      <div
                        className="appointment-service-summary"
                        title={appointment.service_name || 'Chưa có dịch vụ'}
                        aria-label={appointment.service_name || 'Chưa có dịch vụ'}
                      >
                        <strong className="appointment-service-name">
                          {serviceNames[0] || appointment.service_name || '-'}
                        </strong>
                        <div className="appointment-service-tags">
                          <span>{serviceCountLabel}</span>
                          <span>{formatVnd(appointment.total_amount || appointment.service_price)}</span>
                        </div>
                        {(secondaryServiceNames.length > 0 || hiddenServiceCount > 0) && (
                          <small className="appointment-service-more">
                            {secondaryServiceNames.join(', ')}
                            {hiddenServiceCount > 0
                              ? `${secondaryServiceNames.length > 0 ? ' ' : ''}+${hiddenServiceCount} dịch vụ`
                              : ''}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={`cell-stack compact ${appointment.staff_name ? '' : 'cell-stack-muted'}`}>
                        <strong>{appointment.staff_name || 'Chưa chọn'}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack compact appointment-slot">
                        <strong>{new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}</strong>
                        <small>{appointment.appointment_time}</small>
                      </div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <span className={`status-pill ${getStatusToneClass(appointment)}`}>
                          <span className="status-pill-dot" aria-hidden="true" />
                          {getDisplayStatus(appointment)}
                        </span>
                        {requestPending && (
                          <small className="status-note">Khách đang chờ nhân viên xác nhận hủy.</small>
                        )}
                        {awaitingDeposit && (
                          <small className="status-note">Khung giờ chỉ khóa sau khi xác nhận cọc.</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack compact payment-stack">
                        <strong>{formatPaymentMethodLabel(appointment.payment_method)}</strong>
                        <small>{getPaymentLabel(appointment)}</small>
                        <small>{appointment.payment_reference || 'Chưa có mã đối soát'}</small>
                        {Number(appointment.deposit_required) === 1 && getDepositRequiredAmount(appointment) > 0 && (
                          <small className="deposit-note">
                            Đã cọc {formatVnd(getDepositPaidAmount(appointment))} / {formatVnd(getDepositRequiredAmount(appointment))}; còn thu {formatVnd(getRemainingAmount(appointment))}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="rating-chip">{formatRating(appointment.staff_rating)}</span>
                    </td>
                    <td>
                      {requestPending ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="action-btn btn-confirm-cancel"
                            disabled={processingId === appointment.id}
                            onClick={() => openCancelDialog('confirm_cancel', appointment)}
                          >
                            {processingId === appointment.id ? 'Đang xử lý...' : 'Xác nhận hủy'}
                          </button>
                          <button
                            type="button"
                            className="action-btn btn-reject-cancel"
                            disabled={processingId === appointment.id}
                            onClick={() => openCancelDialog('reject_cancel', appointment)}
                          >
                            Giữ lịch
                          </button>
                        </div>
                      ) : isStaffView && awaitingStaffConfirmation ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="action-btn btn-accept-booking"
                            disabled={processingId === appointment.id}
                            onClick={() => handleAcceptAppointment(appointment.id)}
                          >
                            {processingId === appointment.id ? 'Đang xác nhận...' : 'Xác nhận nhận lịch'}
                          </button>
                          <button
                            type="button"
                            className="action-btn btn-cancel-booking"
                            disabled={processingId === appointment.id}
                            onClick={() => openCancelDialog('cancel_appointment', appointment)}
                          >
                            Hủy lịch
                          </button>
                        </div>
                      ) : (
                        <span className="no-action">Không có thao tác</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="appointments-server-pagination">
          <span>
            Trang {pagination.page || page}/{pagination.totalPages || 1} · {Number(pagination.total || 0).toLocaleString('vi-VN')} lịch
          </span>
          <div>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Trang trước
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}
              disabled={page >= (pagination.totalPages || 1) || loading}
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>

      {cancelDialogConfig && (
        <div className="appointments-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="appointments-cancel-dialog-title">
          <div className="appointments-modal">
            <div className="appointments-modal-header">
              <h2 id="appointments-cancel-dialog-title">{cancelDialogConfig.title}</h2>
              <button
                type="button"
                className="appointments-modal-close"
                onClick={closeCancelDialog}
                disabled={isCancelDialogProcessing}
                aria-label="Đóng cửa sổ xác nhận"
              >
                ×
              </button>
            </div>
            <div className="appointments-modal-body">
              <p className="appointments-modal-copy">{cancelDialogConfig.message}</p>
              <div className="appointments-modal-details">
                <div className="appointments-modal-detail">
                  <span>Người đặt</span>
                  <strong>{cancelDialog.appointment.customer_name || '-'}</strong>
                </div>
                <div className="appointments-modal-detail">
                  <span>Dịch vụ</span>
                  <strong>{cancelDialog.appointment.service_name || '-'}</strong>
                </div>
                <div className="appointments-modal-detail">
                  <span>Lịch hẹn</span>
                  <strong>{formatAppointmentSlot(cancelDialog.appointment)}</strong>
                </div>
              </div>
                {cancelDialogConfig.type === 'cancel_appointment' && (
                  <div className="appointments-modal-detail" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '15px' }}>
                    <label style={{ marginBottom: '8px', fontWeight: 'bold' }}>Lý do hủy (bắt buộc):</label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Nhập lý do hủy lịch..."
                      style={{ width: '100%', padding: '8px', minHeight: '80px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                )}
              <div className="appointments-modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className={`appointments-modal-submit ${
                    cancelDialogConfig.tone === 'danger'
                      ? 'appointments-modal-submit-danger'
                      : 'appointments-modal-submit-neutral'
                  }`}
                  onClick={handleConfirmCancelDialog}
                  disabled={isCancelDialogProcessing || (cancelDialogConfig.type === 'cancel_appointment' && !cancelReason.trim())}
                >
                  {isCancelDialogProcessing ? 'Đang xử lý...' : cancelDialogConfig.confirmLabel}
                </button>
                <button
                  type="button"
                  className="appointments-modal-cancel"
                  onClick={closeCancelDialog}
                  disabled={isCancelDialogProcessing}
                >
                  {cancelDialogConfig.cancelLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageAppointments;
