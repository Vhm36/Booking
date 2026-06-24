import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import './PaymentInvoice.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'cash') {
    return 'Tiền mặt tại salon';
  }

  if (paymentMethod === 'banking') {
    return 'Chuyển khoản tại salon';
  }

  if (paymentMethod === 'vietqr') {
    return 'VietQR ngân hàng';
  }

  if (paymentMethod === 'vnpay') {
    return 'VNPay online';
  }

  return paymentMethod || '-';
};

const formatDateTime = (value, includeTime = true) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('vi-VN', includeTime ? undefined : { dateStyle: 'short' });
};

function PaymentInvoice() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchPayment = async () => {
      try {
        setLoading(true);
        const response = await paymentService.getPayment(paymentId);
        if (!cancelled) {
          setPayment(response.data.data || null);
          setError('');
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.response?.data?.message || 'Không thể tải bill thanh toán.');
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

  const statusLabel = useMemo(() => {
    if (!payment) {
      return '-';
    }

    if (payment.payment_status === 'paid') {
      return 'Đã thanh toán';
    }

    if (payment.payment_status === 'failed') {
      return 'Thất bại';
    }

    return 'Chờ thanh toán';
  }, [payment]);

  if (loading) {
    return <div className="loading">Đang tải bill...</div>;
  }

  if (!payment || error) {
    return (
      <div className="payment-invoice-page">
        <div className="alert alert-error">{error || 'Không tìm thấy giao dịch.'}</div>
      </div>
    );
  }

  const isDepositPayment = Number(payment.deposit_required) === 1 && Number(payment.deposit_amount || 0) > 0;

  return (
    <div className="payment-invoice-page">
      <section className="invoice-toolbar no-print">
        <Link to="/my-appointments" className="invoice-link-back">
          Về lịch của tôi
        </Link>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          In bill
        </button>
      </section>

      <section className="invoice-sheet">
        <header className="invoice-header">
          <div>
            <span className="invoice-kicker">Beauty Booking</span>
            <h1>Hóa đơn dịch vụ</h1>
            <p>Bill được tạo từ giao dịch thanh toán để đối soát và in lưu trữ.</p>
          </div>
          <div className="invoice-status-box">
            <span>Số hóa đơn</span>
            <strong>{payment.invoice_number}</strong>
            <small>{statusLabel}</small>
          </div>
        </header>

        <div className="invoice-grid">
          <article className="invoice-card">
            <h2>Khách hàng</h2>
            <div className="invoice-row">
              <span>Họ tên</span>
              <strong>{payment.customer_name || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Email</span>
              <strong>{payment.customer_email || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Số điện thoại</span>
              <strong>{payment.customer_phone || '-'}</strong>
            </div>
          </article>

          <article className="invoice-card">
            <h2>Giao dịch</h2>
            <div className="invoice-row">
              <span>Phương thức</span>
              <strong>{formatPaymentMethodLabel(payment.payment_method)}</strong>
            </div>
            <div className="invoice-row">
              <span>Mã đối soát</span>
              <strong>{payment.payment_reference || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Mã giao dịch ngân hàng</span>
              <strong>{payment.transaction_code || payment.bank_transaction_no || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Thanh toán lúc</span>
              <strong>{formatDateTime(payment.paid_at)}</strong>
            </div>
          </article>
        </div>

        <article className="invoice-detail-card">
          <h2>Chi tiết lịch hẹn</h2>
          <div className="invoice-detail-grid">
            <div className="invoice-row">
              <span>Dịch vụ</span>
              <strong>{payment.service_name || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Nhân viên</span>
              <strong>{payment.staff_name || 'Chưa phân công'}</strong>
            </div>
            <div className="invoice-row">
              <span>Ngày hẹn</span>
              <strong>{formatDateTime(payment.appointment_date, false)}</strong>
            </div>
            <div className="invoice-row">
              <span>Giờ hẹn</span>
              <strong>{payment.appointment_time || '-'}</strong>
            </div>
            <div className="invoice-row">
              <span>Giá dịch vụ</span>
              <strong>{formatMoney(payment.total_amount || payment.service_price || payment.amount)}</strong>
            </div>
            <div className="invoice-row">
              <span>{isDepositPayment ? 'Tiền cọc đã thu' : 'Thành tiền'}</span>
              <strong>{formatMoney(payment.amount)}</strong>
            </div>
            {isDepositPayment && (
              <div className="invoice-row">
                <span>Còn lại sau cọc</span>
                <strong>{formatMoney(payment.remaining_amount)}</strong>
              </div>
            )}
          </div>
        </article>

        <section className="invoice-total-card">
          <div className="invoice-total-line">
            <span>{isDepositPayment ? 'Tổng cọc đã thanh toán' : 'Tổng thanh toán'}</span>
            <strong>{formatMoney(payment.amount)}</strong>
          </div>
          {isDepositPayment && (
            <div className="invoice-total-line compact">
              <span>Còn lại khi dùng dịch vụ</span>
              <strong>{formatMoney(payment.remaining_amount)}</strong>
            </div>
          )}
          <div className="invoice-total-line compact">
            <span>Trạng thái</span>
            <strong>{statusLabel}</strong>
          </div>
        </section>
      </section>
    </div>
  );
}

export default PaymentInvoice;
