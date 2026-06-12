import React, { useEffect, useMemo, useState } from 'react';
import authService from '../../../services/authService';
import staffService from '../../../services/staffService';
import './StaffShiftRegistration.css';

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

  if (dayIndex >= 0 && dayIndex <= 4 && start === '08:00' && end === '21:00') return 'full';
  if (dayIndex >= 5 && start === '07:00' && end === '23:00') return 'full';
  if (endMinutes - startMinutes > 8 * 60) return 'full';

  return startHour < 12 ? 'morning' : 'evening';
};

const getTimesFromShift = (dayIndex, shift) => {
  if (dayIndex >= 0 && dayIndex <= 4) {
    if (shift === 'morning') return { start: '08:00', end: '16:00' };
    if (shift === 'evening') return { start: '13:30', end: '21:00' };
    if (shift === 'full') return { start: '08:00', end: '21:00' };
  } else {
    if (shift === 'morning') return { start: '07:00', end: '15:00' };
    if (shift === 'evening') return { start: '15:00', end: '23:00' };
    if (shift === 'full') return { start: '07:00', end: '23:00' };
  }

  return null;
};

const getShiftLabel = (shift) => SHIFT_OPTIONS.find((item) => item.value === shift)?.label || 'Ca sáng';

const buildWeekFromRows = (rows = []) =>
  WEEKDAY_LABELS.map((label, dayIndex) => {
    const row = rows.find((item) => Number(item.day_of_week) === dayIndex);
    return {
      day_of_week: dayIndex,
      label,
      shift: row ? getShiftFromTimes(dayIndex, row.start_time, row.end_time) : 'morning'
    };
  });

const getLeaveStatusLabel = (status) => {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'rejected') return 'Từ chối';
  return 'Chờ duyệt';
};

const getScheduleApiErrorMessage = (err, fallback) => {
  const status = err?.response?.status;

  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải lịch làm việc.';
  }

  if (status === 403) {
    return 'Tài khoản này chưa có quyền dùng chức năng lịch làm việc.';
  }

  if (!err?.response || err?.code === 'ERR_NETWORK') {
    return 'Không kết nối được backend. Kiểm tra backend đang chạy ở cổng 5000 rồi thử lại.';
  }

  return err.response?.data?.message || fallback;
};

function StaffShiftRegistration() {
  const currentUser = authService.getUser();
  const [weeklySchedule, setWeeklySchedule] = useState(buildWeekFromRows());
  const [weeklyScheduleLoading, setWeeklyScheduleLoading] = useState(false);
  const [weeklyScheduleSaving, setWeeklyScheduleSaving] = useState(false);
  const [weeklyScheduleMessage, setWeeklyScheduleMessage] = useState('');
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [showLeaveRequestConfirm, setShowLeaveRequestConfirm] = useState(false);
  const [leaveRequestSubmitting, setLeaveRequestSubmitting] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [myLeaveRequests, setMyLeaveRequests] = useState([]);

  useEffect(() => {
    fetchMyWeeklySchedule();
    fetchMyLeaveRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyWeeklySchedule = async () => {
    try {
      setWeeklyScheduleLoading(true);
      setWeeklyScheduleMessage('');
      const response = await staffService.getMyWeeklyAvailability();
      setWeeklySchedule(buildWeekFromRows(response.data?.data || []));
    } catch (err) {
      setWeeklyScheduleMessage(getScheduleApiErrorMessage(err, 'Không thể tải ca làm đã đăng ký.'));
    } finally {
      setWeeklyScheduleLoading(false);
    }
  };

  const fetchMyLeaveRequests = async () => {
    try {
      const response = await staffService.getMyLeaveRequests();
      setMyLeaveRequests(response.data?.data || []);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử nghỉ phép:', getScheduleApiErrorMessage(err, 'Không thể tải lịch sử nghỉ phép.'));
    }
  };

  const updateWeeklyScheduleDay = (dayIndex, patch) => {
    setWeeklyScheduleMessage('');
    setWeeklySchedule((prev) =>
      prev.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day))
    );
  };

  const handleSaveWeeklySchedule = async () => {
    if (weeklySchedule.length !== 7 || weeklySchedule.some((day) => !['morning', 'evening', 'full'].includes(day.shift))) {
      setWeeklyScheduleMessage('Vui lòng chọn ca sáng, ca tối hoặc full ca cho đủ 7 ngày trong tuần.');
      return;
    }

    const slots = weeklySchedule.map((day) => {
      const times = getTimesFromShift(day.day_of_week, day.shift);
      return {
        day_of_week: day.day_of_week,
        start_time: times.start,
        end_time: times.end
      };
    });

    try {
      setWeeklyScheduleSaving(true);
      setWeeklyScheduleMessage('');
      await staffService.replaceMyWeeklyAvailability(slots);
      setWeeklyScheduleMessage('Đã lưu ca làm của bạn thành công.');
    } catch (err) {
      setWeeklyScheduleMessage(getScheduleApiErrorMessage(err, 'Không thể lưu ca làm.'));
    } finally {
      setWeeklyScheduleSaving(false);
    }
  };

  const handleSubmitLeaveRequest = async (event) => {
    event.preventDefault();

    if (!leaveRequest.start_date || !leaveRequest.end_date || !leaveRequest.reason.trim()) {
      window.alert('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    setShowLeaveRequestConfirm(true);
  };

  const confirmSubmitLeaveRequest = async () => {
    try {
      setLeaveRequestSubmitting(true);
      await staffService.requestLeave(leaveRequest);
      setWeeklyScheduleMessage('Đã gửi yêu cầu nghỉ phép thành công. Chờ quản lý xác nhận.');
      setShowLeaveRequestConfirm(false);
      setShowLeaveRequestModal(false);
      setLeaveRequest({ start_date: '', end_date: '', reason: '' });
      fetchMyLeaveRequests();
    } catch (err) {
      window.alert(getScheduleApiErrorMessage(err, 'Có lỗi xảy ra khi gửi yêu cầu.'));
    } finally {
      setLeaveRequestSubmitting(false);
    }
  };

  const morningShiftCount = useMemo(
    () => weeklySchedule.filter((day) => day.shift === 'morning').length,
    [weeklySchedule]
  );
  const eveningShiftCount = useMemo(
    () => weeklySchedule.filter((day) => day.shift === 'evening').length,
    [weeklySchedule]
  );
  const fullShiftCount = useMemo(
    () => weeklySchedule.filter((day) => day.shift === 'full').length,
    [weeklySchedule]
  );

  const shiftSummaryCards = [
    { key: 'days', label: 'Ngày đã chọn', value: weeklySchedule.length, tone: 'total' },
    { key: 'morning', label: 'Ca sáng', value: morningShiftCount, tone: 'morning' },
    { key: 'evening', label: 'Ca tối', value: eveningShiftCount, tone: 'evening' },
    { key: 'full', label: 'Full ca', value: fullShiftCount, tone: 'full' }
  ];

  return (
    <div className="staff-shifts-page">
      <div className="staff-shifts-workspace">
        <section className="staff-weekly-register">
          <div className="staff-weekly-register-head">
            <div>
              <p>Ca làm của tôi</p>
              <h1>Đăng ký ca làm hằng tuần</h1>
              <small className="weekly-schedule-hint">
                Chào {currentUser?.name || 'bạn'}, chọn ca sáng, ca tối hoặc full ca cho đủ 7 ngày.
                Đang chọn: <strong>{morningShiftCount} ca sáng</strong> · <strong>{eveningShiftCount} ca tối</strong> · <strong>{fullShiftCount} full ca</strong>
              </small>
            </div>
          </div>

          {weeklyScheduleMessage && <div className="weekly-schedule-message">{weeklyScheduleMessage}</div>}

          <div className="weekly-schedule-grid" aria-busy={weeklyScheduleLoading}>
            {weeklySchedule.map((day, index) => {
              const times = getTimesFromShift(day.day_of_week, day.shift);
              return (
                <div className="weekly-schedule-day is-enabled" key={day.day_of_week}>
                  <span className="weekly-day-name">{day.label}</span>
                  <div className="weekly-shift-selector">
                    <select
                      className="weekly-shift-select"
                      value={day.shift}
                      disabled={weeklyScheduleLoading}
                      onChange={(event) => updateWeeklyScheduleDay(index, { shift: event.target.value })}
                    >
                      {SHIFT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="weekly-time-display">
                    {times ? (
                      <span className="shift-time-range">
                        {getShiftLabel(day.shift)} · {times.start} - {times.end}
                      </span>
                    ) : (
                      <span className="shift-off-label">Chưa có khung giờ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="staff-shifts-actions">
            <button
              type="button"
              className="btn-leave-request"
              onClick={() => setShowLeaveRequestModal(true)}
            >
              Yêu cầu nghỉ phép
            </button>
            <button
              type="button"
              className="btn-save-weekly"
              onClick={handleSaveWeeklySchedule}
              disabled={weeklyScheduleSaving || weeklyScheduleLoading}
            >
              {weeklyScheduleSaving ? 'Đang lưu...' : 'Lưu ca làm'}
            </button>
          </div>
        </section>

        <aside className="staff-shifts-side-panel">
          <section className="staff-shifts-insights">
            <div className="staff-shifts-section-head">
              <p>Thống kê</p>
              <h2>Tổng quan ca làm</h2>
            </div>

            <div className="staff-shifts-summary">
              {shiftSummaryCards.map((item) => (
                <article key={item.key} className={`staff-shifts-summary-card tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="staff-shifts-leave-history">
            <div className="staff-shifts-section-head">
              <p>Lịch sử</p>
              <h2>Yêu cầu nghỉ phép</h2>
            </div>

            {myLeaveRequests.length === 0 ? (
              <div className="staff-shifts-empty-state">
                <p>Bạn chưa gửi yêu cầu nghỉ phép nào.</p>
              </div>
            ) : (
              <div className="staff-shifts-leave-list">
                {myLeaveRequests.map((request) => (
                  <article className="staff-shifts-leave-card" key={request.id}>
                    <div className="staff-shifts-leave-copy">
                      <strong>
                        {new Date(request.start_date).toLocaleDateString('vi-VN')} - {new Date(request.end_date).toLocaleDateString('vi-VN')}
                      </strong>
                      <span>{request.reason}</span>
                    </div>
                    <span className={`staff-shifts-status ${request.status || 'pending'}`}>
                      {getLeaveStatusLabel(request.status)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {showLeaveRequestModal && (
        <div className="staff-shifts-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-request-title">
          <div className="staff-shifts-modal">
            <div className="staff-shifts-modal-header">
              <h2 id="leave-request-title">Yêu cầu nghỉ phép</h2>
              <button
                type="button"
                className="staff-shifts-modal-close"
                onClick={() => {
                  setShowLeaveRequestConfirm(false);
                  setShowLeaveRequestModal(false);
                }}
                aria-label="Đóng cửa sổ yêu cầu nghỉ phép"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitLeaveRequest} className="staff-shifts-modal-body">
              <div className="staff-shifts-form-group">
                <label>Từ ngày</label>
                <input
                  type="date"
                  value={leaveRequest.start_date}
                  onChange={(event) => setLeaveRequest({ ...leaveRequest, start_date: event.target.value })}
                  required
                />
              </div>
              <div className="staff-shifts-form-group">
                <label>Đến ngày</label>
                <input
                  type="date"
                  value={leaveRequest.end_date}
                  onChange={(event) => setLeaveRequest({ ...leaveRequest, end_date: event.target.value })}
                  required
                />
              </div>
              <div className="staff-shifts-form-group">
                <label>Lý do</label>
                <textarea
                  value={leaveRequest.reason}
                  onChange={(event) => setLeaveRequest({ ...leaveRequest, reason: event.target.value })}
                  required
                  rows="3"
                />
              </div>
              <div className="staff-shifts-modal-actions">
                <button type="submit" className="btn-submit-leave">
                  Gửi yêu cầu
                </button>
                <button
                  type="button"
                  className="btn-cancel-leave"
                  onClick={() => {
                    setShowLeaveRequestConfirm(false);
                    setShowLeaveRequestModal(false);
                  }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveRequestConfirm && (
        <div className="staff-shifts-modal-overlay staff-shifts-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
          <div className="staff-shifts-confirm-modal">
            <div className="staff-shifts-confirm-head">
              <h2 id="leave-confirm-title">Xác nhận gửi yêu cầu?</h2>
              <p>Yêu cầu nghỉ phép sẽ được gửi cho quản lý xét duyệt.</p>
            </div>
            <div className="staff-shifts-confirm-details">
              <div>
                <span>Từ ngày</span>
                <strong>{leaveRequest.start_date ? new Date(leaveRequest.start_date).toLocaleDateString('vi-VN') : '-'}</strong>
              </div>
              <div>
                <span>Đến ngày</span>
                <strong>{leaveRequest.end_date ? new Date(leaveRequest.end_date).toLocaleDateString('vi-VN') : '-'}</strong>
              </div>
              <div className="is-wide">
                <span>Lý do</span>
                <strong>{leaveRequest.reason || '-'}</strong>
              </div>
            </div>
            <div className="staff-shifts-confirm-actions">
              <button
                type="button"
                className="btn-cancel-leave"
                onClick={() => setShowLeaveRequestConfirm(false)}
                disabled={leaveRequestSubmitting}
              >
                Xem lại
              </button>
              <button
                type="button"
                className="btn-submit-leave"
                onClick={confirmSubmitLeaveRequest}
                disabled={leaveRequestSubmitting}
              >
                {leaveRequestSubmitting ? 'Đang gửi...' : 'Xác nhận gửi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffShiftRegistration;
