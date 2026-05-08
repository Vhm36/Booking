import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import staffService from '../../../services/staffService';
import './StaffLeaveManagement.css';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

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
      start: String(row.start_time || '').slice(0, 5),
      end: String(row.end_time || '').slice(0, 5)
    };
  });

const normalizeStaff = (list = []) =>
  list.map((item) => ({
    ...item,
    is_active: Number(item.is_active) === 1 || item.is_active === true
  }));

const minutesFromTime = (time) => {
  const [hour, minute] = String(time || '00:00').split(':').map((value) => Number(value) || 0);
  return hour * 60 + minute;
};

function StaffLeaveManagement() {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [weekSlots, setWeekSlots] = useState(() => buildWeekFromRows());
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState('weekly');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadLeaveRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await staffService.getAllLeaveRequests();
      setLeaveRequests(response.data?.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách yêu cầu nghỉ phép:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await staffService.getAllStaff();
        const activeStaff = normalizeStaff(response.data?.data || []).filter((staff) => staff.is_active);
        setStaffList(activeStaff);
        if (activeStaff.length > 0) {
          setSelectedStaffId(String(activeStaff[0].id));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải danh sách nhân viên.');
      } finally {
        setLoading(false);
      }
    };
    load();
    loadLeaveRequests();
  }, []);

  useEffect(() => {
    const loadSchedule = async () => {
      if (!selectedStaffId) {
        setWeekSlots(buildWeekFromRows());
        return;
      }

      try {
        setLoadingSchedule(true);
        setSuccess('');
        setError('');
        const response = await staffService.getStaffWeeklyAvailability(selectedStaffId);
        setWeekSlots(buildWeekFromRows(response.data?.data || []));
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải lịch làm việc.');
      } finally {
        setLoadingSchedule(false);
      }
    };
    loadSchedule();
  }, [selectedStaffId]);

  const selectedStaff = useMemo(
    () => staffList.find((staff) => String(staff.id) === String(selectedStaffId)) || null,
    [staffList, selectedStaffId]
  );

  const offDayCount = useMemo(() => weekSlots.filter((day) => !day.enabled).length, [weekSlots]);
  const workingDayCount = 7 - offDayCount;

  const totalWorkingMinutes = useMemo(
    () =>
      weekSlots
        .filter((day) => day.enabled)
        .reduce((total, day) => total + Math.max(0, minutesFromTime(day.end) - minutesFromTime(day.start)), 0),
    [weekSlots]
  );

  const weeklyHoursLabel = useMemo(() => {
    const hours = Math.floor(totalWorkingMinutes / 60);
    const minutes = totalWorkingMinutes % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }, [totalWorkingMinutes]);

  const updateDay = (dayIndex, patch) => {
    setSuccess('');
    setError('');
    setWeekSlots((prev) => prev.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)));
  };

  const setAllEnabled = (enabled) => {
    setSuccess('');
    setError('');
    setWeekSlots((prev) => prev.map((day) => ({ ...day, enabled })));
  };

  const applyPreset = (start, end) => {
    setSuccess('');
    setError('');
    setWeekSlots((prev) =>
      prev.map((day) => ({
        ...day,
        enabled: true,
        start,
        end
      }))
    );
  };

  const saveSchedule = async () => {
    if (!selectedStaffId) return;

    const invalidDay = weekSlots.find((day) => day.enabled && minutesFromTime(day.end) <= minutesFromTime(day.start));
    if (invalidDay) {
      setError(`Khung giờ ${invalidDay.label} không hợp lệ. Giờ kết thúc phải lớn hơn giờ bắt đầu.`);
      return;
    }

    const slots = weekSlots
      .filter((day) => day.enabled)
      .map((day) => ({
        day_of_week: day.day_of_week,
        start_time: day.start,
        end_time: day.end
      }));

    try {
      setSavingSchedule(true);
      setError('');
      await staffService.replaceStaffWeeklyAvailability(selectedStaffId, slots);
      setSuccess('Đã lưu lịch nghỉ/lịch làm việc cho nhân viên.');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu lịch nghỉ.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${status === 'approved' ? 'duyệt' : 'từ chối'} yêu cầu này?`)) return;
    try {
      await staffService.updateLeaveRequestStatus(id, status);
      window.alert('Cập nhật trạng thái thành công');
      loadLeaveRequests();
    } catch (err) {
      window.alert('Lỗi: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return <div className="loading">Đang tải dữ liệu nhân viên...</div>;
  }

  return (
    <div className="staff-leave-admin">
      <div className="staff-leave-head">
        <div className="staff-leave-head-copy">
          <p className="staff-leave-kicker">Admin</p>
          <h1>Quản lý lịch nghỉ nhân viên</h1>
          <p>Thiết lập ngày làm/lịch nghỉ theo tuần cho từng nhân viên.</p>
        </div>

        <div className="staff-leave-head-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin/staff')}>
            Quay lại quản lý nhân viên
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="staff-leave-tabs">
        <button
          type="button"
          className={`btn-tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          Lịch nghỉ cố định
        </button>
        <button
          type="button"
          className={`btn-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Yêu cầu xin nghỉ phép (Ad-hoc)
        </button>
      </div>

      <div className="staff-leave-panel">
        {activeTab === 'weekly' && (
          <>
            <div className="staff-leave-control-grid">
          <div className="form-group">
            <label>Chọn nhân viên</label>
            <select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)}>
              {staffList.length === 0 && <option value="">Không có nhân viên đang hoạt động</option>}
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.role_name || 'Nhân viên'})
                </option>
              ))}
            </select>
          </div>

          <div className="staff-leave-stat-grid">
            <div className="staff-leave-stat">
              <span>Ngày làm</span>
              <strong>{workingDayCount}/7</strong>
            </div>
            <div className="staff-leave-stat">
              <span>Ngày nghỉ</span>
              <strong>{offDayCount}/7</strong>
            </div>
            <div className="staff-leave-stat">
              <span>Tổng giờ/tuần</span>
              <strong>{weeklyHoursLabel}</strong>
            </div>
          </div>
        </div>

        {selectedStaff && (
          <div className="staff-leave-meta">
            <strong>{selectedStaff.name}</strong>
            <span>{selectedStaff.email}</span>
            <span>{offDayCount}/7 ngày đang nghỉ</span>
          </div>
        )}

        <div className="staff-leave-tools">
          <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('08:00', '21:00')}>
            Fulltime (8:00 - 21:00)
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('08:00', '14:30')}>
            Ca sáng (8:00 - 14:30)
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => applyPreset('14:30', '21:00')}>
            Ca chiều (14:30 - 21:00)
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => setAllEnabled(true)}>
            Làm cả tuần
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => setAllEnabled(false)}>
            Nghỉ cả tuần
          </button>
        </div>

        {loadingSchedule ? (
          <div className="staff-leave-loading">Đang tải lịch tuần...</div>
        ) : (
          <div className="staff-leave-table-wrap">
            <table className="staff-leave-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Làm việc</th>
                  <th>Từ</th>
                  <th>Đến</th>
                </tr>
              </thead>
              <tbody>
                {weekSlots.map((day, index) => (
                  <tr key={day.day_of_week} className={day.enabled ? 'is-working' : 'is-off'}>
                    <td className="staff-leave-day-cell">
                      <strong>{day.label}</strong>
                      <span className={`staff-leave-day-badge ${day.enabled ? 'working' : 'off'}`}>
                        {day.enabled ? 'Làm việc' : 'Nghỉ'}
                      </span>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) => updateDay(index, { enabled: event.target.checked })}
                        aria-label={`Trạng thái làm việc ${day.label}`}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={day.start}
                        disabled={!day.enabled}
                        onChange={(event) => updateDay(index, { start: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={day.end}
                        disabled={!day.enabled}
                        onChange={(event) => updateDay(index, { end: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="staff-leave-actions">
          <button type="button" className="btn-primary" onClick={saveSchedule} disabled={savingSchedule || !selectedStaffId}>
            {savingSchedule ? 'Đang lưu...' : 'Lưu lịch nghỉ'}
          </button>
        </div>
        </>
        )}

        {activeTab === 'requests' && (
          <div className="staff-leave-requests-section">
            <h2>Danh sách đơn xin nghỉ phép</h2>
            {loadingRequests ? (
              <div className="loading">Đang tải danh sách...</div>
            ) : leaveRequests.length === 0 ? (
              <p>Chưa có yêu cầu nghỉ phép nào.</p>
            ) : (
              <table className="staff-leave-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Từ ngày</th>
                    <th>Đến ngày</th>
                    <th>Lý do</th>
                    <th>Ngày gửi</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map(req => (
                    <tr key={req.id}>
                      <td><strong>{req.staff_name}</strong></td>
                      <td>{new Date(req.start_date).toLocaleDateString('vi-VN')}</td>
                      <td>{new Date(req.end_date).toLocaleDateString('vi-VN')}</td>
                      <td>{req.reason}</td>
                      <td>{new Date(req.created_at).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`status-badge ${req.status}`}>
                          {req.status === 'pending' ? 'Chờ duyệt' : req.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </span>
                      </td>
                      <td>
                        {req.status === 'pending' && (
                          <div className="action-buttons">
                            <button className="btn-success btn-small" onClick={() => handleUpdateStatus(req.id, 'approved')}>Duyệt</button>
                            <button className="btn-danger btn-small" onClick={() => handleUpdateStatus(req.id, 'rejected')}>Từ chối</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffLeaveManagement;
