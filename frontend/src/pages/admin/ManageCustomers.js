import React, { useEffect, useMemo, useState } from 'react';
import customerService from '../../services/customerService';
import './ManageCustomers.css';

const normalizeCustomers = (list = []) =>
  list.map((item) => ({
    ...item,
    is_active: Number(item.is_active) === 1 || item.is_active === true
  }));

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

function ManageCustomers() {
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return customers;
    }

    return customers.filter((customer) => {
      const name = (customer.name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return (
        name.includes(normalizedKeyword) ||
        email.includes(normalizedKeyword) ||
        phone.includes(normalizedKeyword)
      );
    });
  }, [customers, keyword]);

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
      alert(err.response?.data?.message || 'Thêm khách hàng thất bại.');
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
  };  const closeEditModal = () => {
    if (savingEdit || deletingCustomer) {
      return;
    }

    setEditingCustomer(null);
    setEditData(emptyEditData);
    setEditFeedback(emptyFeedback);
    setShowDeleteConfirm(false);
    setDeleteError('');
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
      <h1>Quản lý khách hàng</h1>

      {pageFeedback.text && (
        <div className={`page-feedback ${pageFeedback.type}`}>{pageFeedback.text}</div>
      )}

      <div className="customers-toolbar">
        <button className="btn-primary" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'Đóng form' : '+ Thêm khách hàng'}
        </button>

        <input
          type="text"
          placeholder="Tìm theo tên, email hoặc số điện thoại"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>

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

      <div className="customer-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Điện thoại</th>
              <th>Mật khẩu</th>
              <th>Số lịch</th>
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
                <td>{customer.name}</td>
                <td>{customer.email}</td>
                <td>{customer.phone || '-'}</td>
                <td>
                  <span className="password-placeholder">Không hiển thị</span>
                </td>
                <td>{customer.total_appointments || 0}</td>
                <td>
                  <span className={`customer-status ${customer.is_active ? 'active' : 'inactive'}`}>
                    {customer.is_active ? 'Đang hoạt động' : 'Tạm khóa'}
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
                  disabled={savingEdit || deletingCustomer}
                >
                  Xóa tài khoản
                </button>

                <div className="customer-edit-action-group">
                  <button type="submit" className="btn-success" disabled={savingEdit || deletingCustomer}>
                    {savingEdit ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="customer-action-neutral"
                    onClick={closeEditModal}
                    disabled={savingEdit || deletingCustomer}
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
                  Tài khoản của {editingCustomer.name || 'khách hàng'} sẽ bị xóa khỏi danh sách.
                </p>
                <p className="customer-confirm-note">
                  Những khách hàng đã có lịch hẹn sẽ không thể xóa và nên dùng trạng thái tạm khóa.
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