import React, { useEffect, useMemo, useState } from 'react';
import customerService from '../../../services/customerService';
import voucherService from '../../../services/voucherService';
import { formatVnd } from '../../../utils/formatters';
import './ManageVouchers.css';

const emptyForm = {
  code: '',
  voucher_type: 'percentage',
  discount_percent: '15',
  discount_amount: '',
  min_order_value: '300000',
  max_discount_amount: '120000',
  customer_type: 'both',
  valid_days: '7',
  max_usage_global: '100',
  description: ''
};

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa có';
  return parsed.toLocaleDateString('vi-VN');
};

const getDiscountText = (voucher) => {
  if (voucher.voucher_type === 'percentage') {
    return `-${Number(voucher.discount_percent || 0)}%`;
  }

  return `-${formatVnd(voucher.discount_amount)}`;
};

function ManageVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [assignByVoucher, setAssignByVoucher] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [voucherRes, customerRes, analyticsRes] = await Promise.all([
        voucherService.getAllVouchers(),
        customerService.getAllCustomers(),
        voucherService.getAnalytics()
      ]);

      setVouchers(voucherRes.data?.data || []);
      setCustomers(customerRes.data?.data || []);
      setAnalytics(analyticsRes.data?.data || null);
      setFeedback({ type: '', text: '' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Không thể tải dữ liệu voucher.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeVouchers = useMemo(
    () => vouchers.filter((voucher) => voucher.status === 'active' && new Date(voucher.expiry_date) > new Date()).length,
    [vouchers]
  );

  const updateField = (field, value) => {
    setFeedback({ type: '', text: '' });
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => {
    const payload = {
      code: formData.code.trim() || undefined,
      voucher_type: formData.voucher_type,
      min_order_value: Number(formData.min_order_value || 0),
      max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
      customer_type: formData.customer_type,
      valid_days: Number(formData.valid_days || 7),
      max_usage_global: formData.max_usage_global ? Number(formData.max_usage_global) : null,
      description: formData.description.trim()
    };

    if (formData.voucher_type === 'percentage') {
      payload.discount_percent = Number(formData.discount_percent || 0);
      payload.discount_amount = 0;
    } else {
      payload.discount_amount = Number(formData.discount_amount || 0);
      payload.discount_percent = null;
      payload.max_discount_amount = null;
    }

    return payload;
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await voucherService.createVoucher(buildPayload());
      setFormData(emptyForm);
      setFeedback({ type: 'success', text: 'Đã tạo voucher.' });
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Tạo voucher thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  const updateAssignState = (voucherId, patch) => {
    setAssignByVoucher((prev) => ({
      ...prev,
      [voucherId]: {
        customer_id: '',
        send_email: false,
        ...(prev[voucherId] || {}),
        ...patch
      }
    }));
  };

  const handleAssign = async (voucherId) => {
    const state = assignByVoucher[voucherId] || {};
    if (!state.customer_id) {
      setFeedback({ type: 'error', text: 'Vui lòng chọn khách hàng để gán voucher.' });
      return;
    }

    try {
      setSaving(true);
      await voucherService.assignVoucher(voucherId, {
        customer_id: Number(state.customer_id),
        send_email: Boolean(state.send_email)
      });
      setFeedback({ type: 'success', text: 'Đã gán voucher cho khách hàng.' });
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Gán voucher thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (voucherId) => {
    try {
      setSaving(true);
      await voucherService.deleteVoucher(voucherId);
      setFeedback({ type: 'success', text: 'Đã tắt voucher.' });
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Không thể tắt voucher.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải voucher...</div>;
  }

  return (
    <div className="manage-vouchers-page">
      <section className="voucher-admin-head">
        <div>
          <p>Admin</p>
          <h1>Quản lý voucher</h1>
        </div>
        <div className="voucher-admin-stats">
          <span>
            <strong>{vouchers.length}</strong>
            tổng mã
          </span>
          <span>
            <strong>{activeVouchers}</strong>
            đang chạy
          </span>
          <span>
            <strong>{Number(analytics?.summary?.total_usage || 0)}</strong>
            lượt dùng
          </span>
        </div>
      </section>

      {feedback.text && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

      <section className="voucher-admin-layout">
        <form className="voucher-form" onSubmit={handleCreate}>
          <h2>Tạo voucher</h2>

          <label>
            Mã voucher
            <input
              value={formData.code}
              onChange={(event) => updateField('code', event.target.value)}
              placeholder="Tự tạo nếu bỏ trống"
            />
          </label>

          <label>
            Loại giảm
            <select
              value={formData.voucher_type}
              onChange={(event) => updateField('voucher_type', event.target.value)}
            >
              <option value="percentage">Phần trăm</option>
              <option value="fixed">Số tiền</option>
            </select>
          </label>

          {formData.voucher_type === 'percentage' ? (
            <>
              <label>
                Phần trăm giảm
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(event) => updateField('discount_percent', event.target.value)}
                  required
                />
              </label>
              <label>
                Giảm tối đa
                <input
                  type="number"
                  min="0"
                  value={formData.max_discount_amount}
                  onChange={(event) => updateField('max_discount_amount', event.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Số tiền giảm
              <input
                type="number"
                min="1000"
                value={formData.discount_amount}
                onChange={(event) => updateField('discount_amount', event.target.value)}
                required
              />
            </label>
          )}

          <label>
            Đơn tối thiểu
            <input
              type="number"
              min="0"
              value={formData.min_order_value}
              onChange={(event) => updateField('min_order_value', event.target.value)}
            />
          </label>

          <label>
            Nhóm khách
            <select
              value={formData.customer_type}
              onChange={(event) => updateField('customer_type', event.target.value)}
            >
              <option value="both">Tất cả</option>
              <option value="regular">Thành viên thường</option>
              <option value="vip">VIP</option>
              <option value="vvip">VVIP</option>
              <option value="vvvip">VVVIP</option>
            </select>
          </label>

          <label>
            Hạn dùng (ngày)
            <input
              type="number"
              min="1"
              value={formData.valid_days}
              onChange={(event) => updateField('valid_days', event.target.value)}
            />
          </label>

          <label>
            Lượt dùng toàn hệ thống
            <input
              type="number"
              min="1"
              value={formData.max_usage_global}
              onChange={(event) => updateField('max_usage_global', event.target.value)}
            />
          </label>

          <label className="voucher-form-wide">
            Mô tả
            <textarea
              rows="3"
              value={formData.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Ưu đãi dành cho lần đặt lịch tiếp theo"
            />
          </label>

          <button type="submit" className="voucher-primary-btn" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Tạo voucher'}
          </button>
        </form>

        <section className="voucher-list-panel">
          <h2>Danh sách voucher</h2>
          <div className="voucher-admin-list">
            {vouchers.map((voucher) => {
              const assignState = assignByVoucher[voucher.id] || {};
              return (
                <article key={voucher.id} className="voucher-admin-card">
                  <div className="voucher-admin-card-main">
                    <div>
                      <span className={`voucher-status ${voucher.status}`}>{voucher.status}</span>
                      <h3>{voucher.code}</h3>
                      <p>{voucher.description || 'Voucher BeautyBook'}</p>
                    </div>
                    <strong>{getDiscountText(voucher)}</strong>
                  </div>

                  <div className="voucher-admin-meta">
                    <span>Đơn tối thiểu: {formatVnd(voucher.min_order_value)}</span>
                    <span>Hạn: {formatDate(voucher.expiry_date)}</span>
                    <span>Đã gán: {Number(voucher.assigned_count || 0)}</span>
                    <span>Dùng: {Number(voucher.current_usage || 0)}</span>
                  </div>

                  <div className="voucher-assign-row">
                    <select
                      value={assignState.customer_id || ''}
                      onChange={(event) => updateAssignState(voucher.id, { customer_id: event.target.value })}
                    >
                      <option value="">Chọn khách hàng</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.email}
                        </option>
                      ))}
                    </select>

                    <label className="voucher-email-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(assignState.send_email)}
                        onChange={(event) => updateAssignState(voucher.id, { send_email: event.target.checked })}
                      />
                      Gửi email
                    </label>

                    <button type="button" onClick={() => handleAssign(voucher.id)} disabled={saving}>
                      Gán
                    </button>

                    {voucher.status === 'active' && (
                      <button
                        type="button"
                        className="voucher-danger-btn"
                        onClick={() => handleDeactivate(voucher.id)}
                        disabled={saving}
                      >
                        Tắt
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}

export default ManageVouchers;
