import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../services/authService';
import bookingService from '../services/bookingService';
import serviceService from '../services/serviceService';
import staffService from '../services/staffService';
import { formatDurationLabel, formatVnd } from '../utils/formatters';
import './Booking.css';

const quickSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '18:00'];

const getStaffRequestError = (err, fallbackMessage) => {
  if (err.response?.status === 401) {
    return 'Phien dang nhap da het han. Vui long dang nhap lai de chon nhan vien.';
  }

  if (err.response?.status === 403) {
    return 'Tai khoan hien tai khong co quyen xem danh sach nhan vien.';
  }

  return fallbackMessage;
};
function Booking() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [allStaff, setAllStaff] = useState([]);
  const [availableStaffIds, setAvailableStaffIds] = useState(() => new Set());
  const [loadingStaffList, setLoadingStaffList] = useState(true);
  const [loadingStaffAvailability, setLoadingStaffAvailability] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchService = async () => {
      try {
        const response = await serviceService.getServiceById(serviceId);
        if (!cancelled) {
          setService(response.data.data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError('Không thể tải thông tin dịch vụ.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchService();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  useEffect(() => {
    let cancelled = false;

    const fetchBookableStaff = async () => {
      if (!authService.getToken()) {
        if (!cancelled) {
          setAllStaff([]);
          setAvailableStaffIds(new Set());
          setStaffError('Vui long dang nhap lai de chon nhan vien phu trach.');
          setLoadingStaffList(false);
        }
        return;
      }

      try {
        setLoadingStaffList(true);
        const response = await staffService.getBookableStaff();
        const nextStaff = response.data.data || [];

        if (!cancelled) {
          setAllStaff(nextStaff);
          setAvailableStaffIds(new Set(nextStaff.map((staff) => String(staff.id))));
          setStaffError('');
        }
      } catch (err) {
        if (!cancelled) {
          setAllStaff([]);
          setAvailableStaffIds(new Set());
          setStaffError(getStaffRequestError(err, 'Khong the tai danh sach nhan vien.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingStaffList(false);
        }
      }
    };

    fetchBookableStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAvailableStaff = async () => {
      if (!appointmentDate || !appointmentTime) {
        setAvailableStaffIds(new Set(allStaff.map((staff) => String(staff.id))));
        return;
      }

      if (allStaff.length === 0) {
        setAvailableStaffIds(new Set());
        return;
      }

      setLoadingStaffAvailability(true);
      setStaffError('');

      try {
        const response = await staffService.getAvailableStaff(
          appointmentDate,
          appointmentTime,
          serviceId
        );
        const nextAvailableIds = new Set(
          (response.data.data || []).map((staff) => String(staff.id))
        );

        if (!cancelled) {
          setAvailableStaffIds(nextAvailableIds);
          setSelectedStaffId((prev) => {
            if (!prev) return '';
            return nextAvailableIds.has(String(prev)) ? prev : '';
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableStaffIds(new Set());
          setSelectedStaffId('');
          setStaffError(getStaffRequestError(err, 'Khong the kiem tra lich trong cua nhan vien theo khung gio nay.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingStaffAvailability(false);
        }
      }
    };

    checkAvailableStaff();
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, appointmentTime, serviceId, allStaff]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const staffOptions = useMemo(() => {
    const shouldCheckAvailability = !!appointmentDate && !!appointmentTime;
    return allStaff.map((staff) => {
      const isAvailable = !shouldCheckAvailability || availableStaffIds.has(String(staff.id));
      return {
        ...staff,
        isAvailable
      };
    });
  }, [allStaff, appointmentDate, appointmentTime, availableStaffIds]);

  const selectedStaffName = useMemo(() => {
    const selected = allStaff.find((staff) => String(staff.id) === String(selectedStaffId));
    return selected ? selected.name : '';
  }, [selectedStaffId, allStaff]);

  const availableStaffCount = useMemo(
    () => staffOptions.filter((staff) => staff.isAvailable).length,
    [staffOptions]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!appointmentDate || !appointmentTime || !selectedStaffId) {
      setError('Vui lòng chọn ngày, giờ và nhân viên trước khi đặt lịch.');
      return;
    }

    const selectedOption = staffOptions.find(
      (staff) => String(staff.id) === String(selectedStaffId)
    );
    if (!selectedOption || !selectedOption.isAvailable) {
      setError('Nhân viên đã bận ở khung giờ này, vui lòng chọn nhân viên khác.');
      return;
    }

    setSubmitting(true);

    try {
      await bookingService.createBooking(
        serviceId,
        Number(selectedStaffId),
        appointmentDate,
        appointmentTime,
        notes
      );
      setSuccess('Đặt lịch thành công! Đang chuyển đến danh sách lịch của bạn...');
      setTimeout(() => navigate('/my-appointments'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lịch thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải thông tin đặt lịch...</div>;
  }

  if (!service) {
    return <div className="alert alert-error">{error || 'Không tìm thấy dịch vụ.'}</div>;
  }

  const price = Number(service.price) || 0;
  const duration = Number(service.duration) || 0;

  return (
    <div className="booking-page">
      <form className="booking-layout" onSubmit={handleSubmit}>
        <section className="booking-panel">
          <h1>Đặt lịch nhanh</h1>
          <p className="subtitle">Chọn ngày, giờ và nhân viên trong một lần đặt lịch.</p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label>Ngày hẹn</label>
            <input
              type="date"
              value={appointmentDate}
              onChange={(event) => setAppointmentDate(event.target.value)}
              min={today}
              required
            />
          </div>

          <div className="form-group">
            <label>Khung giờ phổ biến</label>
            <div className="slot-grid">
              {quickSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={appointmentTime === slot ? 'slot-btn active' : 'slot-btn'}
                  onClick={() => setAppointmentTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Hoặc chọn giờ cụ thể</label>
            <input
              type="time"
              value={appointmentTime}
              onChange={(event) => setAppointmentTime(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Nhân viên phụ trách</label>
            <select
              value={selectedStaffId}
              onChange={(event) => setSelectedStaffId(event.target.value)}
              disabled={loadingStaffList || allStaff.length === 0}
              required
            >
              <option value="">
                {loadingStaffList
                  ? 'Đang tải danh sách nhân viên...'
                  : allStaff.length === 0
                    ? 'Chưa có nhân viên hoạt động'
                    : loadingStaffAvailability
                      ? 'Đang kiểm tra lịch trống...'
                      : availableStaffCount === 0
                        ? 'Không còn nhân viên trống trong giờ này'
                        : 'Chọn nhân viên'}
              </option>
              {staffOptions.map((staff) => (
                <option
                  key={staff.id}
                  value={staff.id}
                  disabled={!!appointmentDate && !!appointmentTime && !staff.isAvailable}
                >
                  {staff.name}
                  {!!appointmentDate && !!appointmentTime && !staff.isAvailable ? ' - Đang bận' : ''}
                </option>
              ))}
            </select>
            {staffError && <small className="field-error">{staffError}</small>}
            {!staffError && allStaff.length > 0 && !appointmentDate && !appointmentTime && (
              <small className="field-hint">Chọn ngày và giờ để hệ thống lọc nhân viên đang trống.</small>
            )}
            {!staffError && !!appointmentDate && !!appointmentTime && !loadingStaffAvailability && (
              <small className="field-hint">
                Có {availableStaffCount}/{allStaff.length} nhân viên đang trống ở khung giờ này.
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Ghi chú cho nhân viên (tùy chọn)</label>
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: ưu tiên sau 18h, cần liên hệ trước..."
            />
          </div>
        </section>

        <aside className="booking-summary">
          <h2>{service.name}</h2>

          <div className="summary-row">
            <span>Giá dịch vụ</span>
            <strong>{formatVnd(price)}</strong>
          </div>

          <div className="summary-row">
            <span>Thời lượng dự kiến</span>
            <strong>{formatDurationLabel(duration)}</strong>
          </div>

          <div className="summary-row">
            <span>Ngày đã chọn</span>
            <strong>{appointmentDate || 'Chưa chọn'}</strong>
          </div>

          <div className="summary-row">
            <span>Giờ đã chọn</span>
            <strong>{appointmentTime || 'Chưa chọn'}</strong>
          </div>

          <div className="summary-row">
            <span>Nhân viên</span>
            <strong>{selectedStaffName || 'Chưa chọn'}</strong>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
          </button>
        </aside>
      </form>
    </div>
  );
}

export default Booking;





