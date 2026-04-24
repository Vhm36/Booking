/**
 * REACT COMPONENTS - Frontend UI Components
 * Location: /frontend/src/components/voucher/
 */

// ===================================================================
// File 1: MyVouchers.jsx
// Customer's voucher dashboard
// ===================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VoucherCard from './VoucherCard';
import VoucherBadge from './VoucherBadge';
import './MyVouchers.css';

const MyVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, valid, expiring, expired

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const response = await axios.get('/api/my-vouchers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVouchers(response.data.vouchers);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredVouchers = () => {
    return vouchers.filter(v => {
      if (filter === 'valid') return v.status === 'valid';
      if (filter === 'expiring') return v.status === 'expiring_soon';
      if (filter === 'expired') return v.status === 'expired';
      return true;
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert('Mã voucher đã được sao chép!');
  };

  if (loading) return <div className="loading">Đang tải...</div>;

  const filtered = getFilteredVouchers();

  return (
    <div className="my-vouchers">
      <div className="header">
        <h1>🎟️ Vouchers của bạn</h1>
        <p>Bạn có {vouchers.length} vouchers</p>
      </div>

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Tất cả ({vouchers.length})
        </button>
        <button
          className={filter === 'valid' ? 'active' : ''}
          onClick={() => setFilter('valid')}
        >
          Có hiệu lực ({vouchers.filter(v => v.status === 'valid').length})
        </button>
        <button
          className={filter === 'expiring' ? 'active' : ''}
          onClick={() => setFilter('expiring')}
        >
          Sắp hết ({vouchers.filter(v => v.status === 'expiring_soon').length})
        </button>
        <button
          className={filter === 'expired' ? 'active' : ''}
          onClick={() => setFilter('expired')}
        >
          Hết hạn ({vouchers.filter(v => v.status === 'expired').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa có voucher nào</p>
          <button onClick={() => window.location.href = '/shop'}>
            🛍️ Khám phá dịch vụ
          </button>
        </div>
      ) : (
        <div className="vouchers-grid">
          {filtered.map(voucher => (
            <div key={voucher.id} className="voucher-item">
              <VoucherBadge status={voucher.status} daysRemaining={voucher.days_remaining} />
              <VoucherCard voucher={voucher} onCopyCode={handleCopyCode} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyVouchers;

// ===================================================================
// File 2: VoucherCard.jsx
// Single voucher card component
// ===================================================================

const VoucherCard = ({ voucher, onCopyCode }) => {
  const getDiscountDisplay = () => {
    if (voucher.voucher_type === 'percentage') {
      return `-${voucher.discount_percent}%`;
    } else if (voucher.voucher_type === 'free_delivery') {
      return 'Miễn phí';
    } else {
      return `-${voucher.discount_amount.toLocaleString()} VND`;
    }
  };

  return (
    <div className="voucher-card">
      <div className="voucher-header">
        <h3>{getDiscountDisplay()}</h3>
        <span className="customer-type">{voucher.customer_type === 'vip' ? '⭐ VIP' : 'Regular'}</span>
      </div>

      <div className="voucher-description">
        <p>{voucher.description}</p>
      </div>

      <div className="voucher-code-section">
        <input
          type="text"
          value={voucher.code}
          readOnly
          className="voucher-code-input"
        />
        <button
          className="copy-btn"
          onClick={() => onCopyCode(voucher.code)}
          title="Sao chép mã"
        >
          📋
        </button>
      </div>

      <div className="voucher-details">
        {voucher.min_order_value && (
          <span>Tối thiểu: {voucher.min_order_value.toLocaleString()} VND</span>
        )}
        {voucher.max_discount_amount && (
          <span>Tối đa: {voucher.max_discount_amount.toLocaleString()} VND</span>
        )}
      </div>

      <div className="voucher-expiry">
        Hết hạn: {new Date(voucher.expiry_date).toLocaleDateString('vi-VN')}
      </div>
    </div>
  );
};

// ===================================================================
// File 3: SuggestedVoucher.jsx
// Auto-suggested voucher banner
// ===================================================================

const SuggestedVoucher = () => {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get('/api/vouchers/suggestions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.data.suggestions.length > 0) {
        setSuggestion(response.data.suggestions[0]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !suggestion) return null;

  const getReasonText = (reason) => {
    const reasons = {
      'comeback': '👋 Bạn lâu không mua rồi',
      'category_preference': '💰 Dịch vụ bạn yêu thích',
      'vip_exclusive': '⭐ Ưu đãi VIP độc quyền',
      'new_service': '✨ Dịch vụ mới'
    };
    return reasons[reason] || 'Đặc biệt dành cho bạn';
  };

  return (
    <div className="suggested-voucher-banner">
      <div className="banner-content">
        <p className="reason">{getReasonText(suggestion.reason)}</p>
        <div className="offer-details">
          <span className="icon">🎁</span>
          <div>
            <h4>Nhận ngay voucher</h4>
            <p>{suggestion.confidence * 100}% khớp với bạn</p>
          </div>
        </div>
      </div>
      <button className="cta-button" onClick={() => document.querySelector('.suggested-voucher').scrollIntoView()}>
        Xem ngay →
      </button>
    </div>
  );
};

// ===================================================================
// File 4: CheckoutVoucherSelector.jsx
// Multi-voucher selection in checkout
// ===================================================================

const CheckoutVoucherSelector = ({ subtotal, onVouchersChange }) => {
  const [myVouchers, setMyVouchers] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    fetchMyVouchers();
  }, []);

  const fetchMyVouchers = async () => {
    try {
      const response = await axios.get('/api/my-vouchers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMyVouchers(response.data.vouchers.filter(v => v.status !== 'expired'));
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    }
  };

  const handleVoucherSelect = async (code) => {
    try {
      const response = await axios.post(
        '/api/vouchers/apply',
        {
          codes: selectedCodes.includes(code)
            ? selectedCodes.filter(c => c !== code)
            : [...selectedCodes, code],
          subtotal
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      if (response.data.valid) {
        setSelectedCodes(response.data.applied);
        setTotalDiscount(response.data.totalDiscount);
        setValidationMessage('');
        onVouchersChange(response.data);
      }
    } catch (error) {
      setValidationMessage(error.response?.data?.message || 'Lỗi xác nhận voucher');
    }
  };

  return (
    <div className="checkout-voucher-selector">
      <h3>💳 Áp dụng voucher</h3>

      {validationMessage && <div className="error-message">{validationMessage}</div>}

      <div className="vouchers-list">
        {myVouchers.map(voucher => (
          <label key={voucher.id} className="voucher-checkbox">
            <input
              type="checkbox"
              checked={selectedCodes.includes(voucher.code)}
              onChange={() => handleVoucherSelect(voucher.code)}
            />
            <span className="voucher-info">
              <strong>{voucher.code}</strong>
              <span className="discount">{voucher.discount_percent ? `-${voucher.discount_percent}%` : 'Miễn phí'}</span>
              <span className="expiry">Hết {new Date(voucher.expiry_date).toLocaleDateString('vi-VN')}</span>
            </span>
          </label>
        ))}
      </div>

      {totalDiscount > 0 && (
        <div className="discount-summary">
          <p>Tiết kiệm được: <strong>{totalDiscount.toLocaleString()} VND</strong></p>
        </div>
      )}
    </div>
  );
};

// ===================================================================
// File 5: BillModal.jsx
// Auto-bill display modal after payment
// ===================================================================

const BillModal = ({ billData, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bill-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✓ Thanh toán thành công</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="bill-content">
          <div className="bill-info">
            <div className="info-row">
              <span>Mã biên lai:</span>
              <strong>{billData.billNumber}</strong>
            </div>
            <div className="info-row">
              <span>Ngày:</span>
              <span>{new Date().toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          <div className="bill-items">
            <h4>Chi tiết:</h4>
            {billData.services.map(service => (
              <div key={service.id} className="item-row">
                <span>{service.name}</span>
                <span>{(service.price * service.quantity).toLocaleString()} VND</span>
              </div>
            ))}
          </div>

          <div className="bill-total">
            <div className="row">
              <span>Cộng tiền:</span>
              <span>{billData.subtotal.toLocaleString()} VND</span>
            </div>
            {billData.voucherDiscount > 0 && (
              <div className="row discount">
                <span>Giảm giá:</span>
                <span>-{billData.voucherDiscount.toLocaleString()} VND</span>
              </div>
            )}
            <div className="row">
              <span>Thuế:</span>
              <span>{billData.taxAmount.toLocaleString()} VND</span>
            </div>
            <div className="row total">
              <span>Tổng cộng:</span>
              <strong>{billData.totalAmount.toLocaleString()} VND</strong>
            </div>
          </div>

          <div className="bill-actions">
            <button className="btn-download" onClick={() => window.location.href = billData.pdfUrl}>
              📥 Tải xuống PDF
            </button>
            <button className="btn-email" onClick={() => alert('Biên lai đã được gửi tới email của bạn')}>
              📧 Gửi email
            </button>
          </div>

          <p className="bill-note">
            📧 Biên lai đã được gửi tới email: {billData.customerEmail}
          </p>
        </div>
      </div>
    </div>
  );
};

export { MyVouchers, VoucherCard, SuggestedVoucher, CheckoutVoucherSelector, BillModal };
