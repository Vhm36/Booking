import React, { useEffect, useMemo, useState } from 'react';
import authService from '../../../services/authService';
import bookingService from '../../../services/bookingService';
import staffService from '../../../services/staffService';
import './ServiceStaffDashboard.css';

const formatRating = (rating) => {
  const safeRating = Number(rating);
  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    return '-';
  }
  return `${'\u2605'.repeat(safeRating)}${'\u2606'.repeat(5 - safeRating)} (${safeRating}/5)`;
};

const hasCancellationRequest = (appointment) =>
  Number(appointment?.cancellation_requested) === 1 && appointment?.status !== 'cancelled';

const isAwaitingStaffConfirmation = (appointment) =>
  appointment?.status === 'pending' && !hasCancellationRequest(appointment);

const getDisplayStatus = (appointment) => {
  if (hasCancellationRequest(appointment)) {
    return 'Chờ xác nhận hủy';
  }

  const statusMap = {
    pending: 'Chờ nhân viên xác nhận',
    confirmed: 'Đã xác nhận làm',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };

  return statusMap[appointment?.status] || appointment?.status || 'Không rõ';
};

const getStatusToneClass = (appointment) => {
  if (hasCancellationRequest(appointment)) {
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

const formatAppointmentSlot = (appointment) => {
  if (!appointment?.appointment_date) {
    return '-';
  }

  return `${new Date(appointment.appointment_date).toLocaleDateString('vi-VN')} • ${
    appointment?.appointment_time || '--:--'
  }`;
};

const getCancelDialogConfig = (dialog) => {
  if (!dialog?.appointment) {
    return null;
  }

  switch (dialog.type) {
    case 'cancel_appointment':
      return {
        title: 'Xác nhận hủy lịch',
        message: 'Bạn có chắc muốn hủy lịch hẹn này ngay lúc này không?',
        confirmLabel: 'Xác nhận hủy',
        cancelLabel: 'Không',
        tone: 'danger'
      };
    case 'request_cancel':
      return {
        title: 'Xác nhận gửi yêu cầu hủy',
        message: 'Yêu cầu hủy sẽ được gửi lên admin để xét duyệt trước khi lịch bị hủy.',
        confirmLabel: 'Gửi yêu cầu hủy',
        cancelLabel: 'Không',
        tone: 'danger'
      };
    default:
      return null;
  }
};

function ServiceStaffDashboard() {
  const currentUser = authService.getUser();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchMyAppointments();
  }, []);

  const fetchMyAppointments = async () => {
    try {
      setLoading(true);
      const response = await bookingService.getMyBookings();
      setAppointments(response.data.data || []);
      setError('');
    } catch (err) {
      const apiMessage =
        typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      setError(apiMessage || 'Không thể tải danh sách lịch hẹn.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: appointments.length,
      pending: appointments.filter((item) => isAwaitingStaffConfirmation(item)).length,
      confirmed: appointments.filter((item) => item.status === 'confirmed' && !hasCancellationRequest(item)).length,
      cancellationRequested: appointments.filter((item) => hasCancellationRequest(item)).length,
      completed: appointments.filter((item) => item.status === 'completed').length,
      cancelled: appointments.filter((item) => item.status === 'cancelled').length
    }),
    [appointments]
  );

  const statCards = useMemo(
    () => [
      { key: 'total', label: 'Tổng lịch', value: stats.total, tone: 'total' },
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
      { key: 'pending', label: 'Chờ xác nhận', count: stats.pending },
      { key: 'confirmed', label: 'Đã nhận', count: stats.confirmed },
      { key: 'cancellation_requested', label: 'Yêu cầu hủy', count: stats.cancellationRequested },
      { key: 'completed', label: 'Hoàn thành', count: stats.completed },
      { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled }
    ],
    [stats]
  );

  const handleAcceptAppointment = async (id) => {
    if (!window.confirm('Xác nhân bân sê nhân và thyc hiên lich hên này?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'confirmed');
      await fetchMyAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể xác nhận nhận lịch.');
    } finally {
      setProcessingId(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Xác nhân hùy lich hên này?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'cancelled');
      await fetchMyAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể hủy lịch hẹn này.');
    } finally {
      setProcessingId(null);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleRequestCancellation = async (id) => {
    if (!window.confirm('Xác nhân gùi yêu câu hùy lich hên này?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.requestCancelBooking(id);
      await fetchMyAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Gửi yêu cầu hủy thất bại.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteService = async (id) => {
    if (!window.confirm('Xác nhân dã hoàn thành dich vu này?')) {
      return;
    }

    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, 'completed');
      await fetchMyAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể cập nhật trạng thái hoàn thành.');
    } finally {
      setProcessingId(null);
    }
  };

  const openCancelDialog = (type, appointment) => {
    setCancelDialog({ type, appointment });
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
      await bookingService.updateBookingStatus(id, 'cancelled');
      await fetchMyAppointments();
      return true;
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể hủy lịch hẹn này.');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const executeRequestCancellation = async (id) => {
    try {
      setProcessingId(id);
      await bookingService.requestCancelBooking(id);
      await fetchMyAppointments();
      return true;
    } catch (err) {
      window.alert(err.response?.data?.message || 'Gửi yêu cầu hủy thất bại.');
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
    } else if (cancelDialog.type === 'request_cancel') {
      success = await executeRequestCancellation(cancelDialog.appointment.id);
    }

    if (success) {
      setCancelDialog(null);
    }
  };

  const handleSubmitLeaveRequest = async (e) => {
    e.preventDefault();
    
    if (!leaveRequest.start_date || !leaveRequest.end_date || !leaveRequest.reason.trim()) {
      window.alert('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    try {
      await staffService.requestLeave(leaveRequest);
      window.alert('Gửi yêu cầu nghỉ phép thành công! Chờ admin xác nhận.');
      setShowLeaveRequestModal(false);
      setLeaveRequest({ start_date: '', end_date: '', reason: '' });
    } catch (err) {
      window.alert(err.response?.data?.message || 'Gửi yêu cầu nghỉ phép thất bại.');
    }
  };

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        if (filter === 'all') return true;
        if (filter === 'cancellation_requested') return hasCancellationRequest(appointment);
        if (filter === 'pending') return isAwaitingStaffConfirmation(appointment);
        if (filter === 'confirmed') {
          return appointment.status === 'confirmed' && !hasCancellationRequest(appointment);
        }
        return appointment.status === filter;
      }),
    [appointments, filter]
  );

  const cancelDialogConfig = getCancelDialogConfig(cancelDialog);
  const isCancelDialogProcessing =
    Boolean(cancelDialog?.appointment) && processingId === cancelDialog.appointment.id;

  if (loading) {
    return <div className="loading">?ang t?i...</div>;
  }

  return (
    <div className="service-staff-dashboard">
      <section className="staff-schedule-hero">
        <div className="staff-schedule-hero-copy">
          <p className="staff-schedule-kicker">Nhân viên dịch vụ</p>
          <h1>Lịch làm việc của tôi</h1>
          <p className="staff-schedule-note">
            Chào {currentUser?.name}, đây là nơi bạn theo dõi lịch đã được giao, xác nhận nhận
            lịch, gửi yêu cầu hủy và đánh dấu hoàn thành dịch vụ theo cùng một bố cục rõ ràng hơn.
          </p>
        </div>

        <div className="staff-schedule-stats">
          {statCards.map((item) => (
            <article key={item.key} className={`staff-schedule-stat-card tone-${item.tone}`}>
              <span className="staff-schedule-stat-label">{item.label}</span>
              <strong className="staff-schedule-stat-value">{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <div className="staff-schedule-toolbar">
        <div className="filter-buttons">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              className={`filter-btn ${filter === option.key ? 'active' : ''}`}
              onClick={() => setFilter(option.key)}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>

        <button
          className="btn-leave-request"
          onClick={() => setShowLeaveRequestModal(true)}
        >
          Yêu cầu nghỉ phép
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!error && appointments.length === 0 && (
        <div className="alert alert-info">Chưa có lịch hẹn nào để hiển thị.</div>
      )}

      <section className="staff-appointments-shell">
        <div className="staff-appointments-header">
          <div>
            <p className="staff-appointments-kicker">Lịch đã được giao</p>
            <h2>Lịch hẹn chi tiết</h2>
          </div>
        </div>

        <div className="appointments-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Dịch vụ</th>
                <th>Lịch hẹn</th>
                <th>Trạng thái</th>
                <th>Đánh giá</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    Không có lịch hẹn phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}

              {filteredAppointments.map((appointment) => {
                const requestPending = hasCancellationRequest(appointment);
                const awaitingStaffConfirmation = isAwaitingStaffConfirmation(appointment);
                const rowClass = requestPending
                  ? 'has-cancellation-request'
                  : awaitingStaffConfirmation
                    ? 'has-pending-confirmation'
                    : '';

                return (
                  <tr key={appointment.id} className={rowClass}>
                    <td>{appointment.id}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{appointment.customer_name}</strong>
                        <small>{appointment.customer_email || '-'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack compact">
                        <strong>{appointment.service_name}</strong>
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
                          <small className="status-note">Khách đang chờ admin xác nhận hủy.</small>
                        )}
                        {!requestPending && awaitingStaffConfirmation && (
                          <small className="status-note status-note-pending">
                            Khách đã đặt lịch với bạn. Hãy xác nhận nhận lịch hoặc hủy lịch hẹn này.
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="rating-chip">{formatRating(appointment.staff_rating)}</span>
                    </td>
                    <td>
                      {requestPending ? (
                        <span className="no-action">Chờ admin xác nhận hủy</span>
                      ) : awaitingStaffConfirmation ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="action-btn btn-accept-booking"
                            disabled={processingId === appointment.id}
                            onClick={() => handleAcceptAppointment(appointment.id)}
                          >
                            {processingId === appointment.id ? 'Đang xác nhận...' : 'Xác nhận'}
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
                      ) : appointment.status === 'confirmed' ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="action-btn btn-complete-service"
                            disabled={processingId === appointment.id}
                            onClick={() => handleCompleteService(appointment.id)}
                          >
                            {processingId === appointment.id ? 'Đang cập nhật...' : 'Hoàn thành'}
                          </button>
                          <button
                            type="button"
                            className="action-btn btn-request-cancel"
                            disabled={processingId === appointment.id}
                            onClick={() => openCancelDialog('request_cancel', appointment)}
                          >
                            Yêu cầu hủy
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
      </section>

      {cancelDialogConfig && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
          <div className="modal">
            <div className="modal-header">
              <h2 id="cancel-dialog-title">{cancelDialogConfig.title}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeCancelDialog}
                disabled={isCancelDialogProcessing}
                aria-label="Đóng cửa sổ xác nhận"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-dialog-copy">{cancelDialogConfig.message}</p>
              <div className="confirm-dialog-details">
                <div className="confirm-dialog-detail">
                  <span className="confirm-dialog-label">Người đặt</span>
                  <strong>{cancelDialog.appointment.customer_name || '-'}</strong>
                </div>
                <div className="confirm-dialog-detail">
                  <span className="confirm-dialog-label">Dịch vụ</span>
                  <strong>{cancelDialog.appointment.service_name || '-'}</strong>
                </div>
                <div className="confirm-dialog-detail">
                  <span className="confirm-dialog-label">Lịch hẹn</span>
                  <strong>{formatAppointmentSlot(cancelDialog.appointment)}</strong>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className={`btn-submit ${cancelDialogConfig.tone === 'danger' ? 'btn-danger' : 'btn-neutral'}`}
                  onClick={handleConfirmCancelDialog}
                  disabled={isCancelDialogProcessing}
                >
                  {isCancelDialogProcessing ? 'Đang xử lý...' : cancelDialogConfig.confirmLabel}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
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

      {showLeaveRequestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Yêu cầu nghỉ phép</h2>
              <button
                className="modal-close"
                onClick={() => setShowLeaveRequestModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitLeaveRequest} className="modal-body">
              <div className="form-group">
                <label>Từ ngày</label>
                <input
                  type="date"
                  value={leaveRequest.start_date}
                  onChange={(e) => setLeaveRequest({ ...leaveRequest, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Đến ngày</label>
                <input
                  type="date"
                  value={leaveRequest.end_date}
                  onChange={(e) => setLeaveRequest({ ...leaveRequest, end_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Lý do</label>
                <textarea
                  value={leaveRequest.reason}
                  onChange={(e) => setLeaveRequest({ ...leaveRequest, reason: e.target.value })}
                  required
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-submit">
                  Gửi yêu cầu
                </button>
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowLeaveRequestModal(false)}
                >
                  Hùy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceStaffDashboard;
