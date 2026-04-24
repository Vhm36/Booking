import React, { useEffect, useMemo, useState } from 'react';
import customerService from '../../../services/customerService';
import dashboardService from '../../../services/dashboardService';
import authService from '../../../services/authService';
import './ManageCustomers.css';

const getVipMetaFromSpent = (totalSpent = 0) => {
  if (totalSpent >= 15000000) {
    return { code: 'black', label: 'VIP Đen', icon: 'eclipse' };
  }
  if (totalSpent >= 7000000) {
    return { code: 'gold', label: 'VIP Vàng', icon: 'crown' };
  }
  if (totalSpent >= 3000000) {
    return { code: 'silver', label: 'VIP Báº¡c', icon: 'shield' };
  }
  if (totalSpent >= 1000000) {
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
      behavior_role_label: item.behavior_role_label || 'Hành vi á»•n định',
      behavior_tags: Array.isArray(item.behavior_tags) ? item.behavior_tags : []
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
    case 'black': return 'Tá»« 15.000.000đ';
    case 'gold': return 'Tá»« 7.000.000đ';
    case 'silver': return 'Tá»« 3.000.000đ';
    case 'bronze': return 'Tá»« 1.000.000đ';
    default: return 'Dưới 1.000.000đ';
  }
};

const getVipRankLabel = (tierCode) => {
  switch (tierCode) {
    case 'black': return 'Háº¡ng S+';
    case 'gold': return 'Háº¡ng S';
    case 'silver': return 'Háº¡ng A';
    case 'bronze': return 'Háº¡ng B';
    default: return 'Háº¡ng C';
  }
};

const getCompactVipLabel = (tierCode, fallbackLabel) => {
  switch (tierCode) {
    case 'black': return 'VIP Đen';
    case 'gold': return 'VIP Vàng';
    case 'silver': return 'VIP Báº¡c';
    case 'bronze': return 'VIP Đồng';
    case 'standard': return 'Thường';
    default: return fallbackLabel || 'Thường';
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

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getAllCustomers();
      setCustomers(normalizeCustomers(response.data.data || []));
      setError('');
    } catch (err) {
      setError('Không thá»ƒ táº£i danh sách khách hàng.');
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
        `${customer.id} ${customer.name || ''} ${customer.email || ''} ${customer.phone || ''} ${
          customer.behavior_role_label || ''
        } ${customer.vip_tier_label || ''} ${customer.vip_tier_code || ''} ${(customer.behavior_tags || [])
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

    return [
      {
        key: 'total',
        label: 'Tá»•ng khách',
        value: customers.length,
        note: 'Tá»•ng sá»‘ tài khoáº£n khách hàng hiá»‡n có',
        tone: 'total'
      },
      {
        key: 'booker',
        label: 'Đặt nhiều',
        value: frequentBookers,
        note: 'Nhóm khách có táº§n suáº¥t đặt lá»‹ch cao',
        tone: 'booker'
      },
      {
        key: 'canceller',
        label: 'Há»§y nhiá»u',
        value: frequentCancellers,
        note: 'Nhóm khách cáº§n theo dõi tá»· lá»‡ há»§y',
        tone: 'canceller'
      },
      {
        key: 'vip-gold',
        label: 'VIP Vàng+',
        value: vipGoldOrHigher,
        note: 'Khách có tá»•ng chi tiêu cao',
        tone: 'vip'
      },
      {
        key: 'vip-black',
        label: 'VIP Đen',
        value: vipBlack,
        note: 'Nhóm chi tiêu cao nháº¥t hiá»‡n táº¡i',
        tone: 'black'
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
      setPageFeedback({ type: 'success', text: 'Báº¡n đã thêm khách hàng má»›i.' });
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
        text: `Đã gá»­i email voucher tá»›i ${recipient}.`
      });
    } catch (err) {
      setEditFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Không thá»ƒ gá»­i email voucher lúc này.'
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
        text: 'Vui lòng nháº­p đầy đủ há» tên và email.'
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
            ? 'Báº¡n đã lưu máº­t kháº©u má»›i.'
            : 'Báº¡n đã lưu thông tin khách hàng.'
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
      setPageFeedback({ type: 'success', text: 'Báº¡n đã xóa tài khoáº£n khách hàng.' });
      setEditingCustomer(null);
      setEditData(emptyEditData);
      setEditFeedback(emptyFeedback);
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(
        err.response?.data?.message || 'Không thá»ƒ xóa tài khoáº£n này lúc này. Vui lòng thá»­ láº¡i.'
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
            Theo dõi tài khoáº£n khách hàng, lá»‹ch sá»­ đặt lá»‹ch, vai trò hành vi và háº¡ng VIP ngay
            trên cùng má»™t giao diá»‡n để phân tích khách đặt nhiá»u, há»§y nhiá»u và nhóm chi tiêu cao.
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
            <span>Tá»•ng khách: {behaviorBot.summary?.total_customers || 0}</span>
            <span>Đặt nhiều: {behaviorBot.summary?.frequent_bookers || 0}</span>
            <span>Há»§y nhiá»u: {behaviorBot.summary?.frequent_cancellers || 0}</span>
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
          <h3>Thêm khách hàng má»›i</h3>
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
                <label>Máº­t kháº©u</label>
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
                <label>Sá»‘ điện thoáº¡i</label>
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
                  <option value="1">Đang hoáº¡t động</option>
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
            <h2>Khách hàng hiá»‡n có</h2>
          </div>
        </div>

        <div className="customer-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Hành vi</th>
                <th>VIP</th>
                <th>Tá»•ng chi</th>
                <th>Chá»‰ sá»‘</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">
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
                    <div className={`customer-vip-badge customer-vip-badge--table compact vip-${customer.vip_tier_code}`}>
                      <span
                        className={`customer-vip-icon icon-${customer.vip_tier_icon}`}
                        aria-hidden="true"
                      />
                      <div className="customer-vip-copy">
                        <strong>{getCompactVipLabel(customer.vip_tier_code, customer.vip_tier_label)}</strong>
                        <small>{getVipRankLabel(customer.vip_tier_code)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong className="customer-amount">{formatCurrency(customer.total_spent)}</strong>
                  </td>
                  <td>
                    <div className="customer-metrics">
                      <span>{customer.total_appointments} lá»‹ch â€¢ {customer.completed_appointments} hoàn táº¥t</span>
                      <span>{customer.cancelled_appointments} há»§y â€¢ {customer.cancellation_rate}% tá»· lá»‡ há»§y</span>
                    </div>
                  </td>
                  <td>
                    <span className={`customer-status ${customer.is_active ? 'active' : 'inactive'}`}>
                      <span className="customer-status-dot" aria-hidden="true" />
                      <span className="customer-status-label">
                        {customer.is_active ? 'Hoáº¡t động' : 'Táº¡m khóa'}
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button className="btn-secondary btn-small" onClick={() => startEdit(customer)}>
                        Sá»­a
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
                <span
                  className={`customer-vip-icon icon-${editingCustomer.vip_tier_icon}`}
                  aria-hidden="true"
                />
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
                  <label>Sá»‘ điện thoáº¡i</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={(event) => updateEditField('phone', event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Máº­t kháº©u má»›i</label>
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
                  <option value="1">Đang hoáº¡t động</option>
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
                <p className="customer-confirm-title">Báº¡n có cháº¯c muá»‘n xóa tài khoáº£n này?</p>
                <p className="customer-confirm-text">
                  Tài khoáº£n cá»§a {editingCustomer.name || 'khách hàng'} sáº½ bá»‹ xóa khá»i danh sách.
                </p>
                <p className="customer-confirm-note">
                  Nhá»¯ng khách hàng đã có lá»‹ch háº¹n sáº½ không thá»ƒ xóa và nên dùng tráº¡ng thái táº¡m khóa.
                </p>

                {deleteError && <div className="customer-confirm-error">{deleteError}</div>}

                <div className="customer-confirm-actions">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleDeleteCustomer}
                    disabled={deletingCustomer}
                  >
                    {deletingCustomer ? 'Đang xóa...' : 'Có'}
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
