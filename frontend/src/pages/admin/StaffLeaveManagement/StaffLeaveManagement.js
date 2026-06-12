import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import staffService from '../../../services/staffService';
import './StaffLeaveManagement.css';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Ca sáng' },
  { value: 'evening', label: 'Ca tối' },
  { value: 'full', label: 'Full ca' }
];

const getShiftFromTimes = (dayIndex, startTime, endTime) => {
  if (!startTime || !endTime) return 'morning';
  const start = String(startTime).slice(0, 5);
  const end = String(endTime).slice(0, 5);
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (dayIndex >= 0 && dayIndex <= 4 && start === '08:00' && end === '21:30') return 'full';
  if (dayIndex >= 5 && start === '07:00' && end === '23:00') return 'full';
  if (endMinutes - startMinutes > 8 * 60) return 'full';

  return startHour < 12 ? 'morning' : 'evening';
};

const getTimesFromShift = (dayIndex, shift) => {
  if (dayIndex >= 0 && dayIndex <= 4) {
    // Thứ 2 - Thứ 6
    if (shift === 'morning') return { start: '08:00', end: '16:00' };
    if (shift === 'evening') return { start: '13:30', end: '21:30' };
    if (shift === 'full') return { start: '08:00', end: '21:30' };
  } else {
    // Thứ 7 - Chủ Nhật
    if (shift === 'morning') return { start: '07:00', end: '15:00' };
    if (shift === 'evening') return { start: '15:00', end: '23:00' };
    if (shift === 'full') return { start: '07:00', end: '23:00' };
  }
  return null;
};

const buildWeekFromRows = (rows = []) =>
  WEEKDAY_LABELS.map((label, dayIndex) => {
    const row = rows.find((item) => Number(item.day_of_week) === dayIndex);
    return {
      day_of_week: dayIndex,
      label,
      shift: row ? getShiftFromTimes(dayIndex, row.start_time, row.end_time) : 'morning'
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

const getStaffInitials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'NV';

function StaffLeaveManagement() {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [weekSlots, setWeekSlots] = useState(() => buildWeekFromRows());
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState('weekly');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [confirmLeaveAction, setConfirmLeaveAction] = useState(null);
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState(null);
  const [leaveActionSuccess, setLeaveActionSuccess] = useState('');

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

  useEffect(() => {
    if (!leaveActionSuccess) return undefined;

    const timer = window.setTimeout(() => setLeaveActionSuccess(''), 1800);
    return () => window.clearTimeout(timer);
  }, [leaveActionSuccess]);

  const selectedStaff = useMemo(
    () => staffList.find((staff) => String(staff.id) === String(selectedStaffId)) || null,
    [staffList, selectedStaffId]
  );

  useEffect(() => {
    if (selectedStaff && !isStaffPickerOpen) {
      setStaffSearch(selectedStaff.name || '');
    }
  }, [selectedStaff, isStaffPickerOpen]);

  const filteredStaffList = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase();
    if (!keyword) return staffList;

    return staffList.filter((staff) => {
      const content = `${staff.name || ''} ${staff.email || ''} ${staff.role_name || ''}`.toLowerCase();
      return content.includes(keyword);
    });
  }, [staffList, staffSearch]);

  const morningShiftCount = useMemo(() => weekSlots.filter((day) => day.shift === 'morning').length, [weekSlots]);
  const eveningShiftCount = useMemo(() => weekSlots.filter((day) => day.shift === 'evening').length, [weekSlots]);
  const fullShiftCount = useMemo(() => weekSlots.filter((day) => day.shift === 'full').length, [weekSlots]);

  const totalWorkingMinutes = useMemo(
    () =>
      weekSlots.reduce((total, day) => {
        const times = getTimesFromShift(day.day_of_week, day.shift);
        if (!times) return total;
        return total + Math.max(0, minutesFromTime(times.end) - minutesFromTime(times.start));
      }, 0),
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

  const chooseStaff = (staff) => {
    setSuccess('');
    setError('');
    setSelectedStaffId(String(staff.id));
    setStaffSearch(staff.name || '');
    setIsStaffPickerOpen(false);
  };

  const saveSchedule = async () => {
    if (!selectedStaffId) return;

    if (weekSlots.length !== 7 || weekSlots.some((day) => !['morning', 'evening', 'full'].includes(day.shift))) {
      setError('Vui lòng chọn ca sáng, ca tối hoặc full ca cho đủ 7 ngày trong tuần.');
      return;
    }

    const slots = weekSlots.map((day) => {
      const times = getTimesFromShift(day.day_of_week, day.shift);
      return {
        day_of_week: day.day_of_week,
        start_time: times.start,
        end_time: times.end
      };
    });

    try {
      setSavingSchedule(true);
      setError('');
      setSuccess('');
      await staffService.replaceStaffWeeklyAvailability(selectedStaffId, slots);
      setSuccess('Đã lưu ca làm hằng tuần cho nhân viên thành công.');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu ca làm.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const openLeaveActionConfirm = (request, status) => {
    setError('');
    setLeaveActionSuccess('');
    setConfirmLeaveAction({ request, status });
  };

  const closeLeaveActionConfirm = () => {
    if (leaveActionLoadingId) return;
    setConfirmLeaveAction(null);
  };

  const handleUpdateStatus = async () => {
    if (!confirmLeaveAction?.request) return;

    const { request, status } = confirmLeaveAction;
    try {
      setLeaveActionLoadingId(request.id);
      await staffService.updateLeaveRequestStatus(request.id, status);
      setConfirmLeaveAction(null);
      setLeaveActionSuccess(status === 'approved' ? 'Đã duyệt đơn nghỉ phép' : 'Đã từ chối đơn nghỉ phép');
      await loadLeaveRequests();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể cập nhật trạng thái yêu cầu nghỉ phép.');
    } finally {
      setLeaveActionLoadingId(null);
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
          <h1>Quản lý ca làm nhân viên</h1>
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
          Ca làm cố định
        </button>
        <button
          type="button"
          className={`btn-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Yêu cầu xin nghỉ phép
        </button>
      </div>

      <div className="staff-leave-panel">
        {activeTab === 'weekly' && (
          <div className="staff-leave-weekly-layout">
            <section className="staff-leave-config-panel">
              <div className="staff-search-block">
                <label htmlFor="staff-search-combobox">Chọn nhân viên</label>
                <div className="staff-search-select">
                  <input
                    id="staff-search-combobox"
                    type="search"
                    value={staffSearch}
                    placeholder="Tìm theo tên, email..."
                    autoComplete="off"
                    disabled={staffList.length === 0}
                    onFocus={() => setIsStaffPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setIsStaffPickerOpen(false), 120)}
                    onChange={(event) => {
                      setStaffSearch(event.target.value);
                      setIsStaffPickerOpen(true);
                    }}
                  />

                  {isStaffPickerOpen && (
                    <div className="staff-search-menu" role="listbox">
                      {filteredStaffList.length === 0 ? (
                        <div className="staff-search-empty">Không tìm thấy nhân viên</div>
                      ) : (
                        filteredStaffList.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            className={`staff-search-option ${String(staff.id) === String(selectedStaffId) ? 'selected' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              chooseStaff(staff);
                            }}
                          >
                            <span className="staff-option-avatar">{getStaffInitials(staff.name)}</span>
                            <span className="staff-option-copy">
                              <strong>{staff.name}</strong>
                              <small>{staff.email || staff.role_name || 'Nhân viên'}</small>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedStaff && (
                <div className="staff-profile-card">
                  <div className="staff-profile-avatar">{getStaffInitials(selectedStaff.name)}</div>
                  <div className="staff-profile-copy">
                    <strong>{selectedStaff.name}</strong>
                    <span>{selectedStaff.email || 'Chưa có email'}</span>
                  </div>
                </div>
              )}

              <div className="staff-leave-stat-card">
                <div className="staff-leave-stat-grid">
                  <div className="staff-leave-stat">
                    <span>Ca sáng</span>
                    <strong>{morningShiftCount}/7</strong>
                  </div>
                  <div className="staff-leave-stat">
                    <span>Ca tối</span>
                    <strong>{eveningShiftCount}/7</strong>
                  </div>
                  <div className="staff-leave-stat">
                    <span>Full ca</span>
                    <strong>{fullShiftCount}/7</strong>
                  </div>
                  <div className="staff-leave-stat">
                    <span>Tổng giờ</span>
                    <strong>{weeklyHoursLabel}</strong>
                  </div>
                </div>
              </div>

              <div className="staff-shift-legend" aria-label="Chú thích ca làm">
                <span><i className="shift-dot morning" />Ca sáng</span>
                <span><i className="shift-dot evening" />Ca tối</span>
                <span><i className="shift-dot full" />Full ca</span>
              </div>
            </section>

            <section className="staff-leave-schedule-panel">
              {loadingSchedule ? (
                <div className="staff-leave-loading">Đang tải lịch tuần...</div>
              ) : (
                <div className="staff-leave-table-wrap staff-leave-weekly-table-wrap">
                  <table className="staff-leave-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Ca làm</th>
                        <th>Khung giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekSlots.map((day, index) => {
                        const times = getTimesFromShift(day.day_of_week, day.shift);
                        return (
                          <tr key={day.day_of_week} className={`is-working shift-${day.shift}`}>
                            <td className="staff-leave-day-cell">
                              <strong>{day.label}</strong>
                            </td>
                            <td>
                              <select
                                className="staff-shift-select"
                                value={day.shift}
                                onChange={(event) => updateDay(index, { shift: event.target.value })}
                              >
                                {SHIFT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {times ? (
                                <span className="staff-shift-time">{times.start} - {times.end}</span>
                              ) : (
                                <span className="staff-shift-time muted">Chưa có khung giờ</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="staff-leave-actions">
                <button type="button" className="btn-primary" onClick={saveSchedule} disabled={savingSchedule || !selectedStaffId}>
                  {savingSchedule ? 'Đang lưu...' : 'Lưu ca làm'}
                </button>
              </div>
            </section>
          </div>
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
                            <button
                              type="button"
                              className="btn-success btn-small"
                              disabled={leaveActionLoadingId === req.id}
                              onClick={() => openLeaveActionConfirm(req, 'approved')}
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-small"
                              disabled={leaveActionLoadingId === req.id}
                              onClick={() => openLeaveActionConfirm(req, 'rejected')}
                            >
                              Từ chối
                            </button>
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

      {confirmLeaveAction && (
        <div className="leave-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
          <div className="leave-confirm-modal">
            <div className="leave-confirm-head">
              <span className={`leave-confirm-mark ${confirmLeaveAction.status}`} aria-hidden="true" />
              <div>
                <p>{confirmLeaveAction.status === 'approved' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</p>
                <h2 id="leave-confirm-title">
                  {confirmLeaveAction.status === 'approved'
                    ? 'Bạn muốn duyệt đơn nghỉ phép này?'
                    : 'Bạn muốn từ chối đơn nghỉ phép này?'}
                </h2>
              </div>
            </div>

            <div className="leave-confirm-details">
              <div>
                <span>Nhân viên</span>
                <strong>{confirmLeaveAction.request.staff_name || '-'}</strong>
              </div>
              <div>
                <span>Khoảng nghỉ</span>
                <strong>
                  {new Date(confirmLeaveAction.request.start_date).toLocaleDateString('vi-VN')} - {new Date(confirmLeaveAction.request.end_date).toLocaleDateString('vi-VN')}
                </strong>
              </div>
              <div className="leave-confirm-reason">
                <span>Lý do</span>
                <strong>{confirmLeaveAction.request.reason || '-'}</strong>
              </div>
            </div>

            <div className="leave-confirm-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={Boolean(leaveActionLoadingId)}
                onClick={closeLeaveActionConfirm}
              >
                Không
              </button>
              <button
                type="button"
                className={`leave-confirm-primary ${confirmLeaveAction.status}`}
                disabled={Boolean(leaveActionLoadingId)}
                onClick={handleUpdateStatus}
              >
                {leaveActionLoadingId
                  ? 'Đang xử lý...'
                  : confirmLeaveAction.status === 'approved'
                    ? 'Có, duyệt'
                    : 'Có, từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {leaveActionSuccess && (
        <div className="leave-success-toast" role="status" aria-live="polite">
          <span className="leave-success-check" aria-hidden="true" />
          <strong>{leaveActionSuccess}</strong>
        </div>
      )}
    </div>
  );
}

export default StaffLeaveManagement;
