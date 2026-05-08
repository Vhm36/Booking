import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import staffService from '../../../services/staffService';
import * as XLSX from 'xlsx';
import './ManageStaff.css';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const emptyEditData = {
  name: '',
  phone: '',
  password: '',
  is_active: true,
  staff_role_id: ''
};

const emptyFeedback = {
  type: '',
  text: ''
};

const buildWeekFromRows = (rows = []) =>
  WEEKDAY_LABELS.map((label, dayIndex) => {
    const row = rows.find((item) => Number(item.day_of_week) === dayIndex);
    if (!row) {
      return {
        day_of_week: dayIndex,
        label,
        enabled: false,
        start: '09:00',
        end: '18:00'
      };
    }

    return {
      day_of_week: dayIndex,
      label,
      enabled: true,
      start: String(row.start_time).slice(0, 5),
      end: String(row.end_time).slice(0, 5)
    };
  });

const normalizeStaff = (list = []) =>
  list.map((item) => ({
    ...item,
    is_active: Number(item.is_active) === 1 || item.is_active === true
  }));

const normalizeSearchText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

function ManageStaff() {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    staff_role_id: ''
  });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editData, setEditData] = useState(emptyEditData);
  const [editFeedback, setEditFeedback] = useState(emptyFeedback);
  const [savingEdit, setSavingEdit] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchStaffRoles();
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

  const fetchStaffRoles = async () => {
    try {
      const response = await staffService.getAllStaffRoles();
      const nextRoles = response.data.data || [];
      setStaffRoles(nextRoles);
      setFormData((prev) => {
        if (prev.staff_role_id || nextRoles.length === 0) {
          return prev;
        }

        return {
          ...prev,
          staff_role_id: String(nextRoles[0].id)
        };
      });
    } catch (err) {
      setStaffRoles([]);
    }
  };

  const filteredStaffList = useMemo(() => {
    let list = staffList;

    if (activeTab === 'cashier') {
      list = list.filter(staff => staff.role_name?.toLowerCase().includes('thu ngân'));
    } else if (activeTab === 'service') {
      list = list.filter(staff => !staff.role_name?.toLowerCase().includes('thu ngân') && !staff.role_name?.toLowerCase().includes('admin'));
    }

    const normalizedKeyword = normalizeSearchText(tableSearch);

    if (!normalizedKeyword) {
      return list;
    }

    return list.filter((staff) => {
      const searchBlob = normalizeSearchText(
        `${staff.id} ${staff.name || ''} ${staff.email || ''} ${staff.phone || ''} ${staff.role_name || ''}`
      );
      return searchBlob.includes(normalizedKeyword);
    });
  }, [staffList, tableSearch, activeTab]);

  const updateEditField = (field, value) => {
    setEditFeedback(emptyFeedback);
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!formData.staff_role_id) {
      alert('Vui lòng chọn vai trò cho nhân viên.');
      return;
    }

    try {
      await staffService.createStaff(
        formData.name.trim(),
        formData.email.trim(),
        formData.password,
        formData.phone.trim(),
        Number(formData.staff_role_id),
        true
      );

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        staff_role_id: staffRoles[0] ? String(staffRoles[0].id) : ''
      });
      setShowForm(false);
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Tạo nhân viên thất bại.');
    }
  };

  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let successCount = 0;
        let failCount = 0;

        for (const row of jsonData) {
          try {
            let roleId = staffRoles[0]?.id;
            const rNameRaw = row['Vai trò'] || row.role_name || row['Role'] || '';
            if (rNameRaw) {
              const rName = rNameRaw.toString().toLowerCase();
              const matchedRole = staffRoles.find(r => r.role_name.toLowerCase().includes(rName) || rName.includes(r.role_name.toLowerCase()));
              if (matchedRole) roleId = matchedRole.id;
            }

            const name = (row['Họ tên'] || row.name || row['Name'] || '').trim();
            const email = (row['Email'] || row.email || '').trim();
            const phone = String(row['Số điện thoại'] || row.phone || row['SĐT'] || '').trim();
            const password = String(row['Mật khẩu'] || row.password || '123456');

            if (name && email) {
              await staffService.createStaff(
                name,
                email,
                password,
                phone,
                Number(roleId),
                true
              );
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            failCount++;
          }
        }
        alert(`Nhập thành công: ${successCount} nhân viên.\nThất bại/Bỏ qua: ${failCount} dòng.`);
        fetchStaff();
      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const startEdit = (staff) => {
    setEditingStaff(staff);
    setEditData({
      name: staff.name || '',
      phone: staff.phone || '',
      password: '',
      is_active: !!staff.is_active,
      staff_role_id:
        typeof staff.staff_role_id === 'undefined' || staff.staff_role_id === null
          ? staffRoles[0]
            ? String(staffRoles[0].id)
            : ''
          : String(staff.staff_role_id)
    });
    setEditFeedback(emptyFeedback);
  };

  const closeEditModal = () => {
    if (savingEdit) {
      return;
    }

    setEditingStaff(null);
    setEditData(emptyEditData);
    setEditFeedback(emptyFeedback);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingStaff) {
      return;
    }

    if (!editData.name.trim()) {
      setEditFeedback({
        type: 'error',
        text: 'Vui lòng nhập đầy đủ họ tên nhân viên.'
      });
      return;
    }

    if (!editData.staff_role_id) {
      setEditFeedback({
        type: 'error',
        text: 'Vui lòng chọn vai trò trước khi lưu.'
      });
      return;
    }

    try {
      setSavingEdit(true);
      setEditFeedback(emptyFeedback);

      const payload = {
        name: editData.name.trim(),
        phone: editData.phone.trim(),
        is_active: editData.is_active,
        staff_role_id: Number(editData.staff_role_id)
      };

      if (editData.password) {
        payload.password = editData.password;
      }

      await staffService.updateStaff(editingStaff.id, payload);

      const nextRole = staffRoles.find((role) => String(role.id) === String(editData.staff_role_id));
      const nextStaff = {
        ...editingStaff,
        name: payload.name,
        phone: payload.phone,
        is_active: payload.is_active,
        staff_role_id: payload.staff_role_id,
        role_name: nextRole?.role_name || editingStaff.role_name
      };

      setStaffList((prev) =>
        prev.map((staff) => (staff.id === editingStaff.id ? { ...staff, ...nextStaff } : staff))
      );
      setEditingStaff(nextStaff);
      setEditData((prev) => ({ ...prev, password: '' }));
      setEditFeedback({
        type: 'success',
        text:
          typeof payload.password !== 'undefined'
            ? 'Bạn đã lưu thông tin và mật khẩu mới của nhân viên.'
            : 'Bạn đã lưu thông tin nhân viên.'
      });
    } catch (err) {
      setEditFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Cập nhật nhân viên thất bại.'
      });
    } finally {
      setSavingEdit(false);
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

  const openScheduleModal = async (staff) => {
    setScheduleModal({ staff, days: buildWeekFromRows() });
    setScheduleLoading(true);
    try {
      const response = await staffService.getStaffWeeklyAvailability(staff.id);
      setScheduleModal({
        staff,
        days: buildWeekFromRows(response.data.data || [])
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải lịch làm việc.');
      setScheduleModal(null);
    } finally {
      setScheduleLoading(false);
    }
  };

  const closeScheduleModal = () => {
    if (scheduleSaving) {
      return;
    }
    setScheduleModal(null);
  };

  const updateScheduleDay = (dayIndex, patch) => {
    setScheduleModal((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((day, index) =>
        index === dayIndex ? { ...day, ...patch } : day
      );
      return { ...prev, days: nextDays };
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleModal) {
      return;
    }

    const slots = scheduleModal.days
      .filter((day) => day.enabled)
      .map((day) => ({
        day_of_week: day.day_of_week,
        start_time: day.start,
        end_time: day.end
      }));

    try {
      setScheduleSaving(true);
      await staffService.replaceStaffWeeklyAvailability(scheduleModal.staff.id, slots);
      closeScheduleModal();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể lưu lịch làm việc.');
    } finally {
      setScheduleSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-staff">
      <section className="staff-hero">
        <div className="staff-hero-copy">
          <p className="staff-hero-kicker">Admin</p>
          <h1>Quản lý nhân viên</h1>
          <p className="staff-page-note">
            Theo dõi tài khoản nhân viên, vai trò, trạng thái hoạt động và lịch làm việc trong
            một giao diện đồng bộ hơn.
          </p>
        </div>

        <div className="staff-toolbar">
          <div className="staff-toolbar-actions">
            <input
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImportExcel}
            />
            <button
              className="btn-secondary staff-toolbar-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Đang nhập...' : '📥 Nhập từ Excel'}
            </button>
            <button
              className="btn-secondary staff-toolbar-button"
              type="button"
              onClick={() => navigate('/admin/staff-leave')}
            >
              Quản lý lịch nghỉ
            </button>
            <button
              className="btn-primary staff-toolbar-button"
              onClick={() => {
                setShowForm((prev) => !prev);
              }}
            >
              {showForm ? 'Đóng form nhân viên' : '+ Thêm nhân viên'}
            </button>
          </div>

          <div className="staff-toolbar-search">
            <label className="staff-search-bar" htmlFor="staff-table-search">
              <input
                id="staff-table-search"
                type="text"
                className="staff-search-input"
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="Theo tên, ID, email hoặc vai trò"
              />
            </label>
            <span className="staff-search-count">
              {filteredStaffList.length}/{staffList.length} nhân viên
            </span>
          </div>
        </div>
      </section>

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
                <label>Vai trò</label>
                <select
                  value={formData.staff_role_id}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, staff_role_id: event.target.value }))
                  }
                  required
                  disabled={staffRoles.length === 0}
                >
                  {staffRoles.length === 0 && <option value="">Chưa có vai trò</option>}
                  {staffRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
                <small className="field-hint">
                  Vai trò được chọn từ danh sách có sẵn, không cần nhập tay.
                </small>
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

      <section className="staff-table-shell">
        <div className="staff-table-header">
          <div>
            <p className="staff-table-kicker">Danh sách nhân sự</p>
            <div className="staff-table-header-title-row">
              <h2>Nhân viên đang quản lý</h2>
              <div className="staff-tabs">
                <button 
                  className={`staff-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  Tất cả
                </button>
                <button 
                  className={`staff-tab-btn ${activeTab === 'service' ? 'active' : ''}`}
                  onClick={() => setActiveTab('service')}
                >
                  NV Dịch vụ
                </button>
                <button 
                  className={`staff-tab-btn ${activeTab === 'cashier' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cashier')}
                >
                  Thu ngân
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="staff-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Điện thoại</th>
                <th>Số lịch</th>
                <th>Doanh thu tháng</th>
                <th>Hoa hồng 10%</th>
                <th>Trạng thái</th>
                <th>Vai trò</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffList.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-cell">
                    Không tìm thấy nhân viên phù hợp.
                  </td>
                </tr>
              )}

              {filteredStaffList.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.id}</td>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{staff.phone || '-'}</td>
                  <td>{staff.total_appointments || 0}</td>
                  <td>{formatVnd(staff.monthly_revenue || 0)}</td>
                  <td>{formatVnd(staff.monthly_commission || 0)}</td>
                  <td>
                    <span className={`staff-status ${staff.is_active ? 'active' : 'inactive'}`}>
                      <span className="staff-status-dot" aria-hidden="true" />
                      <span className="staff-status-label">
                        {staff.is_active ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </span>
                  </td>
                  <td>{staff.role_name || '-'}</td>
                  <td>
                    <div className="staff-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => openScheduleModal(staff)}
                      >
                        Xem lịch
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => startEdit(staff)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={`btn-small ${staff.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(staff)}
                      >
                        {staff.is_active ? 'Tạm khóa' : 'Kích hoạt'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingStaff && (
        <div className="staff-edit-overlay" onClick={closeEditModal}>
          <div
            className="staff-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="staff-edit-header">
              <div>
                <p className="staff-edit-kicker">Sửa nhân viên</p>
                <h3 id="staff-edit-title">{editingStaff.name || 'Nhân viên'}</h3>
              </div>
              <button
                type="button"
                className="staff-edit-close"
                onClick={closeEditModal}
                aria-label="Thoát tab sửa nhân viên"
              >
                ×
              </button>
            </div>

            <form className="staff-edit-form" onSubmit={handleSaveEdit}>
              <div className="staff-edit-grid">
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
                  <input type="email" value={editingStaff.email || ''} readOnly className="readonly-input" />
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

                <div className="form-group">
                  <label>Vai trò</label>
                  <select
                    value={editData.staff_role_id}
                    onChange={(event) => updateEditField('staff_role_id', event.target.value)}
                    disabled={staffRoles.length === 0}
                  >
                    {staffRoles.length === 0 && <option value="">Chưa có vai trò</option>}
                    {staffRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group staff-edit-status">
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
               <div className={`staff-edit-feedback ${editFeedback.type}`}>{editFeedback.text}</div>
              )}

              <div className="staff-edit-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openScheduleModal(editingStaff)}
                  disabled={savingEdit}
                >
                  Xem lịch làm việc
                </button>

                <div className="staff-edit-action-group">
                  <button type="submit" className="btn-success" disabled={savingEdit}>
                    {savingEdit ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="staff-action-neutral"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                  >
                    Thoát
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div className="staff-schedule-overlay" onClick={closeScheduleModal}>
          <div
            className="staff-schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-schedule-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="staff-schedule-header">
              <div>
                <p className="staff-schedule-kicker">Lịch làm việc hằng tuần</p>
                <h3 id="staff-schedule-title">{scheduleModal.staff.name || 'Nhân viên'}</h3>
                <p className="staff-schedule-hint">
                  Chỉ các khung giờ nằm trong lịch này mới hiển thị cho khách khi đặt lịch. Nếu chưa cấu
                  hình ngày nào, hệ thống coi như nhân viên có thể nhận lịch mọi khung giờ, trừ khi trùng
                  lịch đã đặt.
                </p>
              </div>
              <button
                type="button"
                className="staff-schedule-close"
                onClick={closeScheduleModal}
                aria-label="Đóng"
                disabled={scheduleSaving}
              >
                ×
              </button>
            </div>

            {scheduleLoading ? (
              <div className="staff-schedule-loading">Đang tải lịch...</div>
            ) : (
              <>
                <div className="staff-schedule-table-wrap">
                  <table className="staff-schedule-table">
                    <thead>
                      <tr>
                        <th>Ngày trong tuần</th>
                        <th>Làm việc</th>
                        <th>Từ</th>
                        <th>Đến</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleModal.days.map((day, index) => (
                        <tr key={day.day_of_week}>
                          <td>{day.label}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={day.enabled}
                              onChange={(event) =>
                                updateScheduleDay(index, { enabled: event.target.checked })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={day.start}
                              disabled={!day.enabled}
                              onChange={(event) => updateScheduleDay(index, { start: event.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={day.end}
                              disabled={!day.enabled}
                              onChange={(event) => updateScheduleDay(index, { end: event.target.value })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="staff-schedule-actions">
                  <button
                    type="button"
                    className="btn-success"
                    onClick={handleSaveSchedule}
                    disabled={scheduleSaving}
                  >
                    {scheduleSaving ? 'Đang lưu...' : 'Lưu lịch'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeScheduleModal}
                    disabled={scheduleSaving}
                  >
                    Đóng
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageStaff;
