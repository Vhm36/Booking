import React, { useEffect, useState } from 'react';
import staffService from '../../services/staffService';
import './ManageStaff.css';

const normalizeStaff = (list = []) =>
  list.map((item) => ({
    ...item,
    is_active: Number(item.is_active) === 1 || item.is_active === true
  }));

function ManageStaff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    password: '',
    is_active: true
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await staffService.getAllStaff();
      setStaffList(normalizeStaff(response.data.data || []));
      setError('');
    } catch (err) {
      const apiMessage =
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message;
      setError(apiMessage || 'Không thể tải danh sách nhân viên.');
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      await staffService.createStaff(
        formData.name.trim(),
        formData.email.trim(),
        formData.password,
        formData.phone.trim(),
        true
      );
      setFormData({ name: '', email: '', password: '', phone: '' });
      setShowForm(false);
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Tạo nhân viên thất bại.');
    }
  };

  const startEdit = (staff) => {
    setEditingId(staff.id);
    setEditData({
      name: staff.name || '',
      phone: staff.phone || '',
      password: '',
      is_active: !!staff.is_active
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', phone: '', password: '', is_active: true });
  };

  const handleSaveEdit = async () => {
    try {
      const payload = {
        name: editData.name.trim(),
        phone: editData.phone.trim(),
        is_active: editData.is_active
      };

      if (editData.password) {
        payload.password = editData.password;
      }

      await staffService.updateStaff(editingId, payload);
      cancelEdit();
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật nhân viên thất bại.');
    }
  };

  const handleToggleActive = async (staff) => {
    try {
      await staffService.updateStaff(staff.id, { is_active: !staff.is_active });
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-staff">
      <h1>Quản lý nhân viên</h1>

      <button className="btn-primary" onClick={() => setShowForm((prev) => !prev)}>
        {showForm ? 'Đóng form' : '+ Thêm nhân viên'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}
      {!error && staffList.length === 0 && (
        <div className="alert alert-info">Chưa có nhân viên nào để hiển thị.</div>
      )}

      {showForm && (
        <div className="staff-form-card">
          <h3>Tạo tài khoản nhân viên</h3>
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

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
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
                <label>Mật khẩu</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-success">
              Tạo nhân viên
            </button>
          </form>
        </div>
      )}

      <div className="staff-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Điện thoại</th>
              <th>Mật khẩu mới</th>
              <th>Số lịch</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {staffList.length === 0 && (
              <tr>
                <td colSpan="8" className="empty-cell">
                  Chưa có dữ liệu nhân viên.
                </td>
              </tr>
            )}

            {staffList.map((staff) => {
              const isEditing = editingId === staff.id;

              return (
                <tr key={staff.id}>
                  <td>{staff.id}</td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editData.name}
                        onChange={(event) =>
                          setEditData((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    ) : (
                      staff.name
                    )}
                  </td>
                  <td>{staff.email}</td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editData.phone}
                        onChange={(event) =>
                          setEditData((prev) => ({ ...prev, phone: event.target.value }))
                        }
                      />
                    ) : (
                      staff.phone || '-'
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="password"
                        value={editData.password}
                        onChange={(event) =>
                          setEditData((prev) => ({ ...prev, password: event.target.value }))
                        }
                        placeholder="Để trống nếu không đổi"
                      />
                    ) : (
                      <span className="password-placeholder">Không hiển thị</span>
                    )}
                  </td>
                  <td>{staff.total_appointments || 0}</td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editData.is_active ? '1' : '0'}
                        onChange={(event) =>
                          setEditData((prev) => ({
                            ...prev,
                            is_active: event.target.value === '1'
                          }))
                        }
                      >
                        <option value="1">Đang hoạt động</option>
                        <option value="0">Tạm khóa</option>
                      </select>
                    ) : (
                      <span className={`staff-status ${staff.is_active ? 'active' : 'inactive'}`}>
                        {staff.is_active ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div className="staff-actions">
                        <button className="btn-success btn-small" onClick={handleSaveEdit}>
                          Lưu
                        </button>
                        <button className="btn-secondary btn-small" onClick={cancelEdit}>
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="staff-actions">
                        <button className="btn-secondary btn-small" onClick={() => startEdit(staff)}>
                          Sửa
                        </button>
                        <button
                          className={`btn-small ${staff.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleToggleActive(staff)}
                        >
                          {staff.is_active ? 'Tạm khóa' : 'Kích hoạt'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageStaff;
