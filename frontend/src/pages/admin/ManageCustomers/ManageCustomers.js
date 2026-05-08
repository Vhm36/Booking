import React, { useEffect, useMemo, useState } from 'react';
import customerService from '../../../services/customerService';
import dashboardService from '../../../services/dashboardService';
import authService from '../../../services/authService';
import { exportToExcel } from '../../../utils/exportExcel';
import './ManageCustomers.css';

const getVipMetaFromSpent = (totalSpent = 0) => {
  if (totalSpent >= 40000000) {
    return { code: 'vvvip', label: 'VVVIP', icon: 'eclipse' };
  }
  if (totalSpent >= 20000000) {
    return { code: 'vvip', label: 'VVIP', icon: 'crown' };
  }
  if (totalSpent >= 10000000) {
    return { code: 'gold', label: 'VIP Vàng', icon: 'star' };
  }
  if (totalSpent >= 5000000) {
    return { code: 'silver', label: 'VIP Bạc', icon: 'shield' };
  }
  if (totalSpent >= 3000000) {
    return { code: 'bronze', label: 'VIP Đồng', icon: 'ember' };
  }
  return { code: 'standard', label: 'Thành viên thường', icon: 'spark' };
};

const normalizeCustomers = (list = []) =>
  list.map((item) => {
    const totalSpent = Number(item.total_spent || 0);
    const vipFallback = getVipMetaFromSpent(totalSpent);

    return {
      ...item,
      is_active: Number(item.is_active) === 1 || item.is_active === true,
      total_appointments: Number(item.total_appointments || 0),
      completed_appointments: Number(item.completed_appointments || 0),
      cancelled_appointments: Number(item.cancelled_appointments || 0),
      total_spent: totalSpent,
      cancellation_rate: Number(item.cancellation_rate || 0),
      vip_tier_code: item.vip_tier_code || vipFallback.code,
      vip_tier_label: item.vip_tier_label || vipFallback.label,
      vip_tier_icon: item.vip_tier_icon || vipFallback.icon,
      behavior_role_code: item.behavior_role_code || 'standard',
      behavior_role_label: item.behavior_role_label || 'Hành vi ổn định',
      behavior_tags: Array.isArray(item.behavior_tags) ? item.behavior_tags : [],
      customer_segment: item.customer_segment || 'New Customers',
      rfm_score: item.rfm_score || ''
    };
  });

const normalizeSearchText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const emptyEditData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  is_active: true
};

const emptyFeedback = {
  type: '',
  text: ''
};

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

const getBehaviorToneClass = (tone) => `tone-${tone || 'slate'}`;

const getVipThresholdLabel = (tierCode) => {
  switch (tierCode) {
    case 'vvvip': return 'Từ 40.000.000đ';
    case 'vvip': return 'Từ 20.000.000đ';
    case 'gold': return 'Từ 10.000.000đ';
    case 'silver': return 'Từ 5.000.000đ';
    case 'bronze': return 'Từ 3.000.000đ';
    default: return 'Dưới 3.000.000đ';
  }
};

const getVipRankLabel = (tierCode) => {
  switch (tierCode) {
    case 'vvvip': return 'Hạng SS';
    case 'vvip': return 'Hạng S+';
    case 'gold': return 'Hạng S';
    case 'silver': return 'Hạng A';
    case 'bronze': return 'Hạng B';
    default: return 'Hạng C';
  }
};

const getCompactVipLabel = (tierCode, fallbackLabel) => {
  switch (tierCode) {
    case 'vvvip': return 'VVVIP';
    case 'vvip': return 'VVIP';
    case 'gold': return 'VIP Vàng';
    case 'silver': return 'VIP Bạc';
    case 'bronze': return 'VIP Đồng';
    case 'standard': return 'Thường';
    default: return fallbackLabel || 'Thường';
  }
};

const getRfmSegmentLabel = (segment) => {
  switch (segment) {
    case 'Champions': return 'Khách VIP (Kim Cương)';
    case 'Loyal Customers': return 'Khách trung thành';
    case 'Potential Loyalists': return 'Khách tiềm năng';
    case 'At Risk': return 'Nguy cơ rời bỏ';
    case 'Lost Customers': return 'Ngủ đông/Đã mất';
    case 'New Customers': return 'Khách hàng mới';
    case 'Need Attention': return 'Cần chăm sóc';
    default: return segment || 'Chưa tính';
  }
};

function ManageCustomers() {
  const currentUser = authService.getUser();
  const isStaffView = currentUser?.role === 'staff';
  const isCashierView = isStaffView && normalizeSearchText(currentUser?.staff_role_name) === 'thu ngan';
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [pageFeedback, setPageFeedback] = useState(emptyFeedback);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    is_active: true
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editData, setEditData] = useState(emptyEditData);
  const [editFeedback, setEditFeedback] = useState(emptyFeedback);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingVoucherEmail, setSendingVoucherEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [behaviorBot, setBehaviorBot] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchBehaviorBot();
  }, []);

  useEffect(() => {
    let timeout;
    if (pageFeedback.text) {
      timeout = setTimeout(() => setPageFeedback(emptyFeedback), 3000);
    }
    return () => clearTimeout(timeout);
  }, [pageFeedback.text]);

  useEffect(() => {
    let timeout;
    if (editFeedback.text) {
      timeout = setTimeout(() => setEditFeedback(emptyFeedback), 3000);
    }
    return () => clearTimeout(timeout);
  }, [editFeedback.text]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getAllCustomers();
      setCustomers(normalizeCustomers(response.data.data || []));
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBehaviorBot = async () => {
    try {
      const response = await dashboardService.getCustomerBehaviorBot();
      setBehaviorBot(response.data?.data || null);
    } catch (err) {
      setBehaviorBot(null);
    }
  };

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) {
      return customers;
    }

    return customers.filter((customer) => {
      const searchBlob = normalizeSearchText(
        `${customer.id} ${customer.name || ''} ${customer.email || ''} ${customer.phone || ''} ${customer.behavior_role_label || ''
        } ${customer.vip_tier_label || ''} ${customer.vip_tier_code || ''} ${customer.customer_segment || ''} ${customer.rfm_score || ''
        } ${(customer.behavior_tags || [])
          .map((tag) => tag.label)
          .join(' ')}`
      );
      return searchBlob.includes(normalizedKeyword);
    });
  }, [customers, keyword]);

  const insightCards = useMemo(() => {
    const frequentBookers = customers.filter((customer) =>
      ['frequent_booker', 'mixed_high_activity'].includes(customer.behavior_role_code)
    ).length;
    const frequentCancellers = customers.filter((customer) =>
      ['frequent_canceller', 'mixed_high_activity'].includes(customer.behavior_role_code)
    ).length;
    const vipGoldOrHigher = customers.filter((customer) =>
      ['gold', 'black'].includes(customer.vip_tier_code)
    ).length;
    const vipBlack = customers.filter((customer) => customer.vip_tier_code === 'black').length;
    const rfmAtRisk = customers.filter((customer) => customer.customer_segment === 'At Risk').length;

    return [
      {
        key: 'total',
        label: 'Tổng khách',
        value: customers.length,
        note: 'Tổng tài khoản khách hàng hiện có',
        tone: 'total'
      },
      {
        key: 'booker',
        label: 'Đặt nhiều',
        value: frequentBookers,
        note: 'Nhóm khách có tần suất đặt lịch cao',
        tone: 'booker'
      },
      {
        key: 'canceller',
        label: 'Hủy nhiều',
        value: frequentCancellers,
        note: 'Nhóm khách cần theo dõi tỷ lệ hủy',
        tone: 'canceller'
      },
      {
        key: 'vip-gold',
        label: 'VIP Vàng+',
        value: vipGoldOrHigher,
        note: 'Khách có tổng chi tiêu cao',
        tone: 'vip'
      },
      {
        key: 'vip-black',
        label: 'VIP Đen',
        value: vipBlack,
        note: 'Nhóm chi tiêu cao nhất hiện tại',
        tone: 'black'
      },
      {
        key: 'rfm-risk',
        label: 'Nguy cơ rời bỏ',
        value: rfmAtRisk,
        note: 'Khách hàng cần kích hoạt lại bằng voucher',
        tone: 'canceller'
      }
    ];
  }, [customers]);

  const updateEditField = (field, value) => {
    setEditFeedback(emptyFeedback);
    setDeleteError('');
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    try {
      await customerService.createCustomer({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        is_active: formData.is_active
      });

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        is_active: true
      });
      setShowForm(false);
      setPageFeedback({ type: 'success', text: 'Bạn đã thêm khách hàng mới.' });
      fetchCustomers();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Thêm khách hàng thất bại.');
    }
  };

  const startEdit = (customer) => {
    setPageFeedback(emptyFeedback);
    setEditingCustomer(customer);
    setEditData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      password: '',
      is_active: !!customer.is_active
    });
    setEditFeedback(emptyFeedback);
    setShowDeleteConfirm(false);
    setDeleteError('');
  };

  const closeDeleteConfirm = () => {
    if (deletingCustomer) {
      return;
    }

    setShowDeleteConfirm(false);
    setDeleteError('');
  };

  const closeEditModal = () => {
    if (savingEdit || deletingCustomer || sendingVoucherEmail) {
      return;
    }

    setEditingCustomer(null);
    setEditData(emptyEditData);
    setEditFeedback(emptyFeedback);
    setShowDeleteConfirm(false);
    setDeleteError('');
  };

  const handleSendVoucherEmail = async () => {
    if (!editingCustomer) {
      return;
    }

    try {
      setSendingVoucherEmail(true);
      setEditFeedback(emptyFeedback);

      const response = await customerService.sendVoucherEmail(editingCustomer.id, {
        source: 'admin'
      });

      const recipient = response.data?.data?.recipient || editingCustomer.email;
      setEditFeedback({
        type: 'success',
        text: `Đã gửi email voucher tới ${recipient}.`
      });
    } catch (err) {
      setEditFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Không thể gửi email voucher lúc này.'
      });
    } finally {
      setSendingVoucherEmail(false);
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editData.name.trim() || !editData.email.trim()) {
      setEditFeedback({
        type: 'error',
        text: 'Vui lòng nhập đầy đủ họ tên và email.'
      });
      return;
    }

    try {
      setSavingEdit(true);
      setEditFeedback(emptyFeedback);
      const payload = {
        name: editData.name.trim(),
        email: editData.email.trim(),
        phone: editData.phone.trim(),
        is_active: editData.is_active
      };

      if (editData.password) {
        payload.password = editData.password;
      }

      await customerService.updateCustomer(editingCustomer.id, payload);

      const nextCustomer = {
        ...editingCustomer,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        is_active: payload.is_active
      };

      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === editingCustomer.id ? { ...customer, ...nextCustomer } : customer
        )
      );
      setEditingCustomer(nextCustomer);
      setEditData((prev) => ({ ...prev, password: '' }));
      setEditFeedback({
        type: 'success',
        text:
          typeof payload.password !== 'undefined'
            ? 'Bạn đã lưu mật khẩu mới.'
            : 'Bạn đã lưu thông tin khách hàng.'
      });
    } catch (err) {
      setEditFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Cập nhật khách hàng thất bại.'
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!editingCustomer) {
      return;
    }

    try {
      setDeletingCustomer(true);
      setDeleteError('');
      await customerService.deleteCustomer(editingCustomer.id);
      setCustomers((prev) => prev.filter((customer) => customer.id !== editingCustomer.id));
      setPageFeedback({ type: 'success', text: 'Bạn đã xóa tài khoản khách hàng.' });
      setEditingCustomer(null);
      setEditData(emptyEditData);
      setEditFeedback(emptyFeedback);
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(
        err.response?.data?.message || 'Không thể xóa tài khoản này lúc này. Vui lòng thử lại.'
      );
    } finally {
      setDeletingCustomer(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-customers">
      <section className="customers-hero">
        <div className="customers-hero-copy">
          <p className="customers-hero-kicker">{isCashierView ? 'Thu ngân' : isStaffView ? 'Nhân viên' : 'Admin'}</p>
          <h1>{isStaffView ? 'Quản lý khách hàng tại quầy' : 'Quản lý khách hàng'}</h1>
          <p className="customers-page-note">
            Theo dõi tài khoản khách hàng, lịch sử đặt lịch, vai trò hành vi và hạng VIP ngay
            trên cùng một giao diện để phân tích khách đặt nhiều, hủy nhiều và nhóm chi tiêu cao.
          </p>
        </div>

        <div className="customers-toolbar">
          <button className="btn-primary customers-toolbar-button" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? 'Đóng form' : '+ Thêm khách hàng'}
          </button>

          <div className="customers-toolbar-search">
            <label className="customers-search-bar" htmlFor="customer-table-search">
              <input
                id="customer-table-search"
                type="text"
                className="customers-search-input"
                placeholder="Theo tên, ID, email, VIP hoặc vai trò hành vi"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </label>
            <span className="customers-search-count">
              {filteredCustomers.length}/{customers.length} khách hàng
            </span>
            <button
              className="btn-export-excel"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                exportToExcel({
                  fileName: `khach-hang_${today}`,
                  sheets: [
                    {
                      name: 'Khách hàng',
                      columns: [
                        { key: 'id', header: 'ID', width: 8 },
                        { key: 'name', header: 'Họ tên', width: 22 },
                        { key: 'email', header: 'Email', width: 28 },
                        { key: 'phone', header: 'SĐT', width: 14 },
                        { key: 'vip_tier_label', header: 'Hạng VIP', width: 14 },
                        { key: 'customer_segment', header: 'Phân khúc', width: 18, transform: (v) => getRfmSegmentLabel(v) },
                        { key: 'rfm_score', header: 'Điểm RFM', width: 12 },
                        { key: 'behavior_role_label', header: 'Hành vi', width: 20 },
                        { key: 'total_spent', header: 'Tổng chi (VNĐ)', width: 18, transform: (v) => Number(v || 0) },
                        { key: 'total_appointments', header: 'Tổng đặt', width: 10, transform: (v) => Number(v || 0) },
                        { key: 'completed_appointments', header: 'Hoàn tất', width: 10, transform: (v) => Number(v || 0) },
                        { key: 'cancelled_appointments', header: 'Hủy', width: 8, transform: (v) => Number(v || 0) },
                        { key: 'cancellation_rate', header: 'Tỷ lệ hủy (%)', width: 12, transform: (v) => Number(v || 0) },
                        { key: 'is_active', header: 'Trạng thái', width: 12, transform: (v) => v ? 'Hoạt động' : 'Tạm khóa' }
                      ],
                      rows: filteredCustomers
                    }
                  ]
                });
              }}
            >
              📥 Xuất Excel
            </button>
          </div>
        </div>
      </section>

      {pageFeedback.text && (
        <div className={`page-feedback ${pageFeedback.type}`}>{pageFeedback.text}</div>
      )}

      <section className="customer-insights-grid">
        {insightCards.map((card) => (
          <article key={card.key} className={`customer-insight-card tone-${card.tone}`}>
            <span className="customer-insight-label">{card.label}</span>
            <strong className="customer-insight-value">{card.value}</strong>
            <p className="customer-insight-note">{card.note}</p>
          </article>
        ))}
      </section>

      {behaviorBot && (
        <section className="customer-bot-panel">
          <div className="customer-bot-head">
            <p className="customer-bot-kicker">AI Bot</p>
            <h3>Theo dõi & phân tích hành vi khách hàng</h3>
          </div>
          <div className="customer-bot-summary">
            <span>Tổng khách: {behaviorBot.summary?.total_customers || 0}</span>
            <span>Đặt nhiều: {behaviorBot.summary?.frequent_bookers || 0}</span>
            <span>Hủy nhiều: {behaviorBot.summary?.frequent_cancellers || 0}</span>
            <span>VIP vàng/đen: {behaviorBot.summary?.vip_gold_or_black || 0}</span>
          </div>
          <div className="customer-bot-recommendations">
            {(behaviorBot.recommendations || []).map((item, index) => (
              <p key={`bot-rec-${index}`}>{item}</p>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <div className="customer-form-card">
          <h3>Thêm khách hàng mới</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Họ tên</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mật khẩu</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Trạng thái</label>
                <select
                  value={formData.is_active ? '1' : '0'}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_active: event.target.value === '1'
                    }))
                  }
                >
                  <option value="1">Đang hoạt động</option>
                  <option value="0">Tạm khóa</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn-success">
              Tạo khách hàng
            </button>
          </form>
        </div>
      )}

      <section className="customer-table-shell">
        <div className="customer-table-header">
          <div>
            <p className="customer-table-kicker">Danh sách tài khoản</p>
            <h2>Khách hàng hiện có</h2>
          </div>
        </div>

        <div className="customer-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Hành vi</th>
                <th>Phân khúc</th>
                <th>VIP</th>
                <th>Tổng chi</th>
                <th>Tổng đặt lịch</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-state">
                    Chưa có khách hàng phù hợp.
                  </td>
                </tr>
              )}

              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.id}</td>
                  <td>
                    <div className="customer-name-cell">
                      <strong>{customer.name}</strong>
                      <small>{customer.behavior_role_label}</small>
                    </div>
                  </td>
                  <td>
                    <div className="customer-behavior-stack">
                      {customer.behavior_tags.map((tag) => (
                        <span
                          key={`${customer.id}-${tag.code}`}
                          className={`customer-chip ${getBehaviorToneClass(tag.tone)}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="customer-rfm-stack">
                      <span 
                        className={`customer-rfm-badge segment-${normalizeSearchText(customer.customer_segment).replace(/\s+/g, '-')}`}
                        title={customer.customer_segment}
                      >
                        {getRfmSegmentLabel(customer.customer_segment)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={`customer-vip-badge customer-vip-badge--table compact vip-${customer.vip_tier_code}`}>
                      <div className="customer-vip-copy">
                        <strong>{getCompactVipLabel(customer.vip_tier_code, customer.vip_tier_label)}</strong>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong className="customer-amount">{formatCurrency(customer.total_spent)}</strong>
                  </td>
                  <td>
                    <div className="customer-metrics">
                      <span>{customer.total_appointments} lịch • {customer.completed_appointments} hoàn tất</span>
                      <span>{customer.cancelled_appointments} hủy  {customer.cancellation_rate}% tỷ lệ hủy</span>
                    </div>
                  </td>
                  <td>
                    <span className={`customer-status ${customer.is_active ? 'active' : 'inactive'}`}>
                      <span className="customer-status-dot" aria-hidden="true" />
                      <span className="customer-status-label">
                        {customer.is_active ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button className="btn-secondary btn-small" onClick={() => startEdit(customer)}>
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingCustomer && (
        <div className="customer-edit-overlay" onClick={closeEditModal}>
          <div
            className="customer-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-edit-header">
              <div>
                <p className="customer-edit-kicker">Sửa khách hàng</p>
                <h3 id="customer-edit-title">{editingCustomer.name || 'Khách hàng'}</h3>
              </div>
              <button
                type="button"
                className="customer-edit-close"
                onClick={closeEditModal}
                aria-label="Thoát tab sửa khách hàng"
              >
                ×
              </button>
            </div>

            <div className="customer-edit-insights">
              <div className={`customer-vip-badge customer-vip-badge--modal compact vip-${editingCustomer.vip_tier_code}`}>
                <div className="customer-vip-copy">
                  <strong>{editingCustomer.vip_tier_label}</strong>
                  <small>{getVipThresholdLabel(editingCustomer.vip_tier_code)}</small>
                </div>
              </div>
              <div className="customer-behavior-stack">
                {editingCustomer.behavior_tags.map((tag) => (
                  <span
                    key={`edit-${editingCustomer.id}-${tag.code}`}
                    className={`customer-chip ${getBehaviorToneClass(tag.tone)}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>

            <form className="customer-edit-form" onSubmit={handleSaveEdit}>
              <div className="customer-edit-grid">
                <div className="form-group">
                  <label>Họ tên</label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(event) => updateEditField('name', event.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(event) => updateEditField('email', event.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={(event) => updateEditField('phone', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input
                    type="password"
                    value={editData.password}
                    onChange={(event) => updateEditField('password', event.target.value)}
                    placeholder="Để trống nếu không đổi"
                  />
                </div>
              </div>

              <div className="form-group customer-edit-status">
                <label>Trạng thái</label>
                <select
                  value={editData.is_active ? '1' : '0'}
                  onChange={(event) => updateEditField('is_active', event.target.value === '1')}
                >
                  <option value="1">Đang hoạt động</option>
                  <option value="0">Tạm khóa</option>
                </select>
              </div>

              {editFeedback.text && (
                <div className={`customer-edit-feedback ${editFeedback.type}`}>
                  {editFeedback.text}
                </div>
              )}

              <div className="customer-edit-actions">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={savingEdit || deletingCustomer || sendingVoucherEmail}
                >
                  Xóa tài khoản
                </button>

                <div className="customer-edit-action-group">
                  <button
                    type="button"
                    className="customer-action-accent"
                    onClick={handleSendVoucherEmail}
                    disabled={savingEdit || deletingCustomer || sendingVoucherEmail}
                  >
                    {sendingVoucherEmail ? 'Đang gửi mail...' : 'Gửi voucher email'}
                  </button>
                  <button
                    type="submit"
                    className="btn-success"
                    disabled={savingEdit || deletingCustomer || sendingVoucherEmail}
                  >
                    {savingEdit ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="customer-action-neutral"
                    onClick={closeEditModal}
                    disabled={savingEdit || deletingCustomer || sendingVoucherEmail}
                  >
                    Thoát
                  </button>
                </div>
              </div>
            </form>
          </div>

          {showDeleteConfirm && (
            <div className="customer-confirm-overlay" onClick={closeDeleteConfirm}>
              <div className="customer-confirm-card" onClick={(event) => event.stopPropagation()}>
                <p className="customer-confirm-title">Bạn có chắc muốn xóa tài khoản này?</p>
                <p className="customer-confirm-text">
                  Tài khoản của {editingCustomer.name || 'khách hàng'} sẽ bị xóa vĩnh viễn.
                </p>
                <p className="customer-confirm-note">
                  Những khách hàng không có lịch hẹn hoặc giao dịch có thể xóa được
                </p>

                {deleteError && <div className="customer-confirm-error">{deleteError}</div>}

                <div className="customer-confirm-actions">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleDeleteCustomer}
                    disabled={deletingCustomer}
                  >
                    {deletingCustomer ? 'Đang xóa...' : 'Xóa'}
                  </button>
                  <button
                    type="button"
                    className="customer-confirm-cancel"
                    onClick={closeDeleteConfirm}
                    disabled={deletingCustomer}
                  >
                    Không
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ManageCustomers;
