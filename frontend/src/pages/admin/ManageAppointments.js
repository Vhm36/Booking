import React, { useEffect, useMemo, useState } from 'react';
import authService from '../../services/authService';
import bookingService from '../../services/bookingService';
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

function ManageAppointments() {
  const currentUser = authService.getUser();
  const isStaffView = currentUser?.role === 'staff';

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await bookingService.getAllBookings();
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

  const handleStatusChange = async (id, newStatus) => {
    try {
      setProcessingId(id);
      await bookingService.updateBookingStatus(id, newStatus);
      await fetchAppointments();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Cập nhật trạng thái thất bại.');
    } finally {
      setProcessingId(null);
    }
  };

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

  const filteredAppointments = appointments.filter((appointment) => {
    if (filter === 'all') return true;
    if (filter === 'cancellation_requested') return hasCancellationRequest(appointment);
    if (filter === 'pending') return isAwaitingStaffConfirmation(appointment);
    if (filter === 'confirmed') return appointment.status === 'confirmed' && !hasCancellationRequest(appointment);
    return appointment.status === filter;
  });

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-appointments">
      <h1>{isStaffView ? 'Lịch hẹn được phân công' : 'Quản lý lịch hẹn'}</h1>
      <p className="appointment-page-note">
        {isStaffView
          ? 'Nhân viên chỉ nhìn thấy các lịch hẹn được phân công cho mình. Với lịch mới, bạn có thể xác nhận nhận lịch để chuyển sang trạng thái đã xác nhận làm hoặc hủy lịch nếu không thể nhận.'
          : 'Theo dõi toàn bộ lịch hẹn, tình trạng nhân viên xác nhận nhận lịch và các yêu cầu hủy của khách hàng.'}
      </p>

      <div className="filter-buttons">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Tất cả ({stats.total})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Chờ NV xác nhận ({stats.pending})
        </button>
        <button
          className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`}
          onClick={() => setFilter('confirmed')}
        >
          Đã xác nhận làm ({stats.confirmed})
        </button>
        <button
          className={`filter-btn ${filter === 'cancellation_requested' ? 'active' : ''}`}
          onClick={() => setFilter('cancellation_requested')}
        >
          Yêu cầu hủy ({stats.cancellationRequested})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Hoàn thành ({stats.completed})
        </button>
        <button
          className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('cancelled')}
        >
          Đã hủy ({stats.cancelled})
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!error && appointments.length === 0 && (
        <div className="alert alert-info">Chưa có lịch hẹn nào để hiển thị.</div>
      )}

      <div className="appointments-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Khách hàng</th>
              <th>Dịch vụ</th>
              <th>Nhân viên</th>
              <th>Ngày hẹn</th>
              <th>Giờ hẹn</th>
              <th>Trạng thái</th>
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
              const awaitingStaffConfirmation = isAwaitingStaffConfirmation(appointment);
              const rowClass = requestPending
                ? 'has-cancellation-request'
                : awaitingStaffConfirmation
                  ? 'has-pending-confirmation'
                  : '';
              const disableStatusSelect =
                processingId === appointment.id || requestPending || (isStaffView && awaitingStaffConfirmation);

              return (
                <tr key={appointment.id} className={rowClass}>
                  <td>{appointment.id}</td>
                  <td>
                    <div className="cell-stack">
                      <strong>{appointment.customer_name}</strong>
                      <small>{appointment.customer_email || '-'}</small>
                    </div>
                  </td>
                  <td>{appointment.service_name}</td>
                  <td>{appointment.staff_name || 'Chưa chọn'}</td>
                  <td>{new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}</td>
                  <td>{appointment.appointment_time}</td>
                  <td>
                    <div className="status-cell">
                      <span
                        className={`status-pill ${
                          requestPending
                            ? 'status-pill-warning'
                            : awaitingStaffConfirmation
                              ? 'status-pill-pending'
                              : ''
                        }`}
                      >
                        {getDisplayStatus(appointment)}
                      </span>
                      {requestPending && (
                        <small className="status-note">Khách đang chờ nhân viên xác nhận hủy.</small>
                      )}
                      {!requestPending && awaitingStaffConfirmation && (
                        <small className="status-note status-note-pending">
                          {isStaffView
                            ? 'Khách đã đặt lịch với bạn. Hãy xác nhận nhận lịch hoặc hủy lịch hẹn này.'
                            : 'Lịch này đang chờ nhân viên phụ trách xác nhận nhận lịch.'}
                        </small>
                      )}
                      <select
                        value={appointment.status}
                        onChange={(event) => handleStatusChange(appointment.id, event.target.value)}
                        className="status-select"
                        disabled={disableStatusSelect}
                      >
                        <option value="pending">Chờ nhân viên xác nhận</option>
                        <option value="confirmed">Đã xác nhận làm</option>
                        <option value="completed">Hoàn thành</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                    </div>
                  </td>
                  <td>{formatRating(appointment.staff_rating)}</td>
                  <td>
                    {requestPending ? (
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn-confirm-cancel"
                          disabled={processingId === appointment.id}
                          onClick={() => handleConfirmCancel(appointment.id)}
                        >
                          {processingId === appointment.id ? 'Đang xử lý...' : 'Xác nhận hủy'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject-cancel"
                          disabled={processingId === appointment.id}
                          onClick={() => handleRejectCancel(appointment.id)}
                        >
                          Giữ lịch
                        </button>
                      </div>
                    ) : isStaffView && awaitingStaffConfirmation ? (
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn-accept-booking"
                          disabled={processingId === appointment.id}
                          onClick={() => handleAcceptAppointment(appointment.id)}
                        >
                          {processingId === appointment.id ? 'Đang xác nhận...' : 'Xác nhận nhận lịch'}
                        </button>
                        <button
                          type="button"
                          className="btn-cancel-booking"
                          disabled={processingId === appointment.id}
                          onClick={() => handleCancelAppointment(appointment.id)}
                        >
                          Hủy lịch
                        </button>
                      </div>
                    ) : (
                      <span className="no-action">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageAppointments;
