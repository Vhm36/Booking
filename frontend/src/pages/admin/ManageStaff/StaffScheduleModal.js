import React, { useEffect, useState } from 'react';
import './StaffScheduleModal.css';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Ca sáng' },
  { value: 'evening', label: 'Ca tối' },
  { value: 'full', label: 'Full ca' }
];

const getShiftFromTimes = (startTime, endTime) => {
  const start = String(startTime || '08:00').slice(0, 5);
  const end = String(endTime || '16:00').slice(0, 5);
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if ((start === '08:00' && end === '21:00') || (start === '07:00' && end === '23:00')) return 'full';
  if (endMinutes - startMinutes > 8 * 60) return 'full';

  return startHour < 12 ? 'morning' : 'evening';
};

const getTimesFromShift = (dayIndex, shift) => {
  if (dayIndex >= 0 && dayIndex <= 4) {
    // Thứ 2 - Thứ 6
    if (shift === 'morning') return { start: '08:00', end: '16:00' };
    if (shift === 'evening') return { start: '13:30', end: '21:00' };
    if (shift === 'full') return { start: '08:00', end: '21:00' };
  } else {
    // Thứ 7 - Chủ nhật
    if (shift === 'morning') return { start: '07:00', end: '15:00' };
    if (shift === 'evening') return { start: '15:00', end: '23:00' };
    if (shift === 'full') return { start: '07:00', end: '23:00' };
  }
  return { start: '08:00', end: '16:00' };
};

const getShiftLabel = (shift) => SHIFT_OPTIONS.find((item) => item.value === shift)?.label || 'Ca sáng';

const normalizeScheduleState = (rows = []) =>
  WEEKDAY_LABELS.map((label, dayIndex) => {
    const row = rows.find((item) => Number(item.day_of_week) === dayIndex);
    const shift = row?.shift || (row ? getShiftFromTimes(row.start || row.start_time, row.end || row.end_time) : 'morning');
    const times = getTimesFromShift(dayIndex, shift);

    return {
      day_of_week: dayIndex,
      label,
      shift,
      start: times.start,
      end: times.end
    };
  });

function StaffScheduleModal({
  staff,
  scheduleData = [],
  onClose,
  onSave,
  loading = false,
  saving = false
}) {
  const [viewMode, setViewMode] = useState('week');
  const [currentDate] = useState(new Date());
  const [scheduleState, setScheduleState] = useState(() => normalizeScheduleState(scheduleData));

  useEffect(() => {
    setScheduleState(normalizeScheduleState(scheduleData));
  }, [scheduleData]);

  const updateDayShift = (dayOfWeek, shift) => {
    setScheduleState((prev) =>
      prev.map((day) => {
        if (Number(day.day_of_week) !== dayOfWeek) {
          return day;
        }

        const times = getTimesFromShift(dayOfWeek, shift);
        return {
          ...day,
          shift,
          start: times.start,
          end: times.end
        };
      })
    );
  };

  const applyShiftToWholeWeek = (shift) => {
    setScheduleState((prev) =>
      prev.map((day) => {
        const times = getTimesFromShift(Number(day.day_of_week), shift);
        return {
          ...day,
          shift,
          start: times.start,
          end: times.end
        };
      })
    );
  };

  const handleSave = () => {
    const slots = scheduleState.map((day) => ({
      day_of_week: Number(day.day_of_week),
      start_time: day.start,
      end_time: day.end
    }));

    onSave(slots);
  };

  return (
    <div className="staff-schedule-overlay" onClick={onClose}>
      <div
        className="staff-schedule-modal-new"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-schedule-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="staff-schedule-header-new">
          <div className="staff-schedule-header-content">
            <p className="staff-schedule-kicker">Lịch làm việc hằng tuần</p>
            <h3 id="staff-schedule-title">{staff?.name || 'Nhân viên'}</h3>
            <p className="staff-schedule-description">
              Chọn ca sáng, ca tối hoặc full ca cho đủ 7 ngày. Nghỉ phép có hiệu lực ngay khi nhân viên đăng ký.
            </p>
          </div>
          <button
            type="button"
            className="staff-schedule-close-new"
            onClick={onClose}
            aria-label="Đóng"
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="staff-schedule-tabs">
          <button
            type="button"
            className={`staff-schedule-tab ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Ngày
          </button>
          <button
            type="button"
            className={`staff-schedule-tab ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Tuần
          </button>
        </div>

        {loading ? (
          <div className="staff-schedule-loading">
            <div className="staff-schedule-spinner"></div>
            <p>Đang tải lịch làm việc...</p>
          </div>
        ) : (
          <>
            {viewMode === 'week' && (
              <div className="staff-schedule-week-view">
                <div className="staff-schedule-week-header">
                  <h4>Lịch làm việc tuần</h4>
                  <p className="staff-schedule-date-range">
                    {currentDate.toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </p>
                </div>

                <div className="staff-schedule-shift-tools">
                  <button type="button" onClick={() => applyShiftToWholeWeek('morning')} disabled={saving}>
                    Ca sáng 
                  </button>
                  <button type="button" onClick={() => applyShiftToWholeWeek('evening')} disabled={saving}>
                    Ca tối 
                  </button>
                  <button type="button" onClick={() => applyShiftToWholeWeek('full')} disabled={saving}>
                    Full ca 
                  </button>
                </div>

                <div className="staff-schedule-days-grid">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const daySchedule = scheduleState.find((item) => Number(item.day_of_week) === index);
                    const currentShift = daySchedule?.shift || 'morning';
                    const times = getTimesFromShift(index, currentShift);

                    return (
                      <div key={index} className="staff-schedule-day-card enabled">
                        <div className="staff-schedule-day-label">{label}</div>
                        <select
                          className="staff-schedule-shift-select"
                          value={currentShift}
                          onChange={(event) => updateDayShift(index, event.target.value)}
                          disabled={saving}
                        >
                          {SHIFT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="staff-schedule-shift-time">
                          {getShiftLabel(currentShift)} · {times.start} - {times.end}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'day' && (
              <div className="staff-schedule-day-view">
                <div className="staff-schedule-day-header">
                  <h4>Chi tiết ngày</h4>
                  <p className="staff-schedule-date-range">
                    {currentDate.toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </p>
                </div>
                <div className="staff-schedule-day-detail">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const daySchedule = scheduleState.find((item) => Number(item.day_of_week) === index);
                    const currentShift = daySchedule?.shift || 'morning';
                    const times = getTimesFromShift(index, currentShift);

                    return (
                      <div key={index} className="staff-schedule-day-item">
                        <div className="staff-schedule-day-name">{label}</div>
                        <select
                          className="staff-schedule-shift-select compact"
                          value={currentShift}
                          onChange={(event) => updateDayShift(index, event.target.value)}
                          disabled={saving}
                        >
                          {SHIFT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="staff-schedule-shift-time compact">
                          {times.start} - {times.end}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="staff-schedule-actions-new">
              <button
                type="button"
                className="btn-schedule-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu lịch'}
              </button>
              <button
                type="button"
                className="btn-schedule-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Hủy
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StaffScheduleModal;
