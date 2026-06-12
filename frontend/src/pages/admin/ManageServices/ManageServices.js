import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import serviceService from '../../../services/serviceService';
import { resolveServiceImageUrl } from '../../../utils/serviceImage';
import './ManageServices.css';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=500&q=80';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/jfif'];

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  duration: '',
  category: '',
  image_url: '',
  image_data: '',
  image_name: '',
  status: 'active',
  service_code: ''
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

const formatNumberWithDots = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return Number(clean).toLocaleString('vi-VN');
};

const formatDuration = (minutes) => {
  if (minutes === undefined || minutes === null || minutes === '') return '-';
  const mins = Number(minutes);
  if (Number.isNaN(mins) || mins <= 0) return '-';

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
    reader.readAsDataURL(file);
  });

function ManageServices() {
  const [services, setServices] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeComposer, setActiveComposer] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [imageInputKey, setImageInputKey] = useState(Date.now());
  const [categoryFormData, setCategoryFormData] = useState({ category_name: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [openMoreMenuId, setOpenMoreMenuId] = useState(null);
  const [recommendedServiceIds, setRecommendedServiceIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recommendedServiceIds') || '[]');
    } catch (err) {
      return [];
    }
  });

  const generateLocalServiceCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SVC-${result}`;
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [gridPageSize, setGridPageSize] = useState(4);
  const successTimerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1600) {
        setGridPageSize(6);
      } else if (width >= 1200) {
        setGridPageSize(5);
      } else {
        setGridPageSize(4);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSuccess = useCallback((message) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMessage(message);
    successTimerRef.current = setTimeout(() => setSuccessMessage(''), 2000);
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await serviceService.getAdminServices();
      setServices(response.data.data || []);
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách dịch vụ.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await serviceService.getAllCategories();
      setDbCategories(response.data.data || []);
    } catch (err) {
      console.error('Không thể tải danh mục:', err);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, [fetchCategories, fetchServices]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  /* ── Filtered + paginated data ── */
  const filteredServices = useMemo(() => {
    let result = services;
    if (selectedCategory !== 'all') {
      result = result.filter((s) => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.service_code && s.service_code.toLowerCase().includes(q)) ||
          (s.id && String(s.id).includes(q))
      );
    }
    return result;
  }, [services, searchQuery, selectedCategory]);

  const sortedServices = useMemo(() => {
    const direction = sortConfig.direction === 'desc' ? -1 : 1;
    const getSortValue = (service) => {
      if (sortConfig.key === 'price') return Number(service.price || 0);
      if (sortConfig.key === 'duration') return Number(service.duration || 0);
      if (sortConfig.key === 'status') return service.status === 'active' ? 1 : 0;
      return String(service[sortConfig.key] || '').toLowerCase();
    };

    return [...filteredServices].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      return String(valueA).localeCompare(String(valueB), 'vi') * direction;
    });
  }, [filteredServices, sortConfig]);

  const pageSize = viewMode === 'table' ? 18 : gridPageSize;
  const totalPages = Math.max(1, Math.ceil(sortedServices.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedServices = useMemo(
    () => sortedServices.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedServices, safePage, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, viewMode, pageSize]);

  useEffect(() => {
    if (!openMoreMenuId) return undefined;

    const closeMenu = () => setOpenMoreMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [openMoreMenuId]);

  useEffect(() => {
    setSelectedServiceIds((prev) =>
      prev.filter((id) => sortedServices.some((service) => String(service.id) === String(id)))
    );
  }, [sortedServices]);

  const isComposerOpen = Boolean(activeComposer);

  const resetServiceForm = () => {
    setFormData(EMPTY_FORM);
    setEditingServiceId(null);
    setImageInputKey((prev) => prev + 1);
  };

  const closeComposer = () => {
    setActiveComposer(null);
    setActionError('');
    setCategoryFormData({ category_name: '' });
    resetServiceForm();
  };

  const openNewServiceForm = () => {
    resetServiceForm();
    const autoCode = generateLocalServiceCode();
    setFormData((prev) => ({
      ...prev,
      service_code: autoCode
    }));
    setCategoryFormData({ category_name: '' });
    setActionError('');
    setActiveComposer('service');
  };

  const openCategoryComposer = () => {
    setCategoryFormData({ category_name: '' });
    setEditingServiceId(null);
    setActionError('');
    setActiveComposer('category');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setActionError('');
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePriceChange = (event) => {
    const { value } = event.target;
    const rawValue = value.replace(/\D/g, '');
    setActionError('');
    setFormData((prev) => ({
      ...prev,
      price: rawValue
    }));
  };

  const handlePriceBlur = () => {
    const rawVal = Number(formData.price);
    if (rawVal > 0 && rawVal < 10000) {
      const adjustedVal = rawVal * 1000;
      setFormData((prev) => ({
        ...prev,
        price: String(adjustedVal)
      }));
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setActionError('Vui lòng chọn ảnh JPG, PNG, GIF hoặc WEBP.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setActionError('Ảnh dịch vụ phải nhỏ hơn 5MB.');
      event.target.value = '';
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setFormData((prev) => ({
        ...prev,
        image_data: typeof imageData === 'string' ? imageData : '',
        image_name: file.name
      }));
      setActionError('');
    } catch (err) {
      setActionError(err.message || 'Không thể đọc file ảnh đã chọn.');
      event.target.value = '';
    }
  };

  const handleDirectImageUpload = async (serviceId, service, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setActionError('Vui lòng chọn ảnh JPG, PNG, GIF hoặc WEBP.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setActionError('Ảnh dịch vụ phải nhỏ hơn 5MB.');
      return;
    }

    try {
      setActionLoadingId(serviceId);
      const imageData = await readFileAsDataUrl(file);
      
      const payload = {
        name: service.name,
        description: service.description || '',
        price: Number(service.price),
        duration: Number(service.duration),
        category: service.category || '',
        status: service.status,
        image_url: service.image_url || '',
        image_data: typeof imageData === 'string' ? imageData : '',
        service_code: service.service_code || ''
      };

      await serviceService.updateService(serviceId, payload);
      showSuccess('Cập nhật ảnh dịch vụ thành công!');
      fetchServices();
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Tải ảnh lên thất bại.');
    } finally {
      setActionLoadingId(null);
      event.target.value = '';
    }
  };

  const clearSelectedImage = () => {
    setFormData((prev) => ({
      ...prev,
      image_data: '',
      image_name: ''
    }));
    setImageInputKey((prev) => prev + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    let finalPrice = Number(formData.price);
    if (finalPrice > 0 && finalPrice < 10000) {
      finalPrice = finalPrice * 1000;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: finalPrice,
      duration: Number(formData.duration),
      category: formData.category.trim(),
      status: formData.status,
      image_url: formData.image_url.trim(),
      image_data: formData.image_data,
      service_code: formData.service_code ? formData.service_code.trim() : ''
    };

    if (!payload.name || !Number.isFinite(payload.price) || !Number.isFinite(payload.duration)) {
      setActionError('Vui lòng nhập tên, giá và thời gian hợp lệ.');
      return;
    }

    if (payload.price < 0 || payload.duration <= 0) {
      setActionError('Giá và thời gian phải lớn hơn 0.');
      return;
    }

    try {
      if (editingServiceId) {
        await serviceService.updateService(editingServiceId, payload);
        showSuccess('Cập nhật dịch vụ thành công!');
      } else {
        await serviceService.createService(payload);
        showSuccess('Tạo dịch vụ thành công!');
      }

      closeComposer();
      fetchServices();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          (editingServiceId ? 'Cập nhật dịch vụ thất bại.' : 'Tạo dịch vụ thất bại.')
      );
    }
  };

  const startEditService = (service) => {
    setEditingServiceId(service.id);
    setActionError('');
    setFormData({
      name: service.name || '',
      description: service.description || '',
      price: String(Number(service.price) || ''),
      duration: String(Number(service.duration) || ''),
      category: service.category || '',
      status: service.status || 'active',
      image_url: service.image_url || '',
      image_data: '',
      image_name: '',
      service_code: service.service_code || generateLocalServiceCode()
    });
    setImageInputKey((prev) => prev + 1);
    setActiveComposer('service');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) return;

    try {
      setActionLoadingId(id);
      await serviceService.deleteService(id);
      setServices((prev) => prev.filter((service) => service.id !== id));
      if (editingServiceId === id) closeComposer();
      setActionError('');
      showSuccess('Xóa dịch vụ thành công!');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Xóa dịch vụ thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const selectedServiceIdSet = useMemo(
    () => new Set(selectedServiceIds.map((id) => String(id))),
    [selectedServiceIds]
  );
  const allPagedSelected =
    pagedServices.length > 0 && pagedServices.every((service) => selectedServiceIdSet.has(String(service.id)));
  const hasPagedSelection = pagedServices.some((service) => selectedServiceIdSet.has(String(service.id)));

  const toggleServiceSelection = (id) => {
    setSelectedServiceIds((prev) => {
      const normalizedId = String(id);
      if (prev.some((item) => String(item) === normalizedId)) {
        return prev.filter((item) => String(item) !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const toggleCurrentPageSelection = () => {
    setSelectedServiceIds((prev) => {
      const currentIds = pagedServices.map((service) => String(service.id));
      const currentIdSet = new Set(currentIds);
      const selectedCurrentPage = currentIds.every((id) => prev.some((item) => String(item) === id));

      if (selectedCurrentPage) {
        return prev.filter((id) => !currentIdSet.has(String(id)));
      }

      return [...new Set([...prev.map(String), ...currentIds])];
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleBulkStatus = async (status) => {
    const selectedServices = services.filter((service) => selectedServiceIdSet.has(String(service.id)));
    if (selectedServices.length === 0) return;

    const statusLabel = status === 'active' ? 'mở hoạt động' : 'tạm dừng';
    if (!window.confirm(`Bạn muốn ${statusLabel} ${selectedServices.length} dịch vụ đã chọn?`)) return;

    try {
      setActionLoadingId('bulk');
      await Promise.all(
        selectedServices.map((service) =>
          serviceService.updateService(service.id, {
            name: service.name,
            description: service.description || '',
            price: Number(service.price),
            duration: Number(service.duration),
            category: service.category || '',
            status,
            image_url: service.image_url || '',
            service_code: service.service_code || ''
          })
        )
      );
      setSelectedServiceIds([]);
      showSuccess(`Đã cập nhật ${selectedServices.length} dịch vụ.`);
      fetchServices();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể cập nhật hàng loạt.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = selectedServiceIds.map(String);
    if (selectedIds.length === 0) return;

    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} dịch vụ đã chọn?`)) return;

    try {
      setActionLoadingId('bulk');
      await Promise.all(selectedIds.map((id) => serviceService.deleteService(id)));
      setServices((prev) => prev.filter((service) => !selectedIds.includes(String(service.id))));
      setSelectedServiceIds([]);
      showSuccess(`Đã xóa ${selectedIds.length} dịch vụ.`);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Xóa hàng loạt thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const updateServiceStatus = async (service, status) => {
    try {
      setActionLoadingId(service.id);
      await serviceService.updateService(service.id, {
        name: service.name,
        description: service.description || '',
        price: Number(service.price),
        duration: Number(service.duration),
        category: service.category || '',
        status,
        image_url: service.image_url || '',
        service_code: service.service_code || ''
      });
      setOpenMoreMenuId(null);
      showSuccess(status === 'active' ? 'Đã kích hoạt lại dịch vụ.' : 'Đã tạm dừng dịch vụ.');
      fetchServices();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể đổi trạng thái dịch vụ.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const duplicateService = async (service) => {
    try {
      setActionLoadingId(service.id);
      await serviceService.createService({
        name: `${service.name} (bản sao)`,
        description: service.description || '',
        price: Number(service.price),
        duration: Number(service.duration),
        category: service.category || '',
        status: service.status || 'active',
        image_url: service.image_url || '',
        service_code: generateLocalServiceCode()
      });
      setOpenMoreMenuId(null);
      showSuccess('Đã nhân bản dịch vụ.');
      fetchServices();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể nhân bản dịch vụ.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleRecommendedService = (service) => {
    setRecommendedServiceIds((prev) => {
      const normalizedId = String(service.id);
      const next = prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId];
      localStorage.setItem('recommendedServiceIds', JSON.stringify(next));
      showSuccess(next.includes(normalizedId) ? 'Đã gắn nhãn đề xuất.' : 'Đã bỏ nhãn đề xuất.');
      return next;
    });
    setOpenMoreMenuId(null);
  };

  const openComingSoonAction = (message) => {
    setOpenMoreMenuId(null);
    setActionError(message);
  };

  const handleCategoryInputChange = (event) => {
    const { name, value } = event.target;
    setCategoryFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();

    if (!categoryFormData.category_name.trim()) {
      setActionError('Vui lòng nhập tên danh mục.');
      return;
    }

    try {
      await serviceService.createCategory({ category_name: categoryFormData.category_name.trim() });
      setCategoryFormData({ category_name: '' });
      setActionError('');
      showSuccess('Tạo danh mục thành công!');
      await fetchCategories();
      fetchServices();
      setActiveComposer(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Tạo danh mục thất bại.');
    }
  };

  const previewImage = useMemo(
    () => resolveServiceImageUrl(formData.image_data || formData.image_url, FALLBACK_IMAGE),
    [formData.image_data, formData.image_url]
  );

  const activeCount = useMemo(
    () => services.filter((service) => service.status === 'active').length,
    [services]
  );

  const renderStatus = (status) => (
    <span className={`status ${status}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{status === 'active' ? 'Hoạt động' : 'Tạm dừng'}</span>
    </span>
  );

  const renderServiceActions = (service) => {
    const isBusy = actionLoadingId === service.id;
    const isMenuOpen = String(openMoreMenuId) === String(service.id);
    const isRecommended = recommendedServiceIds.includes(String(service.id));

    return (
      <div className="action-group service-row-actions">
        <button
          type="button"
          onClick={() => startEditService(service)}
          className="btn-icon edit"
          title="Sửa dịch vụ"
          disabled={isBusy}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>

        <div className="more-action-wrap" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={`btn-icon more ${isMenuOpen ? 'active' : ''}`}
            title="Thêm thao tác"
            aria-label="Thêm thao tác"
            aria-expanded={isMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMoreMenuId(isMenuOpen ? null : service.id);
            }}
          >
            <span aria-hidden="true">•••</span>
          </button>

          {isMenuOpen && (
            <div className="service-more-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => updateServiceStatus(service, service.status === 'active' ? 'inactive' : 'active')}
                disabled={isBusy}
              >
                {service.status === 'active' ? 'Tạm dừng dịch vụ' : 'Kích hoạt lại'}
              </button>

              <button type="button" role="menuitem" onClick={() => toggleRecommendedService(service)}>
                {isRecommended ? 'Bỏ nhãn đề xuất' : 'Gắn nhãn đề xuất'}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => openComingSoonAction('Khuyến mãi nhanh cần kết nối bảng chiến dịch riêng cho từng dịch vụ.')}
              >
                Áp dụng giảm giá nhanh
              </button>

              <label className={`service-more-upload ${isBusy ? 'disabled' : ''}`}>
                Tải ảnh lên
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    handleDirectImageUpload(service.id, service, event);
                    setOpenMoreMenuId(null);
                  }}
                  disabled={isBusy}
                />
              </label>

              <button type="button" role="menuitem" onClick={() => duplicateService(service)} disabled={isBusy}>
                Sao chép dịch vụ
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => openComingSoonAction('Lịch sử đặt riêng theo dịch vụ sẽ được mở ở báo cáo chi tiết dịch vụ.')}
              >
                Xem lịch sử đặt
              </button>

              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setOpenMoreMenuId(null);
                  handleDelete(service.id);
                }}
                disabled={isBusy}
              >
                Xóa dịch vụ
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Pagination renderer ── */
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="svc-pagination">
        <button
          type="button"
          className="svc-page-btn"
          disabled={safePage <= 1}
          onClick={() => setCurrentPage(safePage - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>
        {start > 1 && (
          <>
            <button type="button" className="svc-page-btn" onClick={() => setCurrentPage(1)}>1</button>
            {start > 2 && <span className="svc-page-dots">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`svc-page-btn${p === safePage ? ' active' : ''}`}
            onClick={() => setCurrentPage(p)}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="svc-page-dots">…</span>}
            <button type="button" className="svc-page-btn" onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          type="button"
          className="svc-page-btn"
          disabled={safePage >= totalPages}
          onClick={() => setCurrentPage(safePage + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="manage-services">
      {successMessage && (
        <div className="success-toast-overlay">
          <div className="success-toast">
            <span className="success-toast-icon">✓</span>
            <span className="success-toast-text">{successMessage}</span>
          </div>
        </div>
      )}

      {isComposerOpen && (
        <div
          className="service-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}
        >
          <section className="service-composer" role="dialog" aria-modal="true" aria-labelledby="service-composer-title">
            <div className="service-composer-head">
              <div>
                <p className="service-composer-kicker">Thao tác nhanh</p>
                <h2 id="service-composer-title">
                  {activeComposer === 'category'
                    ? 'Thêm danh mục'
                    : editingServiceId
                      ? 'Cập nhật dịch vụ'
                      : 'Thêm dịch vụ'}
                </h2>
              </div>
              <button type="button" className="composer-close" onClick={closeComposer} aria-label="Đóng">
                ×
              </button>
            </div>

            <div className="composer-tabs" role="tablist" aria-label="Chọn loại thao tác">
              <button
                type="button"
                role="tab"
                aria-selected={activeComposer === 'service'}
                className={activeComposer === 'service' ? 'active' : ''}
                onClick={() => {
                  if (activeComposer !== 'service') openNewServiceForm();
                }}
              >
                <span aria-hidden="true">+</span>
                Dịch vụ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeComposer === 'category'}
                className={activeComposer === 'category' ? 'active' : ''}
                onClick={openCategoryComposer}
              >
                <span aria-hidden="true">+</span>
                Danh mục
              </button>
            </div>

            {actionError && <div className="alert alert-error composer-alert">{actionError}</div>}

            {activeComposer === 'category' ? (
              <form className="composer-form" onSubmit={handleCategorySubmit}>
                <div className="form-group">
                  <label>Tên danh mục</label>
                  <input
                    type="text"
                    name="category_name"
                    value={categoryFormData.category_name}
                    onChange={handleCategoryInputChange}
                    placeholder="Ví dụ: Chăm sóc da"
                    required
                  />
                </div>

                <div className="action-group composer-actions">
                  <button type="submit" className="btn-success">Tạo danh mục</button>
                  <button type="button" className="btn-neutral" onClick={closeComposer}>Hủy</button>
                </div>
              </form>
            ) : (
              <form className="composer-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tên dịch vụ</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mã dịch vụ</label>
                    <input
                      type="text"
                      name="service_code"
                      value={formData.service_code}
                      onChange={handleInputChange}
                      placeholder="Tự động tạo nếu để trống"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mô tả</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Giá (VNĐ)</label>
                    <input
                      type="text"
                      name="price"
                      value={formatNumberWithDots(formData.price)}
                      onChange={handlePriceChange}
                      onBlur={handlePriceBlur}
                      placeholder="Ví dụ: 1500 hoặc 1.500.000"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Thời gian (phút)
                      {formData.duration && (
                        <span style={{ marginLeft: '6px', color: 'var(--svc-teal)', fontSize: '12px', fontWeight: '500' }}>
                          (~ {formatDuration(formData.duration)})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Danh mục</label>
                    <select name="category" value={formData.category} onChange={handleInputChange}>
                      <option value="">Chọn danh mục</option>
                      {dbCategories.map((category) => (
                        <option key={category.id} value={category.category_name}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Tạm ẩn</option>
                    </select>
                  </div>
                </div>

                <div className="form-group image-upload-field">
                  <label>Ảnh dịch vụ</label>
                  <input
                    key={imageInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,.jfif"
                    onChange={handleImageChange}
                  />
                  <small className="field-hint">Chọn file từ máy tính, tối đa 5MB.</small>
                  {formData.image_name && (
                    <div className="selected-file-row">
                      <span className="selected-file-name">Đã chọn: {formData.image_name}</span>
                      <button type="button" className="btn-neutral btn-small" onClick={clearSelectedImage}>
                        Bỏ ảnh
                      </button>
                    </div>
                  )}
                </div>

                <div className="image-preview-strip">
                  <div className="image-preview-text">
                    <strong>Xem trước ảnh</strong>
                    <span>{formData.image_name ? 'Ảnh mới từ máy tính.' : 'Ảnh hiện tại hoặc ảnh mặc định.'}</span>
                  </div>
                  <img
                    src={previewImage}
                    alt={formData.name || 'Ảnh xem trước dịch vụ'}
                    className="service-preview-image"
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.src !== FALLBACK_IMAGE) {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }
                    }}
                  />
                </div>

                <div className="action-group composer-actions">
                  <button type="submit" className="btn-success">
                    {editingServiceId ? 'Lưu cập nhật' : 'Tạo dịch vụ'}
                  </button>
                  <button type="button" className="btn-neutral" onClick={closeComposer}>
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ── Compact top bar: title left, search + toggle + add right ── */}
      <header className="svc-topbar">
        <div className="svc-topbar-left">
          <h1>Quản lý dịch vụ</h1>
          <span className="svc-topbar-count">{filteredServices.length} dịch vụ · {activeCount} đang mở</span>
        </div>

        <div className="svc-topbar-right">
          <div className="svc-search-wrap">
            <svg className="svc-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="svc-search-input"
              placeholder="Tìm tên dịch vụ, danh mục…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="view-toggle" role="tablist" aria-label="Chế độ xem">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              Bảng
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              Lưới
            </button>
          </div>

          <button type="button" className="table-add-button" onClick={openNewServiceForm} aria-label="Thêm dịch vụ">
            +
          </button>
        </div>
      </header>

      {/* Category Quick Filter Chips */}
      <div className="svc-category-filters">
        <button
          type="button"
          className={`svc-category-chip${selectedCategory === 'all' ? ' active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          Tất cả
        </button>
        {dbCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`svc-category-chip${selectedCategory === cat.category_name ? ' active' : ''}`}
            onClick={() => setSelectedCategory(cat.category_name)}
          >
            {cat.category_name}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && !isComposerOpen && <div className="alert alert-error">{actionError}</div>}

      {/* ── Content area ── */}
      <section className="svc-content-shell">
        {viewMode === 'table' ? (
          <>
            {selectedServiceIds.length > 0 && (
              <div className="bulk-action-bar">
                <strong>{selectedServiceIds.length} dịch vụ đã chọn</strong>
                <div className="bulk-action-buttons">
                  <button type="button" onClick={() => handleBulkStatus('active')} disabled={actionLoadingId === 'bulk'}>
                    Mở hoạt động
                  </button>
                  <button type="button" onClick={() => handleBulkStatus('inactive')} disabled={actionLoadingId === 'bulk'}>
                    Tạm dừng
                  </button>
                  <button type="button" className="danger" onClick={handleBulkDelete} disabled={actionLoadingId === 'bulk'}>
                    Xóa đã chọn
                  </button>
                </div>
              </div>
            )}

            <div className="services-table">
              <table>
                <thead>
                  <tr>
                    <th className="select-cell">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả dịch vụ trong trang"
                        checked={allPagedSelected}
                        ref={(node) => {
                          if (node) node.indeterminate = hasPagedSelection && !allPagedSelected;
                        }}
                        onChange={toggleCurrentPageSelection}
                      />
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('name')}>
                        Dịch vụ <span>{getSortIndicator('name')}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('service_code')}>
                        Mã <span>{getSortIndicator('service_code')}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('category')}>
                        Danh mục <span>{getSortIndicator('category')}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('duration')}>
                        Thời gian <span>{getSortIndicator('duration')}</span>
                      </button>
                    </th>
                    <th className="price-cell">
                      <button type="button" className="sort-header align-right" onClick={() => handleSort('price')}>
                        Giá tiền <span>{getSortIndicator('price')}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('status')}>
                        Trạng thái <span>{getSortIndicator('status')}</span>
                      </button>
                    </th>
                    <th className="actions-cell">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedServices.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-cell">
                        {searchQuery ? 'Không tìm thấy dịch vụ phù hợp.' : 'Chưa có dịch vụ nào.'}
                      </td>
                    </tr>
                  )}

                  {pagedServices.map((service) => (
                    <tr key={service.id} className={selectedServiceIdSet.has(String(service.id)) ? 'selected' : ''}>
                      <td className="select-cell">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${service.name}`}
                          checked={selectedServiceIdSet.has(String(service.id))}
                          onChange={() => toggleServiceSelection(service.id)}
                        />
                      </td>
                      <td>
                        <div className="service-name-stack">
                          <img
                            src={resolveServiceImageUrl(service.image_url, FALLBACK_IMAGE)}
                            alt={service.name}
                            className="service-thumb"
                            loading="lazy"
                            onError={(event) => {
                              if (event.currentTarget.src !== FALLBACK_IMAGE) {
                                event.currentTarget.src = FALLBACK_IMAGE;
                              }
                            }}
                          />
                          <div className="service-name-copy">
                            <strong className="service-name-cell">{service.name}</strong>
                            {recommendedServiceIds.includes(String(service.id)) && (
                              <span className="recommend-mini-badge">Đề xuất</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {service.service_code ? (
                          <code className="service-code-text">{service.service_code}</code>
                        ) : (
                          <span className="empty-code">Chưa đặt mã</span>
                        )}
                      </td>
                      <td>
                        <span className="category-badge">{service.category || 'Chưa phân loại'}</span>
                      </td>
                      <td className="duration-cell">{formatDuration(service.duration)}</td>
                      <td className="price-cell">{formatVnd(service.price)}</td>
                      <td>{renderStatus(service.status)}</td>
                      <td className="actions-cell">{renderServiceActions(service)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        ) : (
          <>
            <div className={`services-grid cols-${gridPageSize}`}>
              {pagedServices.length === 0 ? (
                <div className="service-grid-empty">
                  {searchQuery ? 'Không tìm thấy dịch vụ phù hợp.' : 'Chưa có dịch vụ nào.'}
                </div>
              ) : (
                pagedServices.map((service) => (
                  <article key={service.id} className="service-grid-card">
                    <div className="service-grid-image-wrap">
                      <img
                        src={resolveServiceImageUrl(service.image_url, FALLBACK_IMAGE)}
                        alt={service.name}
                        loading="lazy"
                        onError={(event) => {
                          if (event.currentTarget.src !== FALLBACK_IMAGE) {
                            event.currentTarget.src = FALLBACK_IMAGE;
                          }
                        }}
                      />
                      <span className={`service-grid-status-badge ${service.status}`}>
                        {service.status === 'active' ? 'Hoạt động' : 'Tạm ẩn'}
                      </span>
                    </div>
                    <div className="service-grid-body">
                      <div className="service-grid-title">
                        <h3>{service.name}</h3>
                        {recommendedServiceIds.includes(String(service.id)) && (
                          <span className="recommend-mini-badge">Đề xuất</span>
                        )}
                        {service.service_code ? (
                          <span className="grid-code-pill">{service.service_code}</span>
                        ) : (
                          <span className="grid-code-pill muted">Chưa đặt mã</span>
                        )}
                      </div>

                      <div className="service-grid-quick-meta">
                        <span className="grid-category-pill">{service.category || 'Chưa phân loại'}</span>
                        <span className="grid-duration-text">{formatDuration(service.duration)}</span>
                      </div>

                      <div className="service-grid-price-row">
                        <span>Giá tiền</span>
                        <strong>{formatVnd(service.price)}</strong>
                      </div>
                      <div className="service-grid-footer">
                        {renderServiceActions(service)}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="svc-grid-bottom">
              <span className="svc-grid-count">{filteredServices.length} dịch vụ · {pagedServices.length} hiển thị</span>
              {renderPagination()}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default ManageServices;
