import React, { useEffect, useMemo, useState } from 'react';
import bookingService from '../../services/bookingService';
import paymentService from '../../services/paymentService';
import './MyAppointments.css';

const APPOINTMENTS_PER_PAGE = 2;

const hasCancellationRequest = (appointment) =>
  Number(appointment?.cancellation_requested) === 1 && appointment?.status !== 'cancelled';

const isAwaitingStaffConfirmation = (appointment) =>
  appointment?.status === 'pending' && !hasCancellationRequest(appointment);

const getStatusBadge = (appointment) => {
  if (hasCancellationRequest(appointment)) {
    return { label: 'Chờ xác nhận hủy', class: 'badge-cancel-request' };
  }

  if (
    appointment?.status !== 'pending' &&
    appointment?.status !== 'cancelled' &&
    appointment?.payment_status &&
    appointment.payment_status !== 'paid'
  ) {
    return { label: 'Chờ thanh toán', class: 'badge-payment-pending' };
  }

  const statusMap = {
    pending: { label: 'Chờ nhân viên xác nhận', class: 'badge-warning' },
    confirmed: { label: 'Đã xác nhận', class: 'badge-success' },
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

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

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
  if (paymentMethod === 'cash') {
    return 'Tiền mặt tại tiệm';
  }

  if (paymentMethod === 'banking') {
    return 'Chuyển khoản tại tiệm';
  }

  if (paymentMethod === 'vietqr') {
    return 'VietQR ngân hàng';
  }

  if (paymentMethod === 'vnpay') {
    return 'Thanh toán online';
  }

  return '-';
};

const parseServiceNames = (appointment) => {
  if (Array.isArray(appointment?.selected_services)) {
    return appointment.selected_services
      .map((service) => service?.name || service?.service_name)
      .filter(Boolean);
  }

  return String(appointment?.service_name || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
};

const getAppointmentSortValue = (appointment) => {
  const date = appointment?.appointment_date ? String(appointment.appointment_date).slice(0, 10) : '';
  const time = appointment?.appointment_time || '00:00';
  return new Date(`${date}T${String(time).slice(0, 5) || '00:00'}:00`).getTime() || 0;
};

const getBookingGroupKey = (appointment) =>
  appointment?.booking_id ||
  appointment?.appointment_group_id ||
  appointment?.group_id ||
  appointment?.id ||
  `${appointment?.appointment_date || ''}-${appointment?.appointment_time || ''}-${appointment?.staff_id || appointment?.staff_name || ''}`;

const buildBookingCards = (rows = []) => {
  const grouped = new Map();

  rows.forEach((appointment) => {
    const key = getBookingGroupKey(appointment);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(appointment);
  });

  return [...grouped.values()]
    .map((items) => {
      const base = items[0] || {};
      const services = [
        ...new Set(
          items.flatMap((appointment) => parseServiceNames(appointment))
        )
      ];
      const totalAmount =
        Number(base.payment_amount || 0) ||
        Number(base.total_amount || 0) ||
        Number(base.service_price || 0) ||
        items.reduce((sum, appointment) => sum + Number(appointment.service_price || 0), 0);

      return {
        ...base,
        services: services.length > 0 ? services : [base.service_name || 'Dịch vụ'],
        service_count: Number(base.service_count || services.length || 1),
        booking_total_amount: totalAmount,
        booking_items: items
      };
    })
    .sort((a, b) => getAppointmentSortValue(a) - getAppointmentSortValue(b));
};

const formatBookingDateLabel = (appointment) => {
  if (!appointment?.appointment_date) return 'Chưa có ngày';

  const date = new Date(appointment.appointment_date);
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
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
  const [appointmentPage, setAppointmentPage] = useState(1);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add('my-appointments-scroll-lock');

    return () => {
      document.body.classList.remove('my-appointments-scroll-lock');
    };
  }, []);

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

  const bookingCards = useMemo(() => buildBookingCards(appointments), [appointments]);

  const stats = useMemo(
    () => ({
      total: bookingCards.length,
      pending: bookingCards.filter((item) => isAwaitingStaffConfirmation(item)).length,
      confirmed: bookingCards.filter((item) => item.status === 'confirmed').length,
      completed: bookingCards.filter((item) => item.status === 'completed').length,
      cancellationRequested: bookingCards.filter((item) => hasCancellationRequest(item)).length,
      unpaid: bookingCards.filter((item) => canPayOnline(item)).length
    }),
    [bookingCards]
  );

  const filteredAppointments = useMemo(
    () =>
      bookingCards.filter((appointment) => {
        if (filter === 'all') return true;
        if (filter === 'cancellation_requested') return hasCancellationRequest(appointment);
        if (filter === 'pending') return isAwaitingStaffConfirmation(appointment);
        if (filter === 'unpaid') return canPayOnline(appointment);
        return appointment.status === filter;
      }),
    [bookingCards, filter]
  );

  const appointmentPageCount = Math.max(1, Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE));
  const safeAppointmentPage = Math.min(appointmentPage, appointmentPageCount);
  const appointmentStartIndex = (safeAppointmentPage - 1) * APPOINTMENTS_PER_PAGE;
  const appointmentEndIndex = Math.min(appointmentStartIndex + APPOINTMENTS_PER_PAGE, filteredAppointments.length);
  const paginatedAppointments = filteredAppointments.slice(appointmentStartIndex, appointmentEndIndex);
  const appointmentPageNumbers = Array.from({ length: appointmentPageCount }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === appointmentPageCount || Math.abs(page - safeAppointmentPage) <= 1
  );

  useEffect(() => {
    setAppointmentPage((prev) => Math.min(prev, appointmentPageCount));
  }, [appointmentPageCount]);

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setAppointmentPage(1);
  };

  const requestCancel = async (appointmentId) => {
    const confirmed = window.confirm('Bạn chắc chắn muốn hủy lịch hẹn này?');
    if (!confirmed) return;

    try {
      setProcessingCancelId(appointmentId);
      await bookingService.cancelBooking(appointmentId);
      await fetchAppointments();
      window.alert('Đã hủy lịch hẹn thành công.');
    } catch (err) {
      window.alert(err.response?.data?.message || 'Hủy lịch hẹn thất bại.');
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

  if (loading) {
    return <div className="loading">Đang tải lịch hẹn...</div>;
  }

  return (
    <div className="appointments-page">
      <section className="appointments-page-head">
        <div className="appointments-head-info">
          <h1>Lịch hẹn của tôi</h1>
          <p>Quản lý và theo dõi tất cả lịch hẹn của bạn</p>
        </div>

        <div className="appointment-stats-grid" aria-label="Tóm tắt lịch hẹn">
          <article>
            <span>Tất cả</span>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <span>Chờ xác nhận</span>
            <strong>{stats.pending}</strong>
          </article>
          <article>
            <span>Hoàn thành</span>
            <strong>{stats.completed}</strong>
          </article>
          <article>
            <span>Chờ thanh toán</span>
            <strong>{stats.unpaid}</strong>
          </article>
        </div>
      </section>

      {stats.unpaid > 0 && (
        <div className="online-payment-banner">
          <div>
            <strong>Thanh toán trực tuyến</strong>
            <span>
              Bạn đang có {stats.unpaid} lịch hẹn chưa thanh toán. Có thể mở lại cổng thanh toán online ngay trong từng lịch.
            </span>
          </div>
          <button type="button" className="btn-primary" onClick={() => changeFilter('unpaid')}>
            Xem lịch chưa thanh toán
          </button>
        </div>
      )}

      <div className="filter-buttons">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => changeFilter('all')}>
          Tất cả ({stats.total})
        </button>
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => changeFilter('pending')}>
          Chờ xác nhận ({stats.pending})
        </button>
        <button className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`} onClick={() => changeFilter('confirmed')}>
          Đã xác nhận ({stats.confirmed})
        </button>
        <button
          className={`filter-btn ${filter === 'unpaid' ? 'active' : ''}`}
          onClick={() => changeFilter('unpaid')}
        >
          Chờ thanh toán ({stats.unpaid})
        </button>
        <button
          className={`filter-btn ${filter === 'cancellation_requested' ? 'active' : ''}`}
          onClick={() => changeFilter('cancellation_requested')}
        >
          Chờ hủy ({stats.cancellationRequested})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => changeFilter('completed')}
        >
          Hoàn thành ({stats.completed})
        </button>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="no-appointments">
          <span className="empty-icon">📋</span>
          <p>Bạn chưa có lịch hẹn nào thỏa mãn điều kiện lọc.</p>
        </div>
      ) : (
        <>
        <div className="appointments-list">
          {paginatedAppointments.map((appointment) => {
            const statusInfo = getStatusBadge(appointment);
            const draft = reviewDrafts[appointment.id] || { rating: '5', review: '' };
            const paymentMeta = formatPaymentStatus(appointment.payment_status);
            const totalAmount = appointment.booking_total_amount || appointment.payment_amount || appointment.service_price || 0;
            const hasBillAction = appointment.payment_status === 'paid' && appointment.payment_id;
            const hasPaymentAction = canPayOnline(appointment);
            const hasCancelAction = canRequestCancellation(appointment);

            return (
              <article key={getBookingGroupKey(appointment)} className="appointment-card booking-card">
                <header className="appointment-header">
                  <div className="booking-time-block">
                    <span>Thời gian hẹn</span>
                    <strong>{formatAppointmentTimeRange(appointment)} - {formatBookingDateLabel(appointment)}</strong>
                    <small>Mã lịch #{appointment.id}</small>
                  </div>
                  <div className="booking-header-side">
                    <div className="booking-total booking-total-header">
                      <span>Tổng thanh toán</span>
                      <strong>{formatMoney(totalAmount)}</strong>
                      <small>
                        {formatPaymentMethodLabel(appointment.payment_method)} · {paymentMeta.label}
                      </small>
                    </div>
                    <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                  </div>
                </header>

                <div className="appointment-body">
                  <section className="booking-services-section">
                    <span className="booking-section-label">Dịch vụ trong buổi hẹn</span>
                    <ul className="booking-service-list">
                      {appointment.services.map((serviceName) => (
                        <li key={serviceName}>{serviceName}</li>
                      ))}
                    </ul>
                    <small>
                      Kỹ thuật viên: <strong>{appointment.staff_name || 'Chưa phân công'}</strong>
                      {appointment.duration ? ` · Thời lượng ${appointment.duration} phút` : ''}
                    </small>
                  </section>

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

                  {(hasBillAction || hasPaymentAction || hasCancelAction) && (
                  <footer className="booking-card-footer">
                    <div className="booking-card-actions">
                      {hasBillAction ? (
                        <button type="button" className="btn-secondary" onClick={() => openInvoice(appointment.payment_id)}>
                          Xem bill
                        </button>
                      ) : hasPaymentAction ? (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={processingPaymentId === appointment.id}
                          onClick={() => handleOnlinePayment(appointment)}
                        >
                          {processingPaymentId === appointment.id ? 'Đang tạo giao dịch...' : 'Thanh toán ngay'}
                        </button>
                      ) : null}

                      {hasCancelAction && (
                        <button
                          type="button"
                          onClick={() => requestCancel(appointment.id)}
                          className="btn-danger"
                          disabled={processingCancelId === appointment.id}
                        >
                          {processingCancelId === appointment.id ? 'Đang hủy...' : 'Hủy lịch hẹn'}
                        </button>
                      )}
                    </div>
                  </footer>
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
              </article>
            );
          })}
        </div>

        {filteredAppointments.length > APPOINTMENTS_PER_PAGE && (
          <nav className="appointments-pagination" aria-label="Phân trang lịch hẹn">
            <span>
              {appointmentStartIndex + 1}-{appointmentEndIndex} / {filteredAppointments.length} lịch
            </span>
            <div className="pagination-pages">
              <button
                type="button"
                onClick={() => setAppointmentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeAppointmentPage === 1}
              >
                Trước
              </button>
              {appointmentPageNumbers.map((page, index) => (
                <React.Fragment key={page}>
                  {index > 0 && page - appointmentPageNumbers[index - 1] > 1 ? (
                    <span className="pagination-gap">...</span>
                  ) : null}
                  <button
                    type="button"
                    className={page === safeAppointmentPage ? 'active' : ''}
                    onClick={() => setAppointmentPage(page)}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
              <button
                type="button"
                onClick={() => setAppointmentPage((prev) => Math.min(appointmentPageCount, prev + 1))}
                disabled={safeAppointmentPage === appointmentPageCount}
              >
                Sau
              </button>
            </div>
          </nav>
        )}
        </>
      )}
    </div>
  );
}

export default MyAppointments;
