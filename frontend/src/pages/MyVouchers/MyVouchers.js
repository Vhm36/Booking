import React, { useEffect, useMemo, useState } from 'react';
import VoucherIcon from '../../components/VoucherIcon';
import voucherService from '../../services/voucherService';
import { formatVnd } from '../../utils/formatters';
import './MyVouchers.css';

const VOUCHERS_PER_PAGE = 4;

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
  const [voucherPage, setVoucherPage] = useState(1);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await voucherService.getMyVouchers();
      setVouchers(response.data?.data || []);
      setVoucherPage(1);
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

  const sortedVouchers = useMemo(() => {
    const statusOrder = {
      expiring_soon: 0,
      active: 1,
      inactive: 2,
      used: 3,
      expired: 4
    };

    return [...vouchers].sort((a, b) => {
      const firstStatus = statusOrder[a.status] ?? 9;
      const secondStatus = statusOrder[b.status] ?? 9;

      if (firstStatus !== secondStatus) {
        return firstStatus - secondStatus;
      }

      return new Date(a.expiry_date || '2999-12-31') - new Date(b.expiry_date || '2999-12-31');
    });
  }, [vouchers]);

  const activeCount = useMemo(
    () => vouchers.filter((voucher) => ['active', 'expiring_soon'].includes(voucher.status)).length,
    [vouchers]
  );

  const voucherPageCount = Math.max(1, Math.ceil(sortedVouchers.length / VOUCHERS_PER_PAGE));
  const safeVoucherPage = Math.min(voucherPage, voucherPageCount);
  const voucherStartIndex = (safeVoucherPage - 1) * VOUCHERS_PER_PAGE;
  const voucherEndIndex = Math.min(voucherStartIndex + VOUCHERS_PER_PAGE, sortedVouchers.length);
  const paginatedVouchers = sortedVouchers.slice(voucherStartIndex, voucherEndIndex);
  const voucherPageNumbers = Array.from({ length: voucherPageCount }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === voucherPageCount || Math.abs(page - safeVoucherPage) <= 1
  );

  useEffect(() => {
    setVoucherPage((prev) => Math.min(prev, voucherPageCount));
  }, [voucherPageCount]);

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
        <div className="voucher-head-title">
          <span className="voucher-head-icon">
            <VoucherIcon className="voucher-head-svg" />
          </span>
          <div>
            <p>BeautyBook</p>
            <h1>Voucher của tôi</h1>
          </div>
        </div>
        <div className="voucher-count">
          <strong>{activeCount}</strong>
          <span>khả dụng</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {vouchers.length === 0 ? (
        <section className="voucher-empty">
          <span className="empty-icon">🎟️</span>
          <h2>Chưa có voucher</h2>
          <p>Các ưu đãi được admin hoặc hệ thống gợi ý sẽ xuất hiện tại đây.</p>
        </section>
      ) : (
        <>
        <section className="voucher-grid">
          {paginatedVouchers.map((voucher) => (
            <article key={voucher.assignment_id || voucher.id} className={`voucher-card ${voucher.status}`}>
              <div className="voucher-card-top">
                <span>{statusLabel[voucher.status] || voucher.status}</span>
                <strong>{voucher.discount_label}</strong>
              </div>
              <h2>{voucher.code}</h2>
              <p>{voucher.description || 'Ưu đãi BeautyBook'}</p>
              <div className="voucher-meta-grid">
                <div className="voucher-meta">
                  <span>Đơn tối thiểu</span>
                  <strong>{formatVnd(voucher.min_order_value)}</strong>
                </div>
                {voucher.max_discount_amount ? (
                  <div className="voucher-meta">
                    <span>Giảm tối đa</span>
                    <strong>{formatVnd(voucher.max_discount_amount)}</strong>
                  </div>
                ) : (
                  <div className="voucher-meta">
                    <span>Giảm tối đa</span>
                    <strong>Không giới hạn</strong>
                  </div>
                )}
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
        {sortedVouchers.length > VOUCHERS_PER_PAGE && (
          <nav className="voucher-pagination" aria-label="Phân trang voucher">
            <span>
              {voucherStartIndex + 1}-{voucherEndIndex} / {sortedVouchers.length} voucher
            </span>
            <div className="pagination-pages">
              <button
                type="button"
                onClick={() => setVoucherPage((prev) => Math.max(1, prev - 1))}
                disabled={safeVoucherPage === 1}
              >
                Trước
              </button>
              {voucherPageNumbers.map((page, index) => (
                <React.Fragment key={page}>
                  {index > 0 && page - voucherPageNumbers[index - 1] > 1 ? (
                    <span className="pagination-gap">...</span>
                  ) : null}
                  <button
                    type="button"
                    className={page === safeVoucherPage ? 'active' : ''}
                    onClick={() => setVoucherPage(page)}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
              <button
                type="button"
                onClick={() => setVoucherPage((prev) => Math.min(voucherPageCount, prev + 1))}
                disabled={safeVoucherPage === voucherPageCount}
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

export default MyVouchers;
