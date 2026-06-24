import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import './PaymentTransfer.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

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

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const formatTransferStatus = (paymentStatus, isExpiredTransfer) => {
  if (isExpiredTransfer) {
    return 'Đã hết hạn';
  }

  const labelMap = {
    paid: 'Đã thanh toán',
    pending: 'Chờ xác nhận',
    failed: 'Không còn hiệu lực'
  };

  return labelMap[paymentStatus] || '-';
};

function PaymentTransfer() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [regenerating, setRegenerating] = useState(false);

  const fetchPayment = useCallback(
    async (options = {}) => {
      const { silent = false } = options;

      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await paymentService.getPayment(paymentId);
        setPayment(response.data.data || null);
        setNowTs(Date.now());
        setError('');
      } catch (fetchError) {
        if (silent) {
          return;
        }

        setError(fetchError.response?.data?.message || 'Không thể tải thông tin chuyển khoản.');
        setPayment(null);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [paymentId]
  );

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  const expiresAtTs = useMemo(() => {
    if (!payment?.payment_url_expires_at) {
      return 0;
    }

    const parsed = new Date(payment.payment_url_expires_at).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [payment?.payment_url_expires_at]);

  const remainingSeconds = useMemo(() => {
    if (!expiresAtTs) {
      return 0;
    }

    return Math.max(0, Math.ceil((expiresAtTs - nowTs) / 1000));
  }, [expiresAtTs, nowTs]);

  const isExpiredTransfer = useMemo(() => {
    if (!payment || payment.payment_status === 'paid') {
      return false;
    }

    if (payment.gateway_response_code === 'EXPIRED' || payment.gateway_transaction_status === 'EXPIRED') {
      return true;
    }

    return payment.payment_method === 'vietqr' && payment.payment_status === 'pending' && expiresAtTs > 0 && remainingSeconds <= 0;
  }, [payment, expiresAtTs, remainingSeconds]);

  useEffect(() => {
    if (!payment || payment.payment_status !== 'pending' || isExpiredTransfer) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [payment, isExpiredTransfer]);

  useEffect(() => {
    if (!payment || payment.payment_status !== 'pending' || isExpiredTransfer) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchPayment({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [payment, isExpiredTransfer, fetchPayment]);

  const statusMeta = useMemo(() => {
    if (payment?.payment_status === 'paid') {
      return {
        className: 'payment-transfer-status success',
        title: 'Thanh toán đã được xác nhận',
        description: 'Salon đã ghi nhận giao dịch chuyển khoản này thành công và mã QR cũ đã được đóng.'
      };
    }

    if (isExpiredTransfer) {
      return {
        className: 'payment-transfer-status failed',
        title: 'Mã chuyển khoản đã hết hạn',
        description: 'Mã QR này không còn hiệu lực. Bạn hãy tạo mã mới để tiếp tục thanh toán.'
      };
    }

    if (payment?.payment_status === 'failed') {
      return {
        className: 'payment-transfer-status failed',
        title: 'Giao dịch chưa thành công',
        description: 'Bạn có thể tạo lại mã chuyển khoản mới từ lịch hẹn để thanh toán lại.'
      };
    }

    return {
      className: 'payment-transfer-status pending',
      title: 'Quét mã QR để chuyển khoản',
      description: 'Mã QR đã có sẵn đúng số tiền và nội dung. Sau khi chuyển khoản, salon sẽ xác nhận để phát hành bill.'
    };
  }, [payment?.payment_status, isExpiredTransfer]);

  const canGenerateNewCode = payment?.payment_status !== 'paid' && (isExpiredTransfer || payment?.payment_status === 'failed');

  const handleCopy = async (fieldName, value) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(fieldName);
      window.setTimeout(() => {
        setCopiedField((current) => (current === fieldName ? '' : current));
      }, 1800);
    } catch (copyError) {
      window.alert('Không thể sao chép tự động, vui lòng sao chép thủ công.');
    }
  };

  const handleRegenerateTransfer = async () => {
    if (!payment?.appointment_id || regenerating) {
      return;
    }

    try {
      setRegenerating(true);
      const response = await paymentService.createPayment(payment.appointment_id, 'vietqr');
      const paymentUrl = response.data?.payment?.payment_url;
      const nextPaymentId = response.data?.payment?.id;

      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      if (nextPaymentId) {
        navigate(`/payment-transfer/${nextPaymentId}`, { replace: true });
        return;
      }

      await fetchPayment();
    } catch (regenerateError) {
      window.alert(regenerateError.response?.data?.message || 'Không thể tạo mã chuyển khoản mới lúc này.');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải mã chuyển khoản...</div>;
  }

  if (error || !payment) {
    return (
      <div className="payment-transfer-page">
        <div className="alert alert-error">{error || 'Không tìm thấy giao dịch thanh toán.'}</div>
      </div>
    );
  }

  if (payment.payment_method !== 'vietqr') {
    return (
      <div className="payment-transfer-page">
        <div className="alert alert-error">Giao dịch này không sử dụng hình thức chuyển khoản QR.</div>
      </div>
    );
  }

  const isDepositPayment = Number(payment.deposit_required) === 1 && Number(payment.deposit_amount || 0) > 0;

  return (
    <div className="payment-transfer-page">
      <section className="payment-transfer-card">
        <div className={statusMeta.className}>
          <span className="payment-transfer-kicker">Chuyển khoản ngân hàng</span>
          <h1>{statusMeta.title}</h1>
          <p>{statusMeta.description}</p>
        </div>

        <div className="payment-transfer-grid">
          <article className="transfer-qr-panel">
            <div className="transfer-qr-head">
              <h2>Mã QR thanh toán</h2>
              <span>{payment.bank_name || 'Ngân hàng'}</span>
            </div>

            {payment.payment_status === 'paid' ? (
              <div className="transfer-state-box success">
                <strong>Đã xác nhận thanh toán</strong>
                <span>Mã QR này đã tự đóng sau khi giao dịch hoàn tất.</span>
              </div>
            ) : isExpiredTransfer ? (
              <div className="transfer-state-box expired">
                <strong>Mã đã hết hạn</strong>
                <span>Bạn hãy tạo mã mới để tiếp tục chuyển khoản đúng nội dung đối soát.</span>
              </div>
            ) : payment.payment_status !== 'pending' ? (
              <div className="transfer-state-box expired">
                <strong>Mã này không còn dùng được</strong>
                <span>Hệ thống đã đóng mã cũ. Bạn hãy tạo mã mới để tiếp tục thanh toán.</span>
              </div>
            ) : payment.qr_image_url ? (
              <div className="qr-box">
                <img src={payment.qr_image_url} alt="Mã QR thanh toán" />
              </div>
            ) : (
              <div className="alert alert-error">Thiếu cấu hình QR để hiển thị mã thanh toán.</div>
            )}

            <div className="transfer-amount-box">
              <span>{isDepositPayment ? 'Số tiền cọc cần chuyển' : 'Số tiền cần chuyển'}</span>
              <strong>{formatMoney(payment.amount)}</strong>
            </div>

            {payment.payment_status === 'pending' && !isExpiredTransfer && (
              <div className={remainingSeconds <= 60 ? 'transfer-expire-box urgent' : 'transfer-expire-box'}>
                <span>Thời gian còn lại</span>
                <strong>{formatCountdown(remainingSeconds)}</strong>
                <small>Hết thời gian này, mã sẽ tự đóng và bạn cần tạo mã mới.</small>
              </div>
            )}
          </article>

          <article className="transfer-info-panel">
            <h2>Thông tin chuyển khoản</h2>

            <div className="transfer-copy-grid">
              <div className="transfer-copy-item">
                <span>Ngân hàng</span>
                <strong>{payment.bank_name || '-'}</strong>
              </div>

              <div className="transfer-copy-item">
                <span>Số tài khoản</span>
                <strong>{payment.account_number || '-'}</strong>
                <button type="button" className="btn-secondary" onClick={() => handleCopy('account', payment.account_number)}>
                  {copiedField === 'account' ? 'Đã sao chép' : 'Sao chép'}
                </button>
              </div>

              <div className="transfer-copy-item">
                <span>Chủ tài khoản</span>
                <strong>{payment.account_holder || '-'}</strong>
              </div>

              <div className="transfer-copy-item">
                <span>Nội dung chuyển khoản</span>
                <strong>{payment.transfer_content || payment.payment_reference || '-'}</strong>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleCopy('content', payment.transfer_content || payment.payment_reference)}
                >
                  {copiedField === 'content' ? 'Đã sao chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            <div className="transfer-summary">
              <div className="payment-line">
                <span>Hóa đơn</span>
                <strong>{payment.invoice_number}</strong>
              </div>
              <div className="payment-line">
                <span>Dịch vụ</span>
                <strong>{payment.service_name || '-'}</strong>
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
                <span>Hiệu lực đến</span>
                <strong>{formatDateTime(payment.payment_url_expires_at)}</strong>
              </div>
              <div className="payment-line">
                <span>Trạng thái</span>
                <strong>{formatTransferStatus(payment.payment_status, isExpiredTransfer)}</strong>
              </div>
              {isDepositPayment && (
                <>
                  <div className="payment-line">
                    <span>Tổng dịch vụ</span>
                    <strong>{formatMoney(payment.total_amount || payment.service_price)}</strong>
                  </div>
                  <div className="payment-line">
                    <span>Còn lại sau cọc</span>
                    <strong>{formatMoney(payment.remaining_amount)}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="transfer-support-note">
              <strong>Lưu ý:</strong> Hãy giữ nguyên nội dung chuyển khoản để salon đối soát nhanh và xuất bill đúng giao dịch.
            </div>
          </article>
        </div>

        <div className="payment-transfer-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchPayment()} disabled={regenerating}>
            Tải lại trạng thái
          </button>
          {canGenerateNewCode && (
            <button type="button" className="btn-secondary" onClick={handleRegenerateTransfer} disabled={regenerating}>
              {regenerating ? 'Đang tạo mã mới...' : 'Tạo mã mới'}
            </button>
          )}
          <Link to="/my-appointments" className="btn-primary payment-transfer-link">
            Về lịch của tôi
          </Link>
          {payment.payment_status === 'paid' && (
            <Link to={`/payment-bill/${payment.id}`} className="btn-secondary payment-transfer-link secondary">
              Xem bill
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default PaymentTransfer;
