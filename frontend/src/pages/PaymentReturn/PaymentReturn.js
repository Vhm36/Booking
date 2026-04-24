import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import './PaymentReturn.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('vi-VN');
};

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'vietqr') {
    return 'Chuyển khoản ngân hàng';
  }

  if (paymentMethod === 'cash') {
    return 'Thanh toán tại salon';
  }

  if (paymentMethod === 'vnpay') {
    return 'Thanh toán online';
  }

  return paymentMethod || '-';
};

function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const paymentId = searchParams.get('payment_id');
  const resultStatus = searchParams.get('status') || 'error';
  const resultCode = searchParams.get('code') || '';
  const resultMessage = searchParams.get('message') || '';

  useEffect(() => {
    let cancelled = false;

    const fetchPayment = async () => {
      if (!paymentId) {
        setLoading(false);
        setFetchError('Không tìm thấy giao dịch cần đối soát.');
        return;
      }

      try {
        setLoading(true);
        const response = await paymentService.getPayment(paymentId);
        if (!cancelled) {
          setPayment(response.data.data || null);
          setFetchError('');
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error.response?.data?.message || 'Không thể tải thông tin giao dịch.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPayment();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const statusMeta = useMemo(() => {
    if (resultStatus === 'success' || payment?.payment_status === 'paid') {
      return {
        className: 'payment-status success',
        title: 'Thanh toán thành công',
        description:
          'Giao dịch đã được ghi nhận. Bạn có thể xem bill, in hóa đơn và theo dõi lịch hẹn ngay trong tài khoản.'
      };
    }

    if (resultStatus === 'failed' || payment?.payment_status === 'failed') {
      return {
        className: 'payment-status failed',
        title: 'Thanh toán chưa thành công',
        description:
          'Lịch hẹn vẫn được lưu. Bạn có thể quay lại danh sách lịch của tôi để thử thanh toán online lại bất cứ lúc nào.'
      };
    }

    return {
      className: 'payment-status pending',
      title: 'Đang đối soát giao dịch',
      description:
        'Hệ thống đang đối soát kết quả thanh toán. Nếu bạn đã bị trừ tiền nhưng trạng thái chưa cập nhật, hãy chờ thêm ít phút rồi tải lại.'
    };
  }, [payment?.payment_status, resultStatus]);

  const openInvoice = () => {
    if (!payment?.id) {
      return;
    }

    window.open(`/payment-bill/${payment.id}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <div className="loading">Đang đối soát giao dịch...</div>;
  }

  return (
    <div className="payment-return-page">
      <section className="payment-return-card">
        <div className={statusMeta.className}>
          <span className="payment-status-kicker">Kết quả thanh toán online</span>
          <h1>{statusMeta.title}</h1>
          <p>{statusMeta.description}</p>
        </div>

        {resultMessage && (
          <div className="payment-return-note">
            <strong>Thông báo:</strong> {resultMessage}
            {resultCode ? ` (mã ${resultCode})` : ''}
          </div>
        )}

        {fetchError && <div className="alert alert-error">{fetchError}</div>}

        {payment && (
          <div className="payment-return-grid">
            <article className="payment-return-panel">
              <h2>Thông tin giao dịch</h2>
              <div className="payment-line">
                <span>Hóa đơn</span>
                <strong>{payment.invoice_number}</strong>
              </div>
              <div className="payment-line">
                <span>Dịch vụ</span>
                <strong>{payment.service_name || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Số tiền</span>
                <strong>{formatMoney(payment.amount || payment.payment_amount)}</strong>
              </div>
              <div className="payment-line">
                <span>Phương thức</span>
                <strong>{formatPaymentMethodLabel(payment.payment_method)}</strong>
              </div>
              <div className="payment-line">
                <span>Trạng thái</span>
                <strong>{payment.payment_status || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Mã giao dịch</span>
                <strong>{payment.transaction_code || payment.payment_reference || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Thanh toán lúc</span>
                <strong>{formatDateTime(payment.paid_at)}</strong>
              </div>
            </article>

            <article className="payment-return-panel">
              <h2>Lịch hẹn liên quan</h2>
              <div className="payment-line">
                <span>Khách hàng</span>
                <strong>{payment.customer_name || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Email</span>
                <strong>{payment.customer_email || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Ngày hẹn</span>
                <strong>{formatDateTime(payment.appointment_date)}</strong>
              </div>
              <div className="payment-line">
                <span>Giờ hẹn</span>
                <strong>{payment.appointment_time || '-'}</strong>
              </div>
              <div className="payment-line">
                <span>Nhân viên</span>
                <strong>{payment.staff_name || 'Chưa phân công'}</strong>
              </div>
              <div className="payment-line">
                <span>Trạng thái lịch</span>
                <strong>{payment.appointment_status || '-'}</strong>
              </div>
            </article>
          </div>
        )}

        <div className="payment-return-actions">
          <Link to="/my-appointments" className="btn-primary payment-return-link">
            Về lịch của tôi
          </Link>
          {payment?.payment_status === 'paid' && (
            <button type="button" className="btn-secondary" onClick={openInvoice}>
              Xem bill
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default PaymentReturn;
