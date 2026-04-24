import React, { useEffect, useMemo, useState } from 'react';
import bookingService from '../../services/bookingService';
import paymentService from '../../services/paymentService';
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

  return statusMap[appointment?.status] || {
    label: appointment?.status || 'Không rõ',
    class: 'badge-default'
  };
};

const hasRated = (appointment) => Number(appointment?.staff_rating) >= 1;

const canReview = (appointment) =>
  appointment?.status === 'completed' && !!appointment?.staff_name && !hasRated(appointment);

const canRequestCancellation = (appointment) =>
  ['pending', 'confirmed'].includes(appointment?.status) && Number(appointment?.cancellation_requested) !== 1;

const canPayOnline = (appointment) =>
  appointment?.status !== 'cancelled' &&
  !hasCancellationRequest(appointment) &&
  appointment?.payment_status !== 'paid';

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

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const formatAppointmentTimeRange = (appointment) => {
  const startTime = appointment?.appointment_time || '';
  const endTime = appointment?.end_time || '';

  if (!startTime) {
    return '--:--';
  }

  const startLabel = String(startTime).slice(0, 5);
  const endLabel = String(endTime).slice(0, 5);
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
};

const formatPaymentStatus = (paymentStatus) => {
  const map = {
    paid: { label: 'Đã thanh toán', className: 'payment-pill paid' },
    pending: { label: 'Chờ thanh toán', className: 'payment-pill pending' },
    failed: { label: 'Thất bại', className: 'payment-pill failed' }
  };

  return map[paymentStatus] || { label: 'Chưa tạo giao dịch', className: 'payment-pill idle' };
};

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'vietqr') {
    return 'Chuyển khoản ngân hàng';
  }

  if (paymentMethod === 'cash') {
    return 'Tại tiệm';
  }

  if (paymentMethod === 'vnpay') {
    return 'Thanh toán online';
  }

  return '-';
};

function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [processingCancelId, setProcessingCancelId] = useState(null);
  const [processingPaymentId, setProcessingPaymentId] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPaymentOptions = async () => {
      try {
        const response = await paymentService.getPaymentOptions();
        if (!cancelled) {
          setPaymentOptions(response.data?.data?.options || []);
        }
      } catch (err) {
        if (!cancelled) {
          setPaymentOptions([]);
        }
      }
    };

    fetchPaymentOptions();
    return () => {
      cancelled = true;
    };
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
      cancellationRequested: appointments.filter((item) => hasCancellationRequest(item)).length,
      unpaid: appointments.filter((item) => canPayOnline(item)).length
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

  const handleOnlinePayment = async (appointment) => {
    const enabledMethods = new Set(paymentOptions.filter((option) => option.enabled).map((option) => option.method));
    const preferredMethod =
      [
        appointment.payment_method,
        'vnpay',
        'vietqr'
      ].find((method) => method && enabledMethods.has(method)) || 'cash';

    if (preferredMethod === 'cash') {
      window.alert('Hiện tại chưa có phương thức thanh toán online khả dụng.');
      return;
    }

    try {
      setProcessingPaymentId(appointment.id);
      const response = await paymentService.createPayment(appointment.id, preferredMethod);
      const paymentUrl = response.data?.payment?.payment_url;

      if (!paymentUrl) {
        throw new Error('Không tạo được liên kết thanh toán.');
      }

      window.location.assign(paymentUrl);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể tạo giao dịch thanh toán lúc này.');
      setProcessingPaymentId(null);
    }
  };

  const openInvoice = (paymentId) => {
    if (!paymentId) {
      return;
    }

    window.open(`/payment-bill/${paymentId}`, '_blank', 'noopener,noreferrer');
  };

  const filteredAppointments = appointments.filter((appointment) => {
    if (filter === 'all') return true;
    if (filter === 'cancellation_requested') return hasCancellationRequest(appointment);
    if (filter === 'pending') return isAwaitingStaffConfirmation(appointment);
    if (filter === 'unpaid') return canPayOnline(appointment);
    return appointment.status === filter;
  });

  if (loading) {
    return <div className="loading">Đang tải lịch hẹn...</div>;
  }

  return (
    <div className="appointments-page">
      <h1>Lịch hẹn của tôi</h1>

      {stats.unpaid > 0 && (
        <div className="online-payment-banner">
          <div>
            <strong>Thanh toán online cho khách hàng</strong>
            <span>
              Bạn đang có {stats.unpaid} lịch hẹn chưa thanh toán. Có thể mở lại cổng thanh toán online ngay trong từng lịch.
            </span>
          </div>
          <button type="button" className="btn-primary" onClick={() => setFilter('unpaid')}>
            Xem lịch chưa thanh toán
          </button>
        </div>
      )}

      <div className="filter-buttons">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Tất cả ({stats.total})
        </button>
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          Chờ NV xác nhận ({stats.pending})
        </button>
        <button className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`} onClick={() => setFilter('confirmed')}>
          Đã xác nhận làm ({stats.confirmed})
        </button>
        <button
          className={`filter-btn ${filter === 'unpaid' ? 'active' : ''}`}
          onClick={() => setFilter('unpaid')}
        >
          Chờ thanh toán ({stats.unpaid})
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
            const paymentMeta = formatPaymentStatus(appointment.payment_status);

            return (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-header">
                  <div className="appointment-header-main">
                    <h3>{appointment.service_name}</h3>
                    {appointment.payment_status === 'paid' && (
                      <span className="payment-success-check" aria-label="Đã thanh toán">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                </div>

                <div className="appointment-body">
                  <div className="appointment-info">
                    <div className="info-row">
                      <span className="label">Ngày hẹn:</span>
                      <span className="value">{new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Giờ hẹn:</span>
                      <span className="value">{formatAppointmentTimeRange(appointment)}</span>
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
                      <span className="value">{formatMoney(appointment.service_price || 0)}</span>
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

                  <div className="payment-card">
                    <div className="payment-card-head">
                      <div>
                        <strong>Thanh toán</strong>
                        <span>
                          {appointment.payment_status === 'paid'
                            ? 'Giao dịch đã được ghi nhận và có thể xuất bill ngay.'
                            : appointment.payment_method === 'vietqr'
                              ? 'Bạn có thể mở lại mã chuyển khoản để thanh toán đúng số tiền và nội dung.'
                              : 'Bạn có thể thanh toán online bất cứ lúc nào nếu cần bill hoặc đối soát ngay.'}
                        </span>
                      </div>
                      <div className="payment-status-wrap">
                        {appointment.payment_status === 'paid' && <span className="payment-success-check">✓</span>}
                        <span className={paymentMeta.className}>{paymentMeta.label}</span>
                      </div>
                    </div>

                    <div className="payment-card-grid">
                      <div className="payment-info-item">
                        <span>Phương thức</span>
                        <strong>{formatPaymentMethodLabel(appointment.payment_method)}</strong>
                      </div>
                      <div className="payment-info-item">
                        <span>Số tiền</span>
                        <strong>{formatMoney(appointment.payment_amount || appointment.service_price || 0)}</strong>
                      </div>
                      <div className="payment-info-item">
                        <span>Mã đối soát</span>
                        <strong>{appointment.payment_reference || '-'}</strong>
                      </div>
                      <div className="payment-info-item">
                        <span>Mã giao dịch</span>
                        <strong>{appointment.payment_transaction_code || '-'}</strong>
                      </div>
                    </div>

                    <div className="payment-actions">
                      {appointment.payment_status === 'paid' && appointment.payment_id ? (
                        <button type="button" className="btn-secondary" onClick={() => openInvoice(appointment.payment_id)}>
                          Xem bill
                        </button>
                      ) : canPayOnline(appointment) ? (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={processingPaymentId === appointment.id}
                          onClick={() => handleOnlinePayment(appointment)}
                        >
                          {processingPaymentId === appointment.id
                            ? 'Đang tạo giao dịch...'
                            : appointment.payment_method === 'vietqr'
                              ? 'Mở mã chuyển khoản'
                              : appointment.payment_method === 'vnpay'
                                ? 'Mở VNPay'
                              : 'Thanh toán online ngay'}
                        </button>
                      ) : (
                        <span className="payment-disabled-note">Lịch này không còn khả dụng để thanh toán online.</span>
                      )}
                    </div>
                  </div>

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
