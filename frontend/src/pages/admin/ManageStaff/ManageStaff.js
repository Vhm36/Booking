import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import staffService from '../../../services/staffService';
import authService from '../../../services/authService';
import * as XLSX from 'xlsx';
import StaffScheduleModal from './StaffScheduleModal';
import './ManageStaff.css';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const SHIFT_LABELS = {
  morning: 'Ca sáng',
  evening: 'Ca tối',
  full: 'Full ca'
};

const getShiftFromTimes = (startTime, endTime) => {
  const start = String(startTime || '08:00').slice(0, 5);
  const end = String(endTime || '16:00').slice(0, 5);
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if ((start === '08:00' && end === '21:30') || (start === '07:00' && end === '23:00')) return 'full';
  if (endMinutes - startMinutes > 8 * 60) return 'full';

  return startHour < 12 ? 'morning' : 'evening';
};

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

const STAFF_LIST_PAGE_SIZE = 8;

const buildWeekFromRows = (rows = []) =>
  WEEKDAY_LABELS.map((label, dayIndex) => {
    const row = rows.find((item) => Number(item.day_of_week) === dayIndex);
    if (!row) {
      return {
        day_of_week: dayIndex,
        label,
        enabled: true,
        shift: 'morning',
        start: dayIndex <= 4 ? '08:00' : '07:00',
        end: dayIndex <= 4 ? '16:00' : '15:00'
      };
    }

    return {
      day_of_week: dayIndex,
      label,
      enabled: true,
      shift: getShiftFromTimes(row.start_time, row.end_time),
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

const getStaffRoleName = (staffOrRole = '') =>
  typeof staffOrRole === 'object' && staffOrRole !== null ? staffOrRole.role_name || '' : staffOrRole;

const getStaffSystemRole = (staffOrRole = '') =>
  typeof staffOrRole === 'object' && staffOrRole !== null ? staffOrRole.role || '' : '';

const getNormalizedStaffRole = (staffOrRole = '') =>
  normalizeSearchText(getStaffRoleName(staffOrRole));

const isAdminUser = (staffOrRole = '') => {
  const normalizedSystemRole = normalizeSearchText(getStaffSystemRole(staffOrRole));
  const normalizedRoleName = getNormalizedStaffRole(staffOrRole);
  return (
    normalizedSystemRole === 'admin' ||
    normalizedRoleName.includes('admin') ||
    normalizedRoleName.includes('quan tri')
  );
};

const getStaffCodePrefix = (staffOrRole) => {
  if (isAdminUser(staffOrRole)) return 'QL';
  if (isCashierRole(staffOrRole)) return 'TN';
  return 'NV';
};

const formatStaffCode = (staffOrId) => {
  const id = typeof staffOrId === 'object' && staffOrId !== null ? staffOrId.id : staffOrId;
  return `${getStaffCodePrefix(staffOrId)}${String(id || 0).padStart(3, '0')}`;
};

const generateNextStaffCode = (staffList, roleId, staffRoles) => {
  const role = staffRoles.find(r => String(r.id) === String(roleId));
  const roleName = role?.role_name || '';
  let prefix = 'NV';
  if (normalizeSearchText(roleName).includes('admin') || normalizeSearchText(roleName).includes('quan')) prefix = 'QL';
  else if (normalizeSearchText(roleName).includes('thu ngan')) prefix = 'TN';

  const samePrefix = staffList
    .filter(s => getStaffCodePrefix(s) === prefix)
    .length;
  return `${prefix}${String(samePrefix + 1).padStart(3, '0')}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('vi-VN');
};

const getRoleText = (staffOrRole = '') => {
  if (isAdminUser(staffOrRole)) return 'Quản lý';
  const roleName = getStaffRoleName(staffOrRole);
  if (normalizeSearchText(roleName).includes('ky thuat') || normalizeSearchText(roleName).includes('nhan vien')) return 'Nhân viên';
  return roleName || 'Nhân viên';
};

const getDepartmentText = (staffOrRole = '') => {
  if (isAdminUser(staffOrRole)) return 'Quản lý';
  const normalized = getNormalizedStaffRole(staffOrRole);
  if (normalized.includes('thu ngan')) return 'Thu ngân';
  // if (normalized.includes('quan ly')) return 'Quản lý';
  if (normalized.includes('ke toan')) return 'Kế toán';
  return 'Nhân viên';
};

const getShiftText = (staffOrRole = '') => {
  if (isAdminUser(staffOrRole)) return 'Điều hành';
  const normalized = getNormalizedStaffRole(staffOrRole);
  if (normalized.includes('thu ngan') || normalized.includes('quan') || normalized.includes('ke toan')) {
    return 'Ca hành chính';
  }
  return 'Theo lịch';
};

const isCashierRole = (staffOrRole = '') => getNormalizedStaffRole(staffOrRole).includes('thu ngan');

const isServiceRole = (staffOrRole = '') => {
  const normalized = getNormalizedStaffRole(staffOrRole);
  return !isAdminUser(staffOrRole) && !normalized.includes('thu ngan');
};

const isTechnicalRole = (roleName = '') => normalizeSearchText(roleName).includes('ky thuat');

const formatWeeklyScheduleSummary = (rows = [], fallback = 'Chưa đăng ký') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return fallback;
  }

  const enabledRows = rows
    .filter((row) => typeof row.day_of_week !== 'undefined')
    .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week));

  if (enabledRows.length === 0) {
    return fallback;
  }

  const shifts = [...new Set(
    enabledRows.map((row) => {
      const shift = getShiftFromTimes(row.start_time, row.end_time);
      return SHIFT_LABELS[shift];
    })
  )];

  return shifts.join(', ');
};

const getPrimaryShiftFromRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 'unregistered';
  }

  const counts = rows.reduce(
    (acc, row) => {
      if (typeof row.day_of_week === 'undefined') return acc;
      const shift = getShiftFromTimes(row.start_time, row.end_time);
      acc[shift] = (acc[shift] || 0) + 1;
      return acc;
    },
    { morning: 0, evening: 0, full: 0 }
  );

  if (counts.full >= counts.morning && counts.full >= counts.evening && counts.full > 0) return 'full';
  if (counts.evening > counts.morning) return 'evening';
  if (counts.morning > 0) return 'morning';
  return 'unregistered';
};

const StaffActionIcon = ({ name }) => {
  const icons = {
    edit: (
      <>
        <path d="M5 19l3.5-.8L18 8.7 15.3 6 5.8 15.5 5 19z" />
        <path d="M14.5 6.8l2.7 2.7" />
      </>
    ),
    schedule: (
      <>
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4 8h16" />
        <path d="M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    unlock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M9 10V7a4 4 0 0 1 7.4-2" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="M8 8l4-4 4 4" />
        <path d="M5 20h14" />
      </>
    ),
    add: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    file: (
      <>
        <path d="M7 4h7l4 4v12H7z" />
        <path d="M14 4v5h5" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </>
    )
  };

  return (
    <svg className="staff-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] || icons.edit}
    </svg>
  );
};

function ManageStaff() {
  const navigate = useNavigate();
  const currentUser = authService.getUser();
  const [staffList, setStaffList] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [staffPage, setStaffPage] = useState(1);
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [selectedAvailabilityLoading, setSelectedAvailabilityLoading] = useState(false);
  const [weeklyAvailabilityByStaff, setWeeklyAvailabilityByStaff] = useState({});
  const [weeklyAvailabilityLoading, setWeeklyAvailabilityLoading] = useState(false);
  
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    staff_code: '',
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
      const assignableRoles = nextRoles.filter((role) => !isTechnicalRole(role.role_name));
      setStaffRoles(nextRoles);
      setFormData((prev) => {
        if (prev.staff_role_id || assignableRoles.length === 0) {
          return prev;
        }

        return {
          ...prev,
          staff_role_id: String(assignableRoles[0].id)
        };
      });
    } catch (err) {
      setStaffRoles([]);
    }
  };

  const visibleStaffRoles = useMemo(
    () => staffRoles.filter((role) => !isTechnicalRole(role.role_name)),
    [staffRoles]
  );

  const uniqueDepartmentRoles = useMemo(() => {
    const hardcodedDepts = new Set(['Quản lý', 'Nhân viên', 'Thu ngân']);
    return visibleStaffRoles.filter((role) => {
      const roleText = getRoleText(role.role_name);
      return !hardcodedDepts.has(roleText);
    });
  }, [visibleStaffRoles]);

  const staffShiftById = useMemo(() => {
    const map = {};
    staffList.forEach((staff) => {
      map[staff.id] = isAdminUser(staff)
        ? 'admin'
        : getPrimaryShiftFromRows(weeklyAvailabilityByStaff[staff.id] || []);
    });
    return map;
  }, [staffList, weeklyAvailabilityByStaff]);

  const filteredStaffList = useMemo(() => {
    let list = staffList;

    if (roleFilter === 'admin') {
      list = list.filter((staff) => isAdminUser(staff));
    } else if (roleFilter === 'cashier') {
      list = list.filter((staff) => isCashierRole(staff));
    } else if (roleFilter === 'service') {
      list = list.filter((staff) => isServiceRole(staff));
    } else if (roleFilter !== 'all') {
      list = list.filter((staff) => String(staff.staff_role_id || '') === roleFilter);
    }

    if (statusFilter === 'active') {
      list = list.filter((staff) => staff.is_active);
    } else if (statusFilter === 'inactive') {
      list = list.filter((staff) => !staff.is_active);
    }

    if (shiftFilter !== 'all') {
      list = list.filter((staff) => staffShiftById[staff.id] === shiftFilter);
    } else {
      const shiftOrder = { morning: 0, evening: 1, unregistered: 2, full: 3, admin: 4 };
      list = [...list].sort((a, b) => {
        const shiftA = staffShiftById[a.id] || 'unregistered';
        const shiftB = staffShiftById[b.id] || 'unregistered';
        const byShift = (shiftOrder[shiftA] ?? 9) - (shiftOrder[shiftB] ?? 9);
        if (byShift !== 0) return byShift;
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
      });
    }

    const normalizedKeyword = normalizeSearchText(tableSearch);

    if (!normalizedKeyword) {
      return list;
    }

    return list.filter((staff) => {
      const searchBlob = normalizeSearchText(
        `${staff.id} ${staff.name || ''} ${staff.email || ''} ${staff.phone || ''} ${staff.role || ''} ${staff.role_name || ''}`
      );
      return searchBlob.includes(normalizedKeyword);
    });
  }, [staffList, tableSearch, roleFilter, statusFilter, shiftFilter, staffShiftById]);

  const staffStats = useMemo(() => {
    const totalCount = staffList.length;
    const adminCount = staffList.filter((staff) => isAdminUser(staff)).length;
    const activeCount = staffList.filter((staff) => staff.is_active).length;
    const departmentCount = new Set(staffList.map((staff) => getDepartmentText(staff))).size;
    const totalAppointments = staffList.reduce((sum, staff) => sum + Number(staff.total_appointments || 0), 0);

    const ratedStaff = staffList.filter((staff) => isServiceRole(staff) && Number(staff.review_count || 0) > 0);
    const avgRatingVal = ratedStaff.length > 0
      ? ratedStaff.reduce((sum, staff) => sum + Number(staff.avg_rating || 0), 0) / ratedStaff.length
      : 0;
    const avgRatingStr = avgRatingVal > 0 ? `${avgRatingVal.toFixed(1)} ⭐` : 'Chưa có';

    const totalMinutes = staffList.filter((staff) => isServiceRole(staff)).reduce((sum, staff) => sum + Number(staff.monthly_minutes || 0), 0);
    const totalHours = Math.round(totalMinutes / 60);

    return [
      { key: 'total', label: 'Tổng nhân sự', value: totalCount.toLocaleString('vi-VN') },
      { key: 'manager', label: 'Quản lý', value: adminCount.toLocaleString('vi-VN') },
      { key: 'active', label: 'Đang làm', value: activeCount.toLocaleString('vi-VN') },
      { key: 'department', label: 'Bộ phận', value: departmentCount.toLocaleString('vi-VN') },
      { key: 'working_hours', label: 'Tổng giờ làm / tháng', value: `${totalHours.toLocaleString('vi-VN')} giờ` },
      { key: 'avg_rating', label: 'Đánh giá trung bình', value: avgRatingStr },
      { key: 'appointments', label: 'Lịch đã nhận', value: totalAppointments.toLocaleString('vi-VN') }
    ];
  }, [staffList]);

  const selectedStaff = useMemo(
    () => filteredStaffList.find((staff) => String(staff.id) === String(selectedStaffId)) || null,
    [filteredStaffList, selectedStaffId]
  );

  const staffPageCount = Math.max(1, Math.ceil(filteredStaffList.length / STAFF_LIST_PAGE_SIZE));
  const paginatedStaffList = useMemo(() => {
    const start = (staffPage - 1) * STAFF_LIST_PAGE_SIZE;
    return filteredStaffList.slice(start, start + STAFF_LIST_PAGE_SIZE);
  }, [filteredStaffList, staffPage]);

  useEffect(() => {
    setStaffPage(1);
  }, [tableSearch, roleFilter, statusFilter, shiftFilter]);

  useEffect(() => {
    setStaffPage((currentPage) => Math.min(currentPage, staffPageCount));
  }, [staffPageCount]);

  useEffect(() => {
    const hasSelectedStaff = filteredStaffList.some(
      (staff) => String(staff.id) === String(selectedStaffId)
    );

    if (filteredStaffList.length > 0 && !hasSelectedStaff) {
      setSelectedStaffId(filteredStaffList[0].id);
    } else if (filteredStaffList.length === 0 && selectedStaffId !== null) {
      setSelectedStaffId(null);
    }
  }, [filteredStaffList, selectedStaffId]);

  useEffect(() => {
    if (paginatedStaffList.length === 0) {
      return;
    }

    const selectedOnPage = paginatedStaffList.some(
      (staff) => String(staff.id) === String(selectedStaffId)
    );

    if (!selectedOnPage) {
      setSelectedStaffId(paginatedStaffList[0].id);
    }
  }, [paginatedStaffList, selectedStaffId]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedStaff) {
      setSelectedAvailability([]);
      setSelectedAvailabilityLoading(false);
      return undefined;
    }

    setSelectedAvailabilityLoading(true);
    staffService
      .getStaffWeeklyAvailability(selectedStaff.id)
      .then((response) => {
        if (!cancelled) {
          setSelectedAvailability(response.data?.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedAvailability([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSelectedAvailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStaff]);

  useEffect(() => {
    let cancelled = false;
    const activeStaff = staffList.filter((staff) => staff.is_active && !isAdminUser(staff));

    if (activeStaff.length === 0) {
      setWeeklyAvailabilityByStaff({});
      setWeeklyAvailabilityLoading(false);
      return undefined;
    }

    setWeeklyAvailabilityLoading(true);
    Promise.all(
      activeStaff.map((staff) =>
        staffService
          .getStaffWeeklyAvailability(staff.id)
          .then((response) => [staff.id, response.data?.data || []])
          .catch(() => [staff.id, []])
      )
    )
      .then((entries) => {
        if (!cancelled) {
          setWeeklyAvailabilityByStaff(Object.fromEntries(entries));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWeeklyAvailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [staffList]);

  const updateEditField = (field, value) => {
    setEditFeedback(emptyFeedback);
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!showForm) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowForm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

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
        staff_role_id: visibleStaffRoles[0] ? String(visibleStaffRoles[0].id) : ''
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

  const handleExportExcel = () => {
    const rows = filteredStaffList.map((staff) => ({
      'Mã nhân sự': formatStaffCode(staff),
      'Họ tên': staff.name || '',
      Email: staff.email || '',
      'SĐT': staff.phone || '',
      'Loại tài khoản': isAdminUser(staff) ? 'Quản lý' : 'Nhân viên',
      'Bộ phận': getDepartmentText(staff),
      'Chức vụ': getRoleText(staff),
      'Ca làm': getShiftText(staff),
      'Ngày tham gia': formatDate(staff.created_at),
      'Tổng lịch': Number(staff.total_appointments || 0),
      'Đánh giá trung bình': !isServiceRole(staff) ? 'Không áp dụng' : (staff.avg_rating > 0 ? Number(staff.avg_rating).toFixed(1) : 'Chưa có'),
      'Số lượt đánh giá': !isServiceRole(staff) ? 'Không áp dụng' : Number(staff.review_count || 0),
      'Thời gian làm (giờ)': !isServiceRole(staff) ? 'Không áp dụng' : Number((Number(staff.monthly_minutes || 0) / 60).toFixed(1)),
      'Trạng thái': staff.is_active ? 'Đang làm' : 'Tạm khóa'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhan su');
    XLSX.writeFile(workbook, `nhan-su_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const startEdit = (staff) => {
    if (isAdminUser(staff)) {
      return;
    }

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
    if (isAdminUser(staff)) {
      return;
    }

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

  const handleSaveSchedule = async (slots) => {
    if (!scheduleModal) {
      return;
    }

    try {
      setScheduleSaving(true);
      await staffService.replaceStaffWeeklyAvailability(scheduleModal.staff.id, slots);
      const savedRows = slots.map((slot, index) => ({
        id: index,
        staff_id: scheduleModal.staff.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time
      }));
      if (String(scheduleModal.staff.id) === String(selectedStaffId)) {
        setSelectedAvailability(savedRows);
      }
      setWeeklyAvailabilityByStaff((prev) => ({
        ...prev,
        [scheduleModal.staff.id]: savedRows
      }));
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
      <section className="staff-page-topbar">
        <div className="staff-page-title">
          <span>Xin chào {currentUser?.name || 'quản trị viên'}</span>
          <h1>Nhân sự</h1>
        </div>

        <div className="staff-top-actions">
          <button type="button" className="staff-soft-action" onClick={() => navigate('/admin/appointments')}>
            <StaffActionIcon name="add" />
            Booking mới
          </button>
          <button type="button" className="staff-soft-action" onClick={() => navigate('/admin/staff-leave')}>
            <StaffActionIcon name="schedule" />
            Ca làm
          </button>
          <div className="staff-admin-chip">
            <span>{(currentUser?.name || 'A').charAt(0).toUpperCase()}</span>
            <div>
              <strong>{currentUser?.name || 'Quản lý'}</strong>
              <small>Quản lý</small>
            </div>
          </div>
        </div>
      </section>

      <section className="staff-command-zone">
        <div className="staff-command-copy" aria-hidden="true" />

        <div className="staff-filter-panel">
          <input
            id="staff-table-search"
            type="text"
            className="staff-search-input"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
            placeholder="Tìm mã, tên, SĐT, bộ phận..."
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Tất cả bộ phận</option>
            <option value="admin">Quản lý</option>
            <option value="service">Nhân viên</option>
            <option value="cashier">Thu ngân</option>
            {uniqueDepartmentRoles.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {getRoleText(role.role_name)}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang làm</option>
            <option value="inactive">Tạm khóa</option>
          </select>
          <select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)} disabled={weeklyAvailabilityLoading}>
            <option value="all">Tất cả ca làm</option>
            <option value="morning">Ca sáng</option>
            <option value="evening">Ca tối</option>
            <option value="full">Full ca</option>
          </select>

          <div className="staff-command-actions">
            <input
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              className="staff-hidden-input"
              onChange={handleImportExcel}
            />
            <button
              className="staff-primary-action"
              type="button"
              onClick={() => setShowForm(true)}
            >
              <StaffActionIcon name="add" />
              Thêm nhân sự
            </button>
            <button
              className="staff-secondary-action"
              type="button"
              onClick={handleExportExcel}
            >
              <StaffActionIcon name="file" />
              Xuất XLSX
            </button>
            <button
              className="staff-icon-action"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="Nhập từ Excel"
              aria-label="Nhập từ Excel"
            >
              <StaffActionIcon name="upload" />
            </button>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {!error && staffList.length === 0 && (
        <div className="alert alert-info">Chưa có nhân viên nào để hiển thị.</div>
      )}

      <section className="staff-stat-grid" aria-label="Thống kê nhân sự">
        {staffStats.map((stat) => (
          <article className="staff-stat-card" key={stat.key}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      {showForm && (
        <div
          className="staff-create-modal"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="staff-form-card staff-create-panel" role="dialog" aria-modal="true" aria-labelledby="staff-create-title">
            <div className="staff-create-head">
              <div>
                <span>Tài khoản mới</span>
                <h3 id="staff-create-title">Tạo tài khoản nhân viên</h3>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Đóng form tạo nhân viên"
              >
                <StaffActionIcon name="close" />
              </button>
            </div>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Mã nhân viên</label>
                <input
                  type="text"
                  value={formData.staff_code}
                  onChange={(event) => setFormData((prev) => ({ ...prev, staff_code: event.target.value }))}
                  placeholder={formData.staff_role_id ? generateNextStaffCode(staffList, formData.staff_role_id, staffRoles) : 'NV001'}
                />
              </div>

              <div className="form-group">
                <label>Họ tên</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
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
                    setFormData((prev) => ({ ...prev, staff_role_id: event.target.value, staff_code: '' }))
                  }
                  required
                  disabled={staffRoles.length === 0}
                >
                  {staffRoles.length === 0 && <option value="">Chưa có vai trò</option>}
                  {staffRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {getRoleText(role.role_name)}
                    </option>
                  ))}
                </select>
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
        </div>
      )}

      <section className="staff-directory-shell">
        <div className="staff-directory-header">
          <div>
            <h2>Danh sách nhân sự</h2>
          </div>
          {selectedStaff && (
            <span className={`staff-status ${selectedStaff.is_active ? 'active' : 'inactive'}`}>
              {selectedStaff.is_active ? 'Đang làm' : 'Tạm khóa'}
            </span>
          )}
        </div>

        <div className="staff-directory-layout">
          <div className="staff-directory-list" role="list" aria-label="Danh sách nhân sự">
            {filteredStaffList.length === 0 && (
              <div className="empty-cell">Không tìm thấy nhân sự phù hợp.</div>
            )}

            {paginatedStaffList.map((staff) => (
              <button
                type="button"
                key={staff.id}
                className={`staff-list-item ${
                  String(selectedStaffId) === String(staff.id) ? 'is-active' : ''
                }`}
                onClick={() => setSelectedStaffId(staff.id)}
              >
                <span className="staff-avatar">{(staff.name || 'N').charAt(0).toUpperCase()}</span>
                <span className="staff-list-main">
                  <strong>{staff.name || 'Nhân sự'}</strong>
                  <small>
                    {formatStaffCode(staff)} · {getRoleText(staff)}
                  </small>
                </span>
                <span className={`staff-mini-status ${staff.is_active ? 'active' : 'inactive'}`}>
                  {staff.is_active ? 'Đang làm' : 'Tạm khóa'}
                </span>
              </button>
            ))}

            {filteredStaffList.length > STAFF_LIST_PAGE_SIZE && (
              <div className="staff-list-pagination" aria-label="Phân trang nhân sự">
                <button
                  type="button"
                  onClick={() => setStaffPage((page) => Math.max(1, page - 1))}
                  disabled={staffPage <= 1}
                >
                  Trước
                </button>
                <span>
                  {staffPage}/{staffPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setStaffPage((page) => Math.min(staffPageCount, page + 1))}
                  disabled={staffPage >= staffPageCount}
                >
                  Sau
                </button>
              </div>
            )}
          </div>

          <aside className="staff-detail-panel" aria-live="polite">
            {selectedStaff ? (
              <>
                <div className="staff-detail-head">
                  <div className="staff-detail-identity">
                    <span className="staff-detail-avatar">
                      {(selectedStaff.name || 'N').charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <small>{formatStaffCode(selectedStaff)}</small>
                      <h3>{selectedStaff.name || 'Nhân sự'}</h3>
                      <p>{getRoleText(selectedStaff)}</p>
                    </div>
                  </div>
                  <span className={`staff-status ${selectedStaff.is_active ? 'active' : 'inactive'}`}>
                    {selectedStaff.is_active ? 'Đang làm' : 'Tạm khóa'}
                  </span>
                </div>

                <div className="staff-detail-metrics">
                  <div style={!isServiceRole(selectedStaff) ? { gridColumn: 'span 2' } : {}}>
                    <span>Tổng lịch</span>
                    <strong>{Number(selectedStaff.total_appointments || 0).toLocaleString('vi-VN')}</strong>
                  </div>
                  {isServiceRole(selectedStaff) && (
                    <>
                      <div>
                        <span>Đánh giá</span>
                        <strong>
                          {selectedStaff.avg_rating > 0
                            ? `${Number(selectedStaff.avg_rating).toFixed(1)} ⭐`
                            : 'Chưa có'}
                        </strong>
                      </div>
                      <div>
                        <span>Số lượt đánh giá</span>
                        <strong>{`${selectedStaff.review_count || 0} lượt`}</strong>
                      </div>
                      <div>
                        <span>Thời gian làm (tháng)</span>
                        <strong>
                          {(() => {
                            const hrs = Number(selectedStaff.monthly_minutes || 0) / 60;
                            return hrs % 1 === 0 ? `${hrs} giờ` : `${hrs.toFixed(1)} giờ`;
                          })()}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="staff-detail-grid">
                  <div>
                    <span>Bộ phận</span>
                    <strong>{getDepartmentText(selectedStaff)}</strong>
                  </div>
                  <div>
                    <span>Loại tài khoản</span>
                    <strong>{isAdminUser(selectedStaff) ? 'Quản lý' : 'Nhân viên'}</strong>
                  </div>
                  <div>
                    <span>Ca làm</span>
                    <strong>
                      {selectedAvailabilityLoading
                        ? 'Đang tải...'
                        : formatWeeklyScheduleSummary(selectedAvailability, 'Chưa đăng ký')}
                    </strong>
                  </div>
                  <div>
                    <span>Ngày tham gia</span>
                    <strong>{formatDate(selectedStaff.created_at)}</strong>
                  </div>
                  <div>
                    <span>Số điện thoại</span>
                    <strong>{selectedStaff.phone || '-'}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{selectedStaff.email || '-'}</strong>
                  </div>
                </div>

                <div className="staff-weekly-preview">
                  <div>
                    <span>Ca đã đăng ký</span>
                    <strong>
                      {selectedAvailabilityLoading
                        ? 'Đang tải ca làm...'
                        : `${selectedAvailability.length.toLocaleString('vi-VN')} ngày/tuần`}
                    </strong>
                  </div>
                  <p>
                    {selectedAvailabilityLoading
                      ? 'Đang tải...'
                      : formatWeeklyScheduleSummary(selectedAvailability, 'Chưa có ca làm. Bấm "Đăng ký ca làm" để cập nhật.')}
                  </p>
                </div>

                <div className="staff-detail-actions">
                  {!isAdminUser(selectedStaff) && (
                    <button
                      type="button"
                      className="staff-secondary-action"
                      onClick={() => startEdit(selectedStaff)}
                    >
                      <StaffActionIcon name="edit" />
                      Sửa hồ sơ
                    </button>
                  )}
                    <button
                      type="button"
                      className="staff-secondary-action"
                      onClick={() => openScheduleModal(selectedStaff)}
                    >
                      <StaffActionIcon name="schedule" />
                      Đăng ký ca làm
                    </button>
                  {!isAdminUser(selectedStaff) && (
                    <button
                      type="button"
                      className={`staff-secondary-action ${selectedStaff.is_active ? 'danger' : 'success'}`}
                      onClick={() => handleToggleActive(selectedStaff)}
                    >
                      <StaffActionIcon name={selectedStaff.is_active ? 'lock' : 'unlock'} />
                      {selectedStaff.is_active ? 'Tạm khóa' : 'Kích hoạt'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="staff-detail-empty">Chọn một nhân sự để xem chi tiết.</div>
            )}
          </aside>
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
                    disabled={visibleStaffRoles.length === 0}
                  >
                    {visibleStaffRoles.length === 0 && <option value="">Chưa có vai trò</option>}
                    {visibleStaffRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {getRoleText(role.role_name)}
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
        <StaffScheduleModal
          staff={scheduleModal.staff}
          scheduleData={scheduleModal.days}
          loading={scheduleLoading}
          saving={scheduleSaving}
          onClose={closeScheduleModal}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
}

export default ManageStaff;
