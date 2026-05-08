import React, { useEffect, useMemo, useState } from 'react';
import voucherService from '../../services/voucherService';
import { formatVnd } from '../../utils/formatters';
import './MyVouchers.css';

const statusLabel = {
  active: 'Đang dùng',
  expiring_soon: 'Sắp hết hạn',
  expired: 'Hết hạn',
  used: 'Đã dùng',
  inactive: 'Tạm tắt'
};

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Chưa có';
  }

  return parsed.toLocaleDateString('vi-VN');
};

function MyVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await voucherService.getMyVouchers();
      setVouchers(response.data?.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải voucher.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const activeCount = useMemo(
    () => vouchers.filter((voucher) => ['active', 'expiring_soon'].includes(voucher.status)).length,
    [vouchers]
  );

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 1600);
    } catch (err) {
      setCopiedCode('');
    }
  };

  if (loading) {
    return <div className="loading">Đang tải voucher...</div>;
  }

  return (
    <div className="my-vouchers-page">
      <section className="voucher-page-head">
        <div>
          <p>BeautyBook</p>
          <h1>Voucher của tôi</h1>
        </div>
        <div className="voucher-count">
          <strong>{activeCount}</strong>
          <span>khả dụng</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {vouchers.length === 0 ? (
        <section className="voucher-empty">
          <h2>Chưa có voucher</h2>
          <p>Các ưu đãi được admin hoặc hệ thống gợi ý sẽ xuất hiện tại đây.</p>
        </section>
      ) : (
        <section className="voucher-grid">
          {vouchers.map((voucher) => (
            <article key={voucher.assignment_id || voucher.id} className={`voucher-card ${voucher.status}`}>
              <div className="voucher-card-top">
                <span>{statusLabel[voucher.status] || voucher.status}</span>
                <strong>{voucher.discount_label}</strong>
              </div>
              <h2>{voucher.code}</h2>
              <p>{voucher.description || 'Ưu đãi BeautyBook'}</p>
              <div className="voucher-meta">
                <span>Đơn tối thiểu</span>
                <strong>{formatVnd(voucher.min_order_value)}</strong>
              </div>
              {voucher.max_discount_amount ? (
                <div className="voucher-meta">
                  <span>Giảm tối đa</span>
                  <strong>{formatVnd(voucher.max_discount_amount)}</strong>
                </div>
              ) : null}
              <div className="voucher-meta">
                <span>Hạn dùng</span>
                <strong>{formatDate(voucher.expiry_date)}</strong>
              </div>
              <div className="voucher-meta">
                <span>Lượt dùng</span>
                <strong>
                  {Number(voucher.usage_count || 0)}/{Number(voucher.max_usage_customer || 1)}
                </strong>
              </div>
              <button
                type="button"
                className="voucher-copy-btn"
                onClick={() => copyCode(voucher.code)}
                disabled={!['active', 'expiring_soon'].includes(voucher.status)}
              >
                {copiedCode === voucher.code ? 'Đã sao chép' : 'Sao chép mã'}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default MyVouchers;
