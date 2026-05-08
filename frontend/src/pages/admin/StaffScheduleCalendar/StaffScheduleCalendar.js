import React, { useEffect, useMemo, useState, useCallback } from 'react';
import bookingService from '../../../services/bookingService';
import staffService from '../../../services/staffService';
import { exportToExcel } from '../../../utils/exportExcel';
import { startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import './StaffScheduleCalendar.css';

// =============================================================================
// Helpers
// =============================================================================

const HOUR_HEIGHT = 72; // px per hour
const START_HOUR = 0;
const END_HOUR = 23;

const STAFF_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
  { bg: '#fce4ec', border: '#ef5350', text: '#b71c1c' },
  { bg: '#e0f2f1', border: '#26a69a', text: '#004d40' },
  { bg: '#f3e5f5', border: '#ab47bc', text: '#4a148c' },
  { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
  { bg: '#e8f5e9', border: '#66bb6a', text: '#1b5e20' }
];

const formatDateISO = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateDisplay = (date, viewMode) => {
  const d = new Date(date);
  if (viewMode === 'day') {
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return `${dayNames[d.getDay()]}, ${d.getDate()} Tháng ${d.getMonth() + 1}`;
  }
  if (viewMode === 'week') {
    const s = startOfWeek(d, { weekStartsOn: 1 });
    const e = endOfWeek(d, { weekStartsOn: 1 });
    return `${s.getDate()}/${s.getMonth() + 1} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
  }
  if (viewMode === 'month') {
    return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  }
  if (viewMode === 'year') {
    return `Năm ${d.getFullYear()}`;
  }
  return formatDateISO(date);
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
};

const getStatusInfo = (status) => {
  const map = {
    pending: { label: 'Chờ XN', cls: 'pending' },
    confirmed: { label: 'Đã XN', cls: 'confirmed' },
    completed: { label: 'Xong', cls: 'completed' },
    cancelled: { label: 'Hủy', cls: 'cancelled' }
  };
  return map[status] || { label: status, cls: 'default' };
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

// =============================================================================
// Sub-Components
// =============================================================================

const StaffAvatar = ({ staff, color, isActive, onClick }) => (
  <button
    className={`sc-staff-avatar ${isActive ? 'active' : ''}`}
    onClick={onClick}
    title={staff.name}
    style={isActive ? { borderColor: color.border } : {}}
  >
    {staff.avatar_url ? (
      <img src={staff.avatar_url} alt={staff.name} className="sc-avatar-img" />
    ) : (
      <div className="sc-avatar-placeholder" style={{ background: color.bg, color: color.text }}>
        {getInitials(staff.name)}
      </div>
    )}
    <span className="sc-avatar-name">{staff.name?.split(' ').pop()}</span>
    {isActive && <span className="sc-avatar-active-dot" style={{ background: color.border }} />}
  </button>
);

const AppointmentBlock = ({ appointment, color, onClick }) => {
  const startMinutes = parseTimeToMinutes(appointment.appointment_time);
  const duration = Number(appointment.total_duration || appointment.duration || 60);
  const topPx = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const heightPx = Math.max((duration / 60) * HOUR_HEIGHT - 4, 28);
  const statusInfo = getStatusInfo(appointment.status);

  const startH = Math.floor(startMinutes / 60);
  const startM = startMinutes % 60;
  const endMinutes = startMinutes + duration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const timeLabel = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  return (
    <div
      className={`sc-appointment-block sc-status-${statusInfo.cls}`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        color: color.text
      }}
      onClick={() => onClick(appointment)}
      title={`${appointment.customer_name} - ${appointment.service_name}`}
    >
      <div className="sc-appt-time">{timeLabel}</div>
      <div className="sc-appt-customer">{appointment.customer_name}</div>
      <div className="sc-appt-service">{appointment.service_name}</div>
      {heightPx > 56 && (
        <div className="sc-appt-duration">{duration} phút</div>
      )}
    </div>
  );
};

const TimeGrid = () => {
  const hours = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hours.push(h);
  }

  return (
    <div className="sc-time-labels">
      {hours.map((h) => (
        <div key={h} className="sc-time-label" style={{ height: `${HOUR_HEIGHT}px` }}>
          <span>{`${h}:00`}</span>
        </div>
      ))}
    </div>
  );
};

const NowIndicator = () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes < START_HOUR * 60 || currentMinutes > END_HOUR * 60) return null;

  const topPx = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="sc-now-indicator" style={{ top: `${topPx}px` }}>
      <span className="sc-now-dot" />
      <span className="sc-now-line" />
      <span className="sc-now-time">
        {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
      </span>
    </div>
  );
};

const AppointmentDetailModal = ({ appointment, onClose, onStatusChange, processing }) => {
  if (!appointment) return null;

  const statusInfo = getStatusInfo(appointment.status);

  return (
    <div className="sc-modal-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal-header">
          <h3>Chi tiết lịch hẹn #{appointment.id}</h3>
          <button className="sc-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sc-modal-body">
          <div className="sc-detail-row">
            <span className="sc-detail-label">Khách hàng</span>
            <strong>{appointment.customer_name || '-'}</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Dịch vụ</span>
            <strong>{appointment.service_name || '-'}</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Nhân viên</span>
            <strong>{appointment.staff_name || '-'}</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Ngày</span>
            <strong>{appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString('vi-VN') : '-'}</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Giờ</span>
            <strong>{appointment.appointment_time || '-'}</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Tổng tiền</span>
            <strong>{Number(appointment.total_amount || 0).toLocaleString('vi-VN')} VNĐ</strong>
          </div>
          <div className="sc-detail-row">
            <span className="sc-detail-label">Trạng thái</span>
            <span className={`sc-status-pill sc-pill-${statusInfo.cls}`}>{statusInfo.label}</span>
          </div>
        </div>
        <div className="sc-modal-actions">
          {appointment.status === 'pending' && (
            <button
              className="sc-btn sc-btn-confirm"
              onClick={() => onStatusChange(appointment.id, 'confirmed')}
              disabled={processing}
            >
              {processing ? 'Đang xử lý...' : '✓ Xác nhận'}
            </button>
          )}
          {appointment.status === 'confirmed' && (
            <button
              className="sc-btn sc-btn-complete"
              onClick={() => onStatusChange(appointment.id, 'completed')}
              disabled={processing}
            >
              {processing ? 'Đang xử lý...' : '✓ Hoàn thành'}
            </button>
          )}
          {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
            <button
              className="sc-btn sc-btn-cancel"
              onClick={() => onStatusChange(appointment.id, 'cancelled')}
              disabled={processing}
            >
              {processing ? 'Đang xử lý...' : '✗ Hủy'}
            </button>
          )}
          <button className="sc-btn sc-btn-close" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

function StaffScheduleCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date(Math.max(Date.now(), new Date('2026-01-01').getTime())));
  const [viewMode, setViewMode] = useState('day');
  const [allAppointments, setAllAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStaffIds, setActiveStaffIds] = useState(new Set());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [processing, setProcessing] = useState(false);

  const dateISO = useMemo(() => formatDateISO(selectedDate), [selectedDate]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [appointmentsRes, staffRes] = await Promise.all([
        bookingService.getAllBookings(),
        staffService.getBookableStaff()
      ]);

      setAllAppointments(appointmentsRes.data.data || []);

      const staff = staffRes.data.data || [];
      setStaffList(staff);

      // Select all staff by default
      setActiveStaffIds(new Set(staff.map(s => s.id)));
    } catch (err) {
      console.error('[SCHEDULE_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filter appointments for selected period ──
  const periodAppointments = useMemo(() => {
    return allAppointments.filter((a) => {
      if (!a.appointment_date) return false;
      if (a.status === 'cancelled') return false;
      
      const aDate = new Date(a.appointment_date);
      
      if (viewMode === 'day') {
        return formatDateISO(aDate) === dateISO;
      } else if (viewMode === 'week') {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return isWithinInterval(aDate, { start, end });
      } else if (viewMode === 'month') {
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        return isWithinInterval(aDate, { start, end });
      } else if (viewMode === 'year') {
        const start = startOfYear(selectedDate);
        const end = endOfYear(selectedDate);
        return isWithinInterval(aDate, { start, end });
      }
      return false;
    });
  }, [allAppointments, dateISO, viewMode, selectedDate]);

  // ── Group appointments by staff (for Day view) ──
  const appointmentsByStaff = useMemo(() => {
    const map = {};
    staffList.forEach((s) => {
      map[s.id] = [];
    });
    periodAppointments.forEach((a) => {
      if (a.staff_id && map[a.staff_id]) {
        map[a.staff_id].push(a);
      }
    });
    return map;
  }, [periodAppointments, staffList]);

  // ── Staff color map ──
  const staffColorMap = useMemo(() => {
    const map = {};
    staffList.forEach((s, i) => {
      map[s.id] = STAFF_COLORS[i % STAFF_COLORS.length];
    });
    return map;
  }, [staffList]);

  // ── Visible staff (filtered) ──
  const visibleStaff = useMemo(() => {
    return staffList.filter(s => activeStaffIds.has(s.id));
  }, [staffList, activeStaffIds]);

  // ── Stats ──
  const stats = useMemo(() => ({
    totalPeriod: periodAppointments.length,
    pending: periodAppointments.filter(a => a.status === 'pending').length,
    confirmed: periodAppointments.filter(a => a.status === 'confirmed').length,
    completed: periodAppointments.filter(a => a.status === 'completed').length,
    staffCount: visibleStaff.length
  }), [periodAppointments, visibleStaff]);

  // ── Navigation ──
  const goToday = () => {
    const today = new Date();
    setSelectedDate(today >= new Date('2026-01-01') ? today : new Date('2026-01-01'));
  };
  
  const goPrev = () => setSelectedDate(d => { 
    const n = new Date(d); 
    if (viewMode === 'day') n.setDate(n.getDate() - 1); 
    else if (viewMode === 'week') n.setDate(n.getDate() - 7);
    else if (viewMode === 'month') n.setMonth(n.getMonth() - 1);
    else if (viewMode === 'year') n.setFullYear(n.getFullYear() - 1);
    
    // Check min date
    if (n < new Date('2026-01-01')) return new Date('2026-01-01');
    return n; 
  });
  
  const goNext = () => setSelectedDate(d => { 
    const n = new Date(d); 
    if (viewMode === 'day') n.setDate(n.getDate() + 1); 
    else if (viewMode === 'week') n.setDate(n.getDate() + 7);
    else if (viewMode === 'month') n.setMonth(n.getMonth() + 1);
    else if (viewMode === 'year') n.setFullYear(n.getFullYear() + 1);
    return n; 
  });

  const toggleStaff = (staffId) => {
    setActiveStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        if (next.size > 1) next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  const selectAllStaff = () => {
    setActiveStaffIds(new Set(staffList.map(s => s.id)));
  };

  // ── Status change ──
  const handleStatusChange = async (id, status) => {
    try {
      setProcessing(true);
      await bookingService.updateBookingStatus(id, status);
      await fetchData();
      setSelectedAppointment(null);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setProcessing(false);
    }
  };
  
  // ── Export Excel ──
  const handleExportExcel = () => {
    const exportData = periodAppointments.filter(a => !a.staff_id || activeStaffIds.has(a.staff_id));
    
    exportToExcel({
      fileName: `lich-lam-viec_${viewMode}_${formatDateISO(selectedDate)}`,
      sheets: [
        {
          name: 'Lịch làm việc',
          columns: [
            { key: 'id', header: 'ID', width: 8 },
            { key: 'appointment_date', header: 'Ngày hẹn', width: 14, transform: (v) => v ? new Date(v).toLocaleDateString('vi-VN') : '' },
            { key: 'appointment_time', header: 'Giờ hẹn', width: 10 },
            { key: 'staff_name', header: 'Nhân viên', width: 20 },
            { key: 'customer_name', header: 'Khách hàng', width: 22 },
            { key: 'customer_phone', header: 'SĐT', width: 14 },
            { key: 'service_name', header: 'Dịch vụ', width: 28 },
            { key: 'status', header: 'Trạng thái', width: 16, transform: (v) => getStatusInfo(v).label },
            { key: 'total_amount', header: 'Tổng tiền (VNĐ)', width: 18, transform: (v) => Number(v || 0) }
          ],
          rows: exportData
        }
      ]
    });
  };

  const isToday = formatDateISO(new Date(Math.max(Date.now(), new Date('2026-01-01').getTime()))) === dateISO;

  // ── Render ──
  if (loading) {
    return (
      <div className="sc-loading">
        <div className="sc-loading-spinner" />
        <p>Đang tải lịch làm việc...</p>
      </div>
    );
  }

  return (
    <div className="staff-schedule-calendar">
      {/* ── Toolbar ── */}
      <div className="sc-toolbar">
        <div className="sc-toolbar-left">
          <div className="sc-view-modes">
            <button className={`sc-mode-btn ${viewMode === 'day' ? 'active' : ''}`} onClick={() => setViewMode('day')}>Ngày</button>
            <button className={`sc-mode-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Tuần</button>
            <button className={`sc-mode-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Tháng</button>
            <button className={`sc-mode-btn ${viewMode === 'year' ? 'active' : ''}`} onClick={() => setViewMode('year')}>Năm</button>
          </div>
          
          <button className={`sc-btn-today ${isToday && viewMode === 'day' ? 'active' : ''}`} onClick={goToday}>
            Hôm nay
          </button>
          
          <div className="sc-date-nav">
            <button className="sc-nav-btn" onClick={goPrev} aria-label="Trước">‹</button>
            <span className="sc-date-label">{formatDateDisplay(selectedDate, viewMode)}</span>
            <button className="sc-nav-btn" onClick={goNext} aria-label="Sau">›</button>
          </div>
          
          <input
            type="date"
            className="sc-date-picker"
            value={dateISO}
            min="2026-01-01"
            onChange={(e) => {
              if (e.target.value) {
                const newDate = new Date(e.target.value + 'T00:00:00');
                if (newDate >= new Date('2026-01-01')) {
                  setSelectedDate(newDate);
                }
              }
            }}
          />
        </div>
        
        <div className="sc-toolbar-right">
          <div className="sc-stats-mini">
            <span className="sc-stat-item">📅 <strong>{stats.totalPeriod}</strong> lịch</span>
            <span className="sc-stat-item sc-stat-pending">⏳ <strong>{stats.pending}</strong></span>
            <span className="sc-stat-item sc-stat-confirmed">✓ <strong>{stats.confirmed}</strong></span>
            <span className="sc-stat-item sc-stat-completed">✅ <strong>{stats.completed}</strong></span>
          </div>
          <button className="sc-btn-all-staff" onClick={selectAllStaff}>
            Tất cả ({staffList.length})
          </button>
          <button className="sc-btn-export" onClick={handleExportExcel}>
            📥 Xuất Excel
          </button>
        </div>
      </div>

      {/* ── Staff Avatars Row ── */}
      <div className="sc-staff-row">
        {viewMode === 'day' && <div className="sc-staff-row-time" />}
        {visibleStaff.map((staff) => (
          <StaffAvatar
            key={staff.id}
            staff={staff}
            color={staffColorMap[staff.id]}
            isActive={activeStaffIds.has(staff.id)}
            onClick={() => toggleStaff(staff.id)}
          />
        ))}
        {staffList.filter(s => !activeStaffIds.has(s.id)).length > 0 && (
          <div className="sc-hidden-staff">
            {staffList.filter(s => !activeStaffIds.has(s.id)).map((staff) => (
              <StaffAvatar
                key={staff.id}
                staff={staff}
                color={staffColorMap[staff.id]}
                isActive={false}
                onClick={() => toggleStaff(staff.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Content Area ── */}
      {viewMode === 'day' ? (
        <div className="sc-grid-container">
          <TimeGrid />

          <div className="sc-columns-wrapper">
            {visibleStaff.map((staff) => {
              const color = staffColorMap[staff.id];
              const staffAppts = appointmentsByStaff[staff.id] || [];

              return (
                <div key={staff.id} className="sc-staff-column">
                  {/* Hour grid lines */}
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
                    <div key={i} className="sc-hour-cell" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Appointments */}
                  {staffAppts.map((appt) => (
                    <AppointmentBlock
                      key={appt.id}
                      appointment={appt}
                      color={color}
                      onClick={setSelectedAppointment}
                    />
                  ))}

                  {/* Now indicator */}
                  {isToday && <NowIndicator />}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Table View for Week/Month/Year ── */
        <div className="sc-table-container">
          {periodAppointments.filter(a => !a.staff_id || activeStaffIds.has(a.staff_id)).length > 0 ? (
            <table className="sc-list-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Nhân viên</th>
                  <th>Khách hàng</th>
                  <th>Dịch vụ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {periodAppointments
                  .filter(a => !a.staff_id || activeStaffIds.has(a.staff_id))
                  .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date) || a.appointment_time.localeCompare(b.appointment_time))
                  .map(appt => (
                    <tr key={appt.id}>
                      <td>{new Date(appt.appointment_date).toLocaleDateString('vi-VN')}</td>
                      <td>{appt.appointment_time}</td>
                      <td>
                        <span className="sc-table-staff-tag" style={{
                          background: staffColorMap[appt.staff_id]?.bg || '#f1f5f9',
                          color: staffColorMap[appt.staff_id]?.text || '#475569',
                          border: `1px solid ${staffColorMap[appt.staff_id]?.border || '#cbd5e1'}`
                        }}>
                          {appt.staff_name || 'Trống'}
                        </span>
                      </td>
                      <td>{appt.customer_name}</td>
                      <td>{appt.service_name}</td>
                      <td>
                        <span className={`sc-status-pill sc-pill-${getStatusInfo(appt.status).cls}`}>
                          {getStatusInfo(appt.status).label}
                        </span>
                      </td>
                      <td>
                        <button className="sc-btn-small" onClick={() => setSelectedAppointment(appt)}>Chi tiết</button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="sc-empty">
              <span className="sc-empty-icon">📅</span>
              <p>Không có lịch hẹn nào trong khoảng thời gian này.</p>
            </div>
          )}
        </div>
      )}

      {/* ── No appointments message for Day View ── */}
      {viewMode === 'day' && periodAppointments.length === 0 && (
        <div className="sc-empty">
          <span className="sc-empty-icon">📅</span>
          <p>Không có lịch hẹn nào vào ngày <strong>{formatDateDisplay(selectedDate, 'day')}</strong></p>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onStatusChange={handleStatusChange}
        processing={processing}
      />
    </div>
  );
}

export default StaffScheduleCalendar;
