import React, { useEffect, useMemo, useState } from 'react';
import bookingService from '../services/bookingService';
import './MyAppointments.css';

const hasCancellationRequest = (appointment) =>
  Number(appointment?.cancellation_requested) === 1 && appointment?.status !== 'cancelled';

const isAwaitingStaffConfirmation = (appointment) =>
  appointment?.status === 'pending' && !hasCancellationRequest(appointment);

const getStatusBadge = (appointment) => {
  if (hasCancellationRequest(appointment)) {
    return { label: 'Chờ xác nhận hủy', class: 'badge-cancel-request' };
  }

  const statusMap = {
    pending: { label: 'Chờ nhân viên xác nhận', class: 'badge-warning' },
    confirmed: { label: 'Đã xác nhận làm', class: 'badge-success' },
    completed: { label: 'Hoàn thành', class: 'badge-info' },
    cancelled: { label: 'Đã hủy', class: 'badge-danger' }
  };

  return statusMap[appointment?.status] || { label: appointment?.status || 'Không rõ', class: 'badge-default' };
};

const hasRated = (appointment) => Number(appointment?.staff_rating) >= 1;

const canReview = (appointment) =>
  appointment?.status === 'completed' && !!appointment?.staff_name && !hasRated(appointment);

const canRequestCancellation = (appointment) =>
  ['pending', 'confirmed'].includes(appointment?.status) && Number(appointment?.cancellation_requested) !== 1;

const renderRatingStars = (rating) => {
  const safeRating = Math.min(5, Math.max(1, Number(rating) || 0));
  return `${'\u2605'.repeat(safeRating)}${'\u2606'.repeat(5 - safeRating)}`;
};

const getPendingStaffMessage = (appointment) => {
  if (appointment?.staff_name) {
    return `Lịch hẹn đang chờ nhân viên ${appointment.staff_name} xác nhận nhận lịch.`;
  }

  return 'Lịch hẹn đang chờ nhân viên phụ trách xác nhận nhận lịch.';
};

function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [processingCancelId, setProcessingCancelId] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await bookingService.getMyBookings();
      const nextAppointments = response.data.data || [];
      setAppointments(nextAppointments);
      setReviewDrafts((prev) => {
        const next = { ...prev };
        nextAppointments.forEach((appointment) => {
          if (!next[appointment.id]) {
            next[appointment.id] = { rating: '5', review: '' };
          }
        });
        return next;
      });
    } catch (err) {
      setAppointments([]);
      console.error('Không thể tải lịch hẹn:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: appointments.length,
      pending: appointments.filter((item) => isAwaitingStaffConfirmation(item)).length,
      confirmed: appointments.filter((item) => item.status === 'confirmed').length,
      completed: appointments.filter((item) => item.status === 'completed').length,
      cancellationRequested: appointments.filter((item) => hasCancellationRequest(item)).length
    }),
    [appointments]
  );

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Bạn có chắc muốn gửi yêu cầu hủy lịch này không?')) {
      return;
    }

    try {
      setProcessingCancelId(id);
      await bookingService.cancelBooking(id);
      await fetchAppointments();
      window.alert('Đã gửi yêu cầu hủy. Nhân viên sẽ xác nhận sớm.');
    } catch (err) {
      window.alert(err.response?.data?.message || 'Gửi yêu cầu hủy thất bại.');
    } finally {
      setProcessingCancelId(null);
    }
  };

  const handleReviewInput = (appointmentId, field, value) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || { rating: '5', review: '' }),
        [field]: value
      }
    }));
  };

  const handleSubmitReview = async (appointment) => {
    const draft = reviewDrafts[appointment.id] || { rating: '5', review: '' };
    const rating = Number(draft.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      window.alert('Điểm đánh giá phải từ 1 đến 5.');
      return;
    }

    try {
      setSubmittingReviewId(appointment.id);
      await bookingService.reviewBooking(appointment.id, rating, (draft.review || '').trim());

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointment.id
            ? {
                ...item,
                staff_rating: rating,
                staff_review: (draft.review || '').trim(),
                reviewed_at: new Date().toISOString()
              }
            : item
        )
      );

      setReviewDrafts((prev) => ({
        ...prev,
        [appointment.id]: { rating: '5', review: '' }
      }));
    } catch (err) {
      window.alert(err.response?.data?.message || 'Gửi đánh giá thất bại.');
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const filteredAppointments = appointments.filter((appointment) => {
    if (filter === 'all') return true;
    if (filter === 'cancellation_requested') {
      return hasCancellationRequest(appointment);
    }
    if (filter === 'pending') {
      return isAwaitingStaffConfirmation(appointment);
    }
    return appointment.status === filter;
  });

  if (loading) {
    return <div className="loading">Đang tải lịch hẹn...</div>;
  }

  return (
    <div className="appointments-page">
      <h1>Lịch hẹn của tôi</h1>

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
          Chờ hủy ({stats.cancellationRequested})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Hoàn thành ({stats.completed})
        </button>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="no-appointments">
          <p>Không có lịch hẹn nào phù hợp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="appointments-list">
          {filteredAppointments.map((appointment) => {
            const statusInfo = getStatusBadge(appointment);
            const draft = reviewDrafts[appointment.id] || { rating: '5', review: '' };

            return (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-header">
                  <h3>{appointment.service_name}</h3>
                  <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                </div>

                <div className="appointment-body">
                  <div className="appointment-info">
                    <div className="info-row">
                      <span className="label">Ngày hẹn:</span>
                      <span className="value">
                        {new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">Giờ hẹn:</span>
                      <span className="value">{appointment.appointment_time}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Nhân viên:</span>
                      <span className="value">{appointment.staff_name || 'Chưa phân công'}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Thời gian:</span>
                      <span className="value">{appointment.duration} phút</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Giá:</span>
                      <span className="value">
                        {Number(appointment.service_price || 0).toLocaleString('vi-VN')} VND
                      </span>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="notes">
                      <strong>Ghi chú:</strong> {appointment.notes}
                    </div>
                  )}

                  {isAwaitingStaffConfirmation(appointment) && (
                    <div className="awaiting-staff-note">{getPendingStaffMessage(appointment)}</div>
                  )}

                  {hasCancellationRequest(appointment) && (
                    <div className="cancellation-request-note">
                      Yêu cầu hủy của bạn đang chờ nhân viên xác nhận.
                    </div>
                  )}

                  {hasRated(appointment) && (
                    <div className="review-result">
                      <div className="review-result-head">
                        <strong>Đánh giá nhân viên</strong>
                        <span className="review-stars">{renderRatingStars(appointment.staff_rating)}</span>
                      </div>
                      {appointment.staff_review ? <p>{appointment.staff_review}</p> : null}
                    </div>
                  )}

                  {canReview(appointment) && (
                    <div className="review-form">
                      <h4>Đánh giá nhân viên sau khi hoàn thành</h4>
                      <div className="review-row">
                        <label htmlFor={`rating-${appointment.id}`}>Điểm</label>
                        <select
                          id={`rating-${appointment.id}`}
                          value={draft.rating}
                          onChange={(event) => handleReviewInput(appointment.id, 'rating', event.target.value)}
                        >
                          <option value="5">5 - Rất hài lòng</option>
                          <option value="4">4 - Hài lòng</option>
                          <option value="3">3 - Bình thường</option>
                          <option value="2">2 - Chưa tốt</option>
                          <option value="1">1 - Cần cải thiện</option>
                        </select>
                      </div>
                      <textarea
                        rows="3"
                        value={draft.review}
                        onChange={(event) => handleReviewInput(appointment.id, 'review', event.target.value)}
                        placeholder="Bạn có thể ghi nhận xét chi tiết (không bắt buộc)..."
                      />
                      <button
                        type="button"
                        className="btn-primary review-submit-btn"
                        disabled={submittingReviewId === appointment.id}
                        onClick={() => handleSubmitReview(appointment)}
                      >
                        {submittingReviewId === appointment.id ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </button>
                    </div>
                  )}
                </div>

                {canRequestCancellation(appointment) && (
                  <div className="appointment-footer">
                    <button
                      onClick={() => handleCancelRequest(appointment.id)}
                      className="btn-danger"
                      disabled={processingCancelId === appointment.id}
                    >
                      {processingCancelId === appointment.id ? 'Đang gửi yêu cầu...' : 'Yêu cầu hủy lịch'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyAppointments;
