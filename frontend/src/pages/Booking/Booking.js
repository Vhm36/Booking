import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import bookingService from '../../services/bookingService';
import paymentService from '../../services/paymentService';
import serviceService from '../../services/serviceService';
import staffService from '../../services/staffService';
import voucherService from '../../services/voucherService';
import VoucherIcon from '../../components/VoucherIcon';
import { formatDurationLabel, formatVnd } from '../../utils/formatters';
import './Booking.css';

const WEEKDAY_QUICK_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const WEEKEND_QUICK_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const visiblePaymentMethodSet = new Set(['cash', 'banking', 'vietqr', 'vnpay']);
const manualPaymentMethodSet = new Set(['cash', 'banking']);
const onlinePaymentMethodSet = new Set(['vietqr', 'vnpay']);

const toShortTimeString = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  return raw.length >= 5 ? raw.slice(0, 5) : raw;
};

const timeToMinutes = (value) => {
  const raw = toShortTimeString(value);
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    return null;
  }

  const [hours, minutes] = raw.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const getBusinessWindowForDate = (dateValue) => {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { start: '08:00', end: '21:00', isWeekend: false };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return isWeekend
    ? { start: '07:00', end: '23:00', isWeekend: true }
    : { start: '08:00', end: '21:00', isWeekend: false };
};

const isTimeInBusinessWindow = (dateValue, timeValue) => {
  const businessWindow = getBusinessWindowForDate(dateValue);
  const selectedMinutes = timeToMinutes(timeValue);
  const startMinutes = timeToMinutes(businessWindow.start);
  const endMinutes = timeToMinutes(businessWindow.end);

  if ([selectedMinutes, startMinutes, endMinutes].some((value) => value === null)) {
    return false;
  }

  return selectedMinutes >= startMinutes && selectedMinutes <= endMinutes;
};

const addMinutesToShortTime = (value, minutesToAdd) => {
  const startMinutes = timeToMinutes(value);
  const safeMinutesToAdd = Number(minutesToAdd);

  if (startMinutes === null || !Number.isFinite(safeMinutesToAdd)) {
    return '';
  }

  const endMinutes = startMinutes + safeMinutesToAdd;
  if (endMinutes < 0 || endMinutes > 24 * 60) {
    return '';
  }

  const hours = Math.floor(endMinutes / 60);
  const minutes = endMinutes % 60;

  if (hours > 23 && minutes > 0) {
    return '';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const doTimeRangesOverlap = (startA, endA, startB, endB) => {
  const fromA = timeToMinutes(startA);
  const toA = timeToMinutes(endA);
  const fromB = timeToMinutes(startB);
  const toB = timeToMinutes(endB);

  if ([fromA, toA, fromB, toB].some((value) => value === null)) {
    return false;
  }

  return fromA < toB && toA > fromB;
};

const isCurrentTimeBusy = (startTime, endTime, busyRanges) => {
  if (!startTime || !endTime || !Array.isArray(busyRanges) || busyRanges.length === 0) {
    return false;
  }

  return busyRanges.some((range) =>
    doTimeRangesOverlap(startTime, endTime, range.busy_start_time, range.busy_end_time)
  );
};

const dedupeServices = (services) => {
  const seen = new Set();
  return (Array.isArray(services) ? services : []).filter((service) => {
    const serviceId = Number(service?.id);
    if (!Number.isInteger(serviceId) || seen.has(serviceId)) {
      return false;
    }

    seen.add(serviceId);
    return true;
  });
};

const normalizeText = (value = '') =>
  String(value)
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getCategoryKey = (category) => {
  const key = normalizeText(category).trim();

  if (key.includes('hair') || key.includes('toc')) return 'toc';
  if (key.includes('nail') || key.includes('mong')) return 'mong';
  if (key.includes('massage')) return 'massage';
  if (key.includes('facial') || key.includes('skin') || key.includes('cham soc da')) return 'da';
  if (
    key.includes('lash') ||
    key.includes('brow') ||
    key.includes('long may') ||
    key.includes('chan may') ||
    key.includes('mi & may') ||
    key.includes('mi va may') ||
    key.includes('mi')
  ) {
    return 'mi-may';
  }

  if (key.includes('makeup') || key.includes('trang diem')) return 'trang-diem';
  if (key.includes('combo')) return 'combo';

  return key || 'khac';
};

const getCategoryLabel = (category) => {
  const key = getCategoryKey(category);

  if (key === 'toc') return 'Tóc';
  if (key === 'mong') return 'Móng';
  if (key === 'massage') return 'Massage';
  if (key === 'da') return 'Chăm sóc da';
  if (key === 'mi-may') return 'Mi & mày';
  if (key === 'trang-diem') return 'Trang điểm';
  if (key === 'combo') return 'Combo';

  return category || 'Khác';
};

const getHairSubcategoryKey = (service = {}) => {
  const content = normalizeText(`${service.name || ''} ${service.category || ''}`);

  if (content.includes('uon')) return 'uon-toc';
  if (content.includes('nhuom')) return 'nhuom-toc';
  if (content.includes('duoi')) return 'duoi-toc';
  if (content.includes('phuc hoi') || content.includes('hap')) return 'phuc-hoi-toc';
  if (content.includes('goi')) return 'goi-dau';
  if (content.includes('cat') || content.includes('tao kieu')) return 'cat-tao-kieu';
  if (content.includes('hot') || content.includes('trend')) return 'toc-hot';
  return 'toc-khac';
};

const getSubcategoryKey = (service = {}, categoryKey = '') => {
  if (categoryKey === 'toc') {
    return getHairSubcategoryKey(service);
  }

  return 'all';
};

const getSubcategoryLabel = (subcategoryKey) => {
  const map = {
    all: 'Tất cả',
    'toc-hot': 'Tóc hot',
    'cat-tao-kieu': 'Cắt/Tạo kiểu',
    'uon-toc': 'Uốn tóc',
    'nhuom-toc': 'Nhuộm tóc',
    'duoi-toc': 'Duỗi tóc',
    'phuc-hoi-toc': 'Phục hồi tóc',
    'goi-dau': 'Gội đầu',
    'toc-khac': 'Tóc khác'
  };

  return map[subcategoryKey] || 'Khác';
};

const formatPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'cash') {
    return 'Tiền mặt tại tiệm';
  }

  if (paymentMethod === 'banking') {
    return 'Chuyển khoản tại tiệm';
  }

  if (paymentMethod === 'vietqr') {
    return 'VietQR ngân hàng';
  }

  if (paymentMethod === 'vnpay') {
    return 'VNPay online';
  }

  return 'Thanh toán tại tiệm';
};

function Booking() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [allServices, setAllServices] = useState([]);
  const [serviceCategoriesFromDb, setServiceCategoriesFromDb] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [activeCategoryKey, setActiveCategoryKey] = useState('');
  const [activeSubcategoryByCategory, setActiveSubcategoryByCategory] = useState({});
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [allStaff, setAllStaff] = useState([]);
  const [availableStaffIds, setAvailableStaffIds] = useState(() => new Set());
  const [busySlotRanges, setBusySlotRanges] = useState([]);
  const [busyTimeSlots, setBusyTimeSlots] = useState([]);
  const [loadingStaffList, setLoadingStaffList] = useState(true);
  const [loadingStaffAvailability, setLoadingStaffAvailability] = useState(false);
  const [loadingBusySlots, setLoadingBusySlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [myVouchers, setMyVouchers] = useState([]);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState('');
  const [voucherPreview, setVoucherPreview] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [cancellationRisk, setCancellationRisk] = useState(null);
  const [loadingCancellationRisk, setLoadingCancellationRisk] = useState(false);

  const businessWindow = useMemo(() => getBusinessWindowForDate(appointmentDate), [appointmentDate]);
  const quickSlots = useMemo(
    () => (businessWindow.isWeekend ? WEEKEND_QUICK_SLOTS : WEEKDAY_QUICK_SLOTS),
    [businessWindow.isWeekend]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchServices = async () => {
      try {
        setLoading(true);
        const requests = [serviceService.getAllServices(), serviceService.getAllCategories()];
        if (serviceId) {
          requests.splice(1, 0, serviceService.getServiceById(serviceId));
        }

        const results = await Promise.allSettled(requests);
        const servicesResult = results[0];
        const selectedServiceResult = serviceId ? results[1] : null;
        const categoriesResult = serviceId ? results[2] : results[1];

        if (serviceId && selectedServiceResult.status !== 'fulfilled') {
          throw selectedServiceResult.reason || new Error('Không thể tải dịch vụ đã chọn.');
        }

        const currentService = serviceId ? selectedServiceResult.value.data?.data || null : null;
        const serviceList =
          servicesResult.status === 'fulfilled' ? servicesResult.value.data?.data || [] : [];
        const categoryList =
          categoriesResult.status === 'fulfilled' ? categoriesResult.value.data?.data || [] : [];
        const mergedServices = dedupeServices([currentService, ...serviceList]);

        if (!cancelled) {
          if (serviceId && !currentService) {
            setError('Không tìm thấy dịch vụ để đặt lịch.');
            setAllServices([]);
            setServiceCategoriesFromDb(categoryList);
            setSelectedServices([]);
          } else {
            setAllServices(mergedServices);
            setServiceCategoriesFromDb(categoryList);
            setSelectedServices(currentService ? [currentService] : []);
            setError('');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Không thể tải thông tin dịch vụ.');
          setAllServices([]);
          setSelectedServices([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchServices();
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
        }
      } catch (err) {
        if (!cancelled) {
          setAllStaff([]);
          setAvailableStaffIds(new Set());
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

    const fetchPaymentOptions = async () => {
      try {
        const response = await paymentService.getPaymentOptions();
        const nextOptions = (response.data?.data?.options || []).filter((option) =>
          visiblePaymentMethodSet.has(option.method)
        );
        const apiRecommendedMethod = response.data?.data?.recommended_method;
        const recommendedMethod =
          nextOptions.find((option) => option.enabled && option.method === apiRecommendedMethod)?.method ||
          nextOptions.find((option) => option.enabled)?.method ||
          'cash';

        if (!cancelled) {
          setPaymentOptions(nextOptions);
          setPaymentMethod((current) => {
            const hasCurrent = nextOptions.some((option) => option.enabled && option.method === current);
            return hasCurrent ? current : recommendedMethod;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPaymentOptions([]);
          setPaymentMethod('cash');
        }
      }
    };

    fetchPaymentOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchMyVouchers = async () => {
      if (!authService.getToken()) {
        return;
      }

      try {
        setLoadingVouchers(true);
        const response = await voucherService.getMyVouchers();
        const nextVouchers = response.data?.data || [];

        if (!cancelled) {
          setMyVouchers(nextVouchers);
        }
      } catch (err) {
        if (!cancelled) {
          setMyVouchers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingVouchers(false);
        }
      }
    };

    fetchMyVouchers();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedServiceIds = useMemo(
    () => selectedServices.map((service) => Number(service.id)).filter((id) => Number.isInteger(id) && id > 0),
    [selectedServices]
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0),
    [selectedServices]
  );

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0),
    [selectedServices]
  );

  useEffect(() => {
    let cancelled = false;

    const validateSelectedVoucher = async () => {
      const cleanCode = selectedVoucherCode.trim();
      setVoucherPreview(null);
      setVoucherError('');

      if (!cleanCode || totalPrice <= 0) {
        return;
      }

      try {
        setValidatingVoucher(true);
        const response = await voucherService.validateVoucher(cleanCode, totalPrice);

        if (!cancelled) {
          setVoucherPreview(response.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setVoucherError(err.response?.data?.message || 'Voucher không hợp lệ cho lịch này.');
        }
      } finally {
        if (!cancelled) {
          setValidatingVoucher(false);
        }
      }
    };

    validateSelectedVoucher();
    return () => {
      cancelled = true;
    };
  }, [selectedVoucherCode, totalPrice]);

  useEffect(() => {
    let cancelled = false;

    const fetchCancellationRisk = async () => {
      setCancellationRisk(null);

      if (!appointmentDate || !appointmentTime || !authService.getToken()) {
        return;
      }

      try {
        setLoadingCancellationRisk(true);
        const response = await bookingService.getCancellationScore(appointmentDate, appointmentTime);

        if (!cancelled) {
          setCancellationRisk(response.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setCancellationRisk(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingCancellationRisk(false);
        }
      }
    };

    fetchCancellationRisk();
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, appointmentTime]);

  const selectedSlotEndTime = useMemo(
    () => (appointmentTime && totalDuration > 0 ? addMinutesToShortTime(appointmentTime, totalDuration) : ''),
    [appointmentTime, totalDuration]
  );

  useEffect(() => {
    let cancelled = false;

    const checkAvailableStaff = async () => {
      if (!appointmentDate || !appointmentTime || selectedServiceIds.length === 0) {
        setAvailableStaffIds(new Set(allStaff.map((staff) => String(staff.id))));
        return;
      }

      if (allStaff.length === 0) {
        setAvailableStaffIds(new Set());
        return;
      }

      setLoadingStaffAvailability(true);

      try {
        const response = await staffService.getAvailableStaff(
          appointmentDate,
          appointmentTime,
          selectedServiceIds
        );
        const nextAvailableIds = new Set((response.data.data || []).map((staff) => String(staff.id)));

        if (!cancelled) {
          setAvailableStaffIds(nextAvailableIds);
          setSelectedStaffId((prev) => {
            if (!prev) {
              return '';
            }

            if (nextAvailableIds.has(String(prev))) {
              return prev;
            }

            return prev;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableStaffIds(new Set());
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
  }, [appointmentDate, appointmentTime, selectedServiceIds, allStaff]);

  useEffect(() => {
    let cancelled = false;

    const fetchBusySlots = async () => {
      if (!selectedStaffId || !appointmentDate) {
        setBusySlotRanges([]);
        return;
      }

      try {
        setLoadingBusySlots(true);
        setBusySlotRanges([]);
        const response = await staffService.getBusyTimeSlots(selectedStaffId, appointmentDate);

        if (!cancelled) {
          setBusySlotRanges(response.data?.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setBusySlotRanges([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingBusySlots(false);
        }
      }
    };

    fetchBusySlots();
    return () => {
      cancelled = true;
    };
  }, [selectedStaffId, appointmentDate]);

  useEffect(() => {
    if (totalDuration <= 0) {
      setBusyTimeSlots([]);
      return;
    }

    const businessStartMinutes = timeToMinutes(businessWindow.start);
    const businessEndMinutes = timeToMinutes(businessWindow.end);
    const nextBusyTimeSlots = quickSlots.filter((slot) => {
      const slotStartMinutes = timeToMinutes(slot);
      const slotEndTime = addMinutesToShortTime(slot, totalDuration);
      const slotEndMinutes = timeToMinutes(slotEndTime);
      if (!slotEndTime) {
        return true;
      }

      if (
        [businessStartMinutes, businessEndMinutes, slotStartMinutes, slotEndMinutes].some((value) => value === null) ||
        slotStartMinutes < businessStartMinutes ||
        slotEndMinutes > businessEndMinutes
      ) {
        return true;
      }

      return isCurrentTimeBusy(slot, slotEndTime, busySlotRanges);
    });

    setBusyTimeSlots(nextBusyTimeSlots);
  }, [busySlotRanges, businessWindow.end, businessWindow.start, quickSlots, totalDuration]);

  const today = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    if (!appointmentDate) {
      setAppointmentDate(today);
    }
  }, [appointmentDate, today]);

  useEffect(() => {
    if (appointmentDate && appointmentTime && !isTimeInBusinessWindow(appointmentDate, appointmentTime)) {
      setAppointmentTime('');
    }
  }, [appointmentDate, appointmentTime]);

  const staffOptions = useMemo(() => {
    const shouldCheckAvailability = !!appointmentDate && !!appointmentTime && selectedServiceIds.length > 0;
    return allStaff.map((staff) => ({
      ...staff,
      isAvailable: !shouldCheckAvailability || availableStaffIds.has(String(staff.id))
    }));
  }, [allStaff, appointmentDate, appointmentTime, availableStaffIds, selectedServiceIds.length]);

  const selectedStaffName = useMemo(() => {
    const selected = allStaff.find((staff) => String(staff.id) === String(selectedStaffId));
    return selected ? selected.name : '';
  }, [selectedStaffId, allStaff]);

  const selectedSlotRangeLabel = useMemo(() => {
    if (!appointmentTime) {
      return '';
    }

    const startLabel = toShortTimeString(appointmentTime);
    return selectedSlotEndTime ? `${startLabel} - ${selectedSlotEndTime}` : startLabel;
  }, [appointmentTime, selectedSlotEndTime]);

  const currentTimeConflict = useMemo(
    () => isCurrentTimeBusy(appointmentTime, selectedSlotEndTime, busySlotRanges),
    [appointmentTime, selectedSlotEndTime, busySlotRanges]
  );

  const voucherDiscount = Number(voucherPreview?.discountAmount || 0);
  const finalTotalPrice = Math.max(totalPrice - voucherDiscount, 0);
  const depositRequired = Boolean(cancellationRisk?.requireDeposit) && finalTotalPrice > 0;
  const estimatedDepositAmount = depositRequired
    ? Math.min(
        finalTotalPrice,
        Math.max(1000, Math.round((finalTotalPrice * Number(cancellationRisk?.depositPercent || 20)) / 100))
      )
    : 0;

  const enabledPaymentOptions = useMemo(
    () =>
      paymentOptions
        .map((option) => {
          if (option.method === 'vietqr') {
            return {
              ...option,
              label: 'VietQR ngân hàng',
              description: option.enabled
                ? 'Quét mã QR để chuyển khoản đúng số tiền và nội dung thanh toán.'
                : 'Tạm thời chưa khả dụng.'
            };
          }

          if (option.method === 'vnpay') {
            return {
              ...option,
              label: 'VNPay online',
              description: option.enabled
                ? 'Thanh toán online qua cổng VNPay rồi quay lại trang kết quả tự động.'
                : 'Tạm thời chưa khả dụng.'
            };
          }

          if (option.method === 'cash') {
            return {
              ...option,
              enabled: depositRequired ? false : option.enabled,
              label: 'Tiền mặt',
              description: 'Thanh toán trực tiếp bằng tiền mặt khi đến salon.'
            };
          }

          if (option.method === 'banking') {
            return {
              ...option,
              enabled: depositRequired ? false : option.enabled,
              label: 'Ngân hàng',
              description: 'Chuyển khoản tại salon và thu ngân xác nhận sau khi nhận tiền.'
            };
          }

          return option;
        }),
    [paymentOptions, depositRequired]
  );

  useEffect(() => {
    if (!depositRequired || !manualPaymentMethodSet.has(paymentMethod)) {
      return;
    }

    const nextOnlineMethod =
      enabledPaymentOptions.find((option) => option.enabled && onlinePaymentMethodSet.has(option.method))?.method ||
      paymentMethod;

    setPaymentMethod(nextOnlineMethod);
  }, [depositRequired, enabledPaymentOptions, paymentMethod]);

  const selectedServiceSummary = useMemo(() => {
    if (selectedServices.length === 0) {
      return 'Chưa chọn dịch vụ';
    }

    if (selectedServices.length === 1) {
      return selectedServices[0].name;
    }

    return `${selectedServices.length} dịch vụ đã chọn`;
  }, [selectedServices]);

  const usableVouchers = useMemo(
    () =>
      myVouchers.filter((voucher) =>
        ['active', 'expiring_soon'].includes(String(voucher.status || '').toLowerCase())
      ),
    [myVouchers]
  );

  const serviceCategories = useMemo(() => {
    const groupedCategories = new Map();

    allServices.forEach((service) => {
      const categoryKey = getCategoryKey(service.category);
      const existingGroup = groupedCategories.get(categoryKey) || {
        key: categoryKey,
        label: getCategoryLabel(service.category),
        services: []
      };

      existingGroup.services.push(service);
      groupedCategories.set(categoryKey, existingGroup);
    });

    serviceCategoriesFromDb.forEach((category) => {
      const categoryKey = getCategoryKey(category.category_name);
      if (groupedCategories.has(categoryKey)) {
        const existingGroup = groupedCategories.get(categoryKey);
        groupedCategories.set(categoryKey, {
          ...existingGroup,
          label: getCategoryLabel(category.category_name)
        });
      }
    });

    const orderedKeys = [];
    serviceCategoriesFromDb.forEach((category) => {
      const categoryKey = getCategoryKey(category.category_name);
      if (groupedCategories.has(categoryKey) && !orderedKeys.includes(categoryKey)) {
        orderedKeys.push(categoryKey);
      }
    });

    Array.from(groupedCategories.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
      .forEach((group) => {
        if (!orderedKeys.includes(group.key)) {
          orderedKeys.push(group.key);
        }
      });

    return orderedKeys.map((categoryKey) => ({
      ...groupedCategories.get(categoryKey),
      services: [...(groupedCategories.get(categoryKey)?.services || [])].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'vi')
      )
    }));
  }, [allServices, serviceCategoriesFromDb]);

  useEffect(() => {
    if (serviceCategories.length === 0) {
      setActiveCategoryKey('');
      return;
    }

    const preferredCategory = selectedServices[0]?.category || '';
    const preferredKey = preferredCategory ? getCategoryKey(preferredCategory) : '';

    setActiveCategoryKey((current) => {
      if (current && serviceCategories.some((category) => category.key === current)) {
        return current;
      }

      if (preferredKey && serviceCategories.some((category) => category.key === preferredKey)) {
        return preferredKey;
      }

      return serviceCategories[0].key;
    });
  }, [serviceCategories, selectedServices]);

  const activeCategory = useMemo(
    () => serviceCategories.find((category) => category.key === activeCategoryKey) || serviceCategories[0] || null,
    [serviceCategories, activeCategoryKey]
  );

  const activeCategoryServices = useMemo(() => activeCategory?.services || [], [activeCategory]);
  const availableSubcategories = useMemo(() => {
    if (!activeCategory) {
      return [{ key: 'all', label: 'Tất cả' }];
    }

    if (activeCategory.key !== 'toc') {
      return [{ key: 'all', label: 'Tất cả' }];
    }

    const keys = new Set();
    activeCategoryServices.forEach((service) => {
      keys.add(getSubcategoryKey(service, activeCategory.key));
    });

    return ['all', ...Array.from(keys)]
      .filter((key, index, arr) => arr.indexOf(key) === index)
      .map((key) => ({ key, label: getSubcategoryLabel(key) }));
  }, [activeCategory, activeCategoryServices]);

  const activeSubcategoryKey = useMemo(() => {
    if (!activeCategory) {
      return 'all';
    }

    const storedKey = activeSubcategoryByCategory[activeCategory.key] || 'all';
    return availableSubcategories.some((item) => item.key === storedKey) ? storedKey : 'all';
  }, [activeCategory, activeSubcategoryByCategory, availableSubcategories]);

  const filteredCategoryServices = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    if (activeSubcategoryKey === 'all') {
      return activeCategoryServices;
    }

    return activeCategoryServices.filter(
      (service) => getSubcategoryKey(service, activeCategory.key) === activeSubcategoryKey
    );
  }, [activeCategory, activeCategoryServices, activeSubcategoryKey]);

  useEffect(() => {
    if (!activeCategory) {
      return;
    }

    const defaultSubcategory = availableSubcategories[0]?.key || 'all';
    setActiveSubcategoryByCategory((current) => {
      const existing = current[activeCategory.key];
      if (existing && availableSubcategories.some((item) => item.key === existing)) {
        return current;
      }

      return {
        ...current,
        [activeCategory.key]: defaultSubcategory
      };
    });
  }, [activeCategory, availableSubcategories]);

  const selectedServiceIdSet = useMemo(
    () => new Set(selectedServiceIds.map((id) => String(id))),
    [selectedServiceIds]
  );

  const getCreatedAppointmentId = (response) =>
    response?.data?.appointmentId ||
    response?.data?.data?.appointmentId ||
    response?.data?.appointment?.id ||
    response?.data?.data?.id ||
    null;

  const isOnlinePayment = onlinePaymentMethodSet.has(paymentMethod);
  const onlinePaymentLabel = paymentMethod === 'vnpay' ? 'cổng thanh toán online' : 'mã chuyển khoản';
  const paymentFallbackLabel = isOnlinePayment ? onlinePaymentLabel : 'phiếu thanh toán';

  const toggleServiceSelection = (service) => {
    setSelectedServices((current) => {
      const exists = current.some((item) => Number(item.id) === Number(service.id));
      if (exists) {
        return current.filter((item) => Number(item.id) !== Number(service.id));
      }

      return [...current, service];
    });
  };

  const handleCategoryChange = (categoryKey) => {
    setActiveCategoryKey(categoryKey);
  };

  const handleSubcategoryChange = (subcategoryKey) => {
    if (!activeCategory) {
      return;
    }

    setActiveSubcategoryByCategory((current) => ({
      ...current,
      [activeCategory.key]: subcategoryKey
    }));
  };

  const handleQuickSlotClick = (slot) => {
    if (busyTimeSlots.includes(slot)) {
      return;
    }

    setAppointmentTime(slot);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (selectedServices.length === 0) {
      setError('Vui lòng chọn ít nhất 1 dịch vụ trước khi đặt lịch.');
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setError('Vui lòng chọn ngày và giờ trước khi đặt lịch.');
      return;
    }

    if (!isTimeInBusinessWindow(appointmentDate, appointmentTime)) {
      setError(`Giờ hẹn ngày này chỉ nhận từ ${businessWindow.start} đến ${businessWindow.end}.`);
      return;
    }

    if (!selectedSlotEndTime) {
      setError('Khung giờ kết thúc không hợp lệ cho danh sách dịch vụ đã chọn.');
      return;
    }

    if (timeToMinutes(selectedSlotEndTime) > timeToMinutes(businessWindow.end)) {
      setError(`Khung dịch vụ dự kiến cần kết thúc trước ${businessWindow.end}.`);
      return;
    }

    if (currentTimeConflict) {
      setError('Nhân viên đã bận trong khung giờ này. Vui lòng chọn giờ khác.');
      return;
    }

    if (selectedStaffId) {
      const selectedOption = staffOptions.find((staff) => String(staff.id) === String(selectedStaffId));
      if (!selectedOption || !selectedOption.isAvailable) {
        setError('Nhân viên đã bận ở khung giờ này, vui lòng chọn nhân viên khác hoặc đổi giờ.');
        return;
      }
    }

    if (selectedVoucherCode && (voucherError || !voucherPreview)) {
      setError(voucherError || 'Voucher đang được kiểm tra, vui lòng thử lại sau vài giây.');
      return;
    }

    if (depositRequired && !onlinePaymentMethodSet.has(paymentMethod)) {
      setError('Lịch này cần thanh toán cọc online do AI đánh giá rủi ro hủy cao.');
      return;
    }

    setSubmitting(true);
    let createdAppointmentId = null;

    try {
      const bookingResponse = await bookingService.createBooking(
        selectedServiceIds,
        selectedStaffId ? Number(selectedStaffId) : null,
        appointmentDate,
        appointmentTime,
        notes,
        selectedVoucherCode
      );
      createdAppointmentId = getCreatedAppointmentId(bookingResponse);

      if (!createdAppointmentId) {
        throw new Error('Đã đặt lịch nhưng không nhận được mã lịch hẹn từ server.');
      }

      const paymentResponse = await paymentService.createPayment(createdAppointmentId, paymentMethod);

      const isAutoAssigned = bookingResponse.data?.autoAssigned;
      const assignedStaffName = bookingResponse.data?.staffName;
      let baseSuccessMsg = 'Đặt lịch thành công.';
      if (isAutoAssigned && assignedStaffName) {
        baseSuccessMsg = `Đặt lịch thành công! Hệ thống đã tự động sắp xếp nhân viên ${assignedStaffName} phục vụ bạn.`;
      }

      if (isOnlinePayment) {
        const paymentUrl = paymentResponse.data?.payment?.payment_url;

        if (!paymentUrl) {
          throw new Error('Không tạo được liên kết thanh toán.');
        }

        setSuccess(
          paymentMethod === 'vnpay'
            ? `${baseSuccessMsg} Đang mở cổng thanh toán online...`
            : `${baseSuccessMsg} Đang mở mã chuyển khoản...`
        );
        window.location.assign(paymentUrl);
        return;
      }

      setSuccess(`${baseSuccessMsg} Đang chuyển đến Lịch của tôi...`);
      window.setTimeout(() => navigate('/my-appointments'), 1800);
    } catch (err) {
      if (createdAppointmentId) {
        setError(
          err.response?.data?.message ||
            `Lịch hẹn đã được tạo nhưng chưa mở được ${paymentFallbackLabel}. Bạn có thể thao tác lại trong Lịch của tôi.`
        );
        setSuccess('Lịch hẹn đã được lưu. Đang chuyển đến danh sách lịch...');
        window.setTimeout(() => navigate('/my-appointments'), 2000);
      } else {
        setError(err.response?.data?.message || 'Đặt lịch thất bại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải thông tin đặt lịch...</div>;
  }

  if (selectedServices.length === 0 && allServices.length === 0) {
    return <div className="alert alert-error">{error || 'Không tìm thấy dịch vụ.'}</div>;
  }

  return (
    <div className="booking-page">
      <form className="booking-layout" onSubmit={handleSubmit}>
        <section className="booking-panel">
          <h1>Đặt lịch nhanh</h1>
          <p className="subtitle">Chọn nhiều dịch vụ, tính tổng thời gian và đặt lịch trong một lần.</p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label>Chọn dịch vụ</label>
            <div className="service-browser">
              <div className="service-browser-head">
                <div>
                  <strong>{activeCategory?.label || 'Danh mục dịch vụ'}</strong>
                  <span>Chạm vào từng thẻ để thêm nhanh vào lịch, không cần tích checkbox.</span>
                </div>
                <div className="service-browser-counter">
                  <strong>{selectedServices.length}</strong>
                  <span>đã chọn</span>
                </div>
              </div>

              <div className="service-category-tabs" role="tablist" aria-label="Danh mục dịch vụ">
                {serviceCategories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory?.key === category.key}
                    className={activeCategory?.key === category.key ? 'service-category-tab active' : 'service-category-tab'}
                    onClick={() => handleCategoryChange(category.key)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {activeCategory ? (
                <>
                  {availableSubcategories.length > 1 && (
                    <div className="service-subcategory-tabs" role="tablist" aria-label="Bộ lọc dịch vụ">
                      {availableSubcategories.map((subcategory) => (
                        <button
                          key={subcategory.key}
                          type="button"
                          role="tab"
                          aria-selected={activeSubcategoryKey === subcategory.key}
                          className={
                            activeSubcategoryKey === subcategory.key
                              ? 'service-subcategory-tab active'
                              : 'service-subcategory-tab'
                          }
                          onClick={() => handleSubcategoryChange(subcategory.key)}
                        >
                          {subcategory.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="service-compact-table-wrap">
                    <table className="service-compact-table">
                      <thead>
                        <tr>
                          <th>Dịch vụ</th>
                          <th>Thời lượng</th>
                          <th>Giá</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategoryServices.map((service) => {
                          const isSelected = selectedServiceIdSet.has(String(service.id));

                          return (
                            <tr key={`${activeCategory.key}-${service.id}`} className={isSelected ? 'is-selected' : ''}>
                              <td>{service.name}</td>
                              <td>{formatDurationLabel(Number(service.duration) || 0)}</td>
                              <td>{formatVnd(Number(service.price) || 0)}</td>
                              <td>
                                <button
                                  type="button"
                                  className={isSelected ? 'service-select-btn selected' : 'service-select-btn'}
                                  onClick={() => toggleServiceSelection(service)}
                                >
                                  <span className="service-select-icon">{isSelected ? '✓' : '+'}</span>
                                  <span>{isSelected ? 'Đã chọn' : 'Thêm'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="service-carousel-footer">
                    <span>
                      {activeCategory.label} • {filteredCategoryServices.length}/{activeCategoryServices.length} dịch vụ
                    </span>
                    {activeSubcategoryKey !== 'all' && <span>Đang lọc: {getSubcategoryLabel(activeSubcategoryKey)}</span>}
                  </div>
                </>
              ) : (
                <div className="service-carousel-empty">Chưa có dịch vụ nào sẵn sàng trong hệ thống.</div>
              )}
            </div>

            <div className="selected-services-list">
              {selectedServices.length === 0 ? (
                <div className="selected-services-empty">
                  Chưa có dịch vụ nào trong lịch hẹn. Hãy bấm vào một thẻ ở phía trên để thêm nhanh.
                </div>
              ) : (
                selectedServices.map((service) => (
                  <div key={service.id} className="selected-service-chip">
                    <div>
                      <strong>{service.name}</strong>
                      <span>
                        {formatDurationLabel(Number(service.duration) || 0)} • {formatVnd(Number(service.price) || 0)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => toggleServiceSelection(service)}
                      aria-label={`Bỏ dịch vụ ${service.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Ngày hẹn</label>
            <input
              type="date"
              className="form-control"
              min={today}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Khung giờ phổ biến</label>
            <div className="slot-grid">
              {quickSlots.map((slot) => {
                const isToday = appointmentDate === today;
                let isPast = false;
                
                if (isToday) {
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  const [slotHourStr, slotMinuteStr] = slot.split(':');
                  const slotHour = parseInt(slotHourStr, 10);
                  const slotMinute = parseInt(slotMinuteStr, 10);
                  
                  if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
                    isPast = true;
                  }
                }

                const isBusy = busyTimeSlots.includes(slot) || isPast;

                return (
                  <button
                    key={slot}
                    type="button"
                    className={[
                      'slot-btn',
                      appointmentTime === slot ? 'active' : '',
                      isBusy ? 'busy' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleQuickSlotClick(slot)}
                    disabled={isBusy}
                    title={isBusy ? (isPast ? 'Đã qua khung giờ này' : 'Nhân viên đang bận ở khung giờ này') : slot}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            {selectedStaffId && appointmentDate && (
              <small className="field-hint">
                {loadingBusySlots
                  ? 'Đang tải khung giờ bận của nhân viên...'
                  : busySlotRanges.length > 0
                    ? `Đã khóa ${busyTimeSlots.length} khung giờ nhanh bị trùng lịch của nhân viên.`
                    : 'Nhân viên này đang trống ở các khung giờ nhanh hiện có.'}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Hoặc chọn giờ cụ thể</label>
            <input
              type="time"
              min={businessWindow.start}
              max={businessWindow.end}
              value={appointmentTime}
              onChange={(event) => setAppointmentTime(event.target.value)}
              required
            />
            <small className="field-hint">
              Giờ nhận lịch: {businessWindow.start} - {businessWindow.end}
            </small>
            {appointmentTime && selectedSlotEndTime && (
              <small className="field-hint">Khung giờ dự kiến: {selectedSlotRangeLabel}</small>
            )}
            {appointmentTime && currentTimeConflict && (
              <small className="field-error">Nhân viên đang bận trong khoảng thời gian này.</small>
            )}
          </div>

          <div className="form-group">
            <label>Nhân viên phụ trách (tùy chọn)</label>
            <select
              value={selectedStaffId}
              onChange={(event) => setSelectedStaffId(event.target.value)}
              disabled={loadingStaffList || allStaff.length === 0}
            >
              <option value="">
                {loadingStaffList
                  ? 'Đang tải danh sách nhân viên...'
                  : allStaff.length === 0
                    ? 'Chưa có nhân viên hoạt động'
                    : loadingStaffAvailability
                      ? 'Đang kiểm tra lịch trống...'
                      : 'Để hệ thống tự sắp xếp'}
              </option>
              {staffOptions.map((staff) => (
                <option
                  key={staff.id}
                  value={staff.id}
                  disabled={
                    !!appointmentDate &&
                    !!appointmentTime &&
                    !staff.isAvailable &&
                    String(staff.id) !== String(selectedStaffId)
                  }
                >
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ghi chú cho nhân viên (tùy chọn)</label>
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: ưu tiên buổi chiều, cần liên hệ trước..."
            />
          </div>
        </section>

        <aside className="booking-summary">
          <h2>{selectedServiceSummary}</h2>

          <div className="summary-row">
            <span>Tổng giá dịch vụ</span>
            <strong>{formatVnd(totalPrice)}</strong>
          </div>

          <div className="summary-row">
            <span>Tổng thời lượng</span>
            <strong>{formatDurationLabel(totalDuration)}</strong>
          </div>

          <div className="summary-row">
            <span>Ngày đã chọn</span>
            <strong>{appointmentDate || 'Chưa chọn'}</strong>
          </div>

          <div className="summary-row">
            <span>Giờ đã chọn</span>
            <strong>{selectedSlotRangeLabel || 'Chưa chọn'}</strong>
          </div>

          <div className="summary-row">
            <span>Nhân viên</span>
            <strong>{selectedStaffName || 'Hệ thống tự sắp xếp'}</strong>
          </div>

          <div className="summary-services-card">
            <div className="summary-services-head">
              <strong>Danh sách dịch vụ</strong>
              <span>{selectedServices.length} mục</span>
            </div>
            <div className="summary-services-list">
              {selectedServices.map((service) => (
                <div key={service.id} className="summary-service-item">
                  <span>{service.name}</span>
                  <strong>{formatVnd(Number(service.price) || 0)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="voucher-picker-panel">
            <div className="voucher-picker-head">
              <div className="voucher-picker-title">
                <VoucherIcon className="voucher-picker-icon" />
                <strong>Voucher</strong>
              </div>
              <span>{loadingVouchers ? 'Đang tải voucher...' : `${usableVouchers.length} mã khả dụng`}</span>
            </div>

            <select
              value={selectedVoucherCode}
              onChange={(event) => setSelectedVoucherCode(event.target.value)}
              disabled={loadingVouchers || usableVouchers.length === 0}
            >
              <option value="">
                {usableVouchers.length === 0 ? 'Chưa có voucher khả dụng' : 'Không dùng voucher'}
              </option>
              {usableVouchers.map((voucher) => (
                <option key={voucher.assignment_id || voucher.id} value={voucher.code}>
                  {voucher.code} - {voucher.discount_label}
                </option>
              ))}
            </select>

            {selectedVoucherCode && validatingVoucher && (
              <small className="voucher-note">Đang kiểm tra voucher...</small>
            )}
            {selectedVoucherCode && voucherError && (
              <small className="voucher-note error">{voucherError}</small>
            )}
            {selectedVoucherCode && voucherPreview && !voucherError && (
              <small className="voucher-note success">
                Áp dụng {voucherPreview.voucher?.code}: giảm {formatVnd(voucherDiscount)}
              </small>
            )}
          </div>

          {voucherDiscount > 0 && (
            <div className="summary-row discount">
              <span>Voucher giảm</span>
              <strong>-{formatVnd(voucherDiscount)}</strong>
            </div>
          )}

          <div className="summary-row total">
            <span>Tạm tính thanh toán</span>
            <strong>{formatVnd(finalTotalPrice)}</strong>
          </div>

          {(loadingCancellationRisk || cancellationRisk) && (
            <div className={`cancellation-risk-panel risk-${cancellationRisk?.riskLevel || 'loading'}`}>
              <div className="cancellation-risk-head">
                <strong>AI chong boom lich</strong>
                <span>
                  {loadingCancellationRisk
                    ? 'Đang tính...'
                    : `${Number(cancellationRisk?.score || 0)}% - ${cancellationRisk?.riskLevel || 'low'}`}
                </span>
              </div>
              {depositRequired ? (
                <p>
                  Lịch này cần cọc {formatVnd(estimatedDepositAmount)} qua thanh toán online để giữ chỗ.
                </p>
              ) : (
                <p>Rủi ro hủy lịch thấp, có thể thanh toán linh hoạt tại salon.</p>
              )}
            </div>
          )}

          <div className="payment-method-panel">
            <div className="payment-method-head">
              <strong>Thanh toán</strong>
              <span>Hệ thống sẽ tạo payment record ngay sau khi lịch hẹn được tạo.</span>
            </div>

            {enabledPaymentOptions.map((option) => (
              <button
                key={option.method}
                type="button"
                className={[
                  'payment-option',
                  paymentMethod === option.method ? 'active' : '',
                  !option.enabled ? 'disabled' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setPaymentMethod(option.method)}
                disabled={!option.enabled}
              >
                <span className="payment-option-title">{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="summary-row">
            <span>Hình thức</span>
            <strong>{formatPaymentMethodLabel(paymentMethod)}</strong>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? isOnlinePayment
                ? 'Đang tạo giao dịch...'
                : 'Đang xử lý...'
              : isOnlinePayment
                ? paymentMethod === 'vnpay'
                  ? 'Đặt lịch và thanh toán online'
                  : `Đặt lịch và mở ${onlinePaymentLabel}`
                : 'Xác nhận đặt lịch'}
          </button>
        </aside>
      </form>
    </div>
  );
}

export default Booking;
