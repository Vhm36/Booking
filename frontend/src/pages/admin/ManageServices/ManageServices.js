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
  status: 'active'
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
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [imageInputKey, setImageInputKey] = useState(Date.now());
  const [categoryFormData, setCategoryFormData] = useState({ category_name: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [successMessage, setSuccessMessage] = useState('');
  const successTimerRef = useRef(null);

  const showSuccess = useCallback((msg) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMessage(msg);
    successTimerRef.current = setTimeout(() => setSuccessMessage(''), 2000);
  }, []);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    fetchServices();
    // Fetch categories for dropdown
    serviceService.getAllCategories().then(response => {
      setDbCategories(response.data.data || []);
    }).catch(err => {
      console.error('Không thể tải danh mục:', err);
    });
  }, []);

  const fetchServices = async () => {
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
  };

  
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setActionError('');
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingServiceId(null);
    setShowForm(false);
    setActionError('');
    setImageInputKey((prev) => prev + 1);
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: Number(formData.price),
      duration: Number(formData.duration),
      category: formData.category.trim(),
      status: formData.status,
      image_url: formData.image_url.trim(),
      image_data: formData.image_data
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

      resetForm();
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
    setShowForm(true);
    setActionError('');
    setFormData({
      name: service.name || '',
      description: service.description || '',
      price: String(Number(service.price) || ''),
      duration: String(Number(service.duration) || ''),
      category: service.category || 'Tóc',
      status: service.status || 'active',
      image_url: service.image_url || '',
      image_data: '',
      image_name: ''
    });
    setImageInputKey((prev) => prev + 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) {
      return;
    }

    try {
      setActionLoadingId(id);
      await serviceService.deleteService(id);
      setServices((prev) => prev.filter((service) => service.id !== id));
      if (editingServiceId === id) {
        resetForm();
      }
      setActionError('');
      showSuccess('Xóa dịch vụ thành công!');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Xóa dịch vụ thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCategoryInputChange = (event) => {
    const { name, value } = event.target;
    setCategoryFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetCategoryForm = () => {
    setCategoryFormData({ category_name: '' });
    setShowCategoryForm(false);
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    
    if (!categoryFormData.category_name.trim()) {
      setActionError('Vui lòng nhập tên danh mục.');
      return;
    }

    try {
      await serviceService.createCategory({ category_name: categoryFormData.category_name.trim() });
      resetCategoryForm();
      setActionError('');
      showSuccess('Tạo danh mục thành công!');
      // Refresh services to update dropdown
      fetchServices();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Tạo danh mục thất bại.');
    }
  };

  const previewImage = useMemo(
    () => resolveServiceImageUrl(formData.image_data || formData.image_url, FALLBACK_IMAGE),
    [formData.image_data, formData.image_url]
  );

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
      <section className="services-hero">
        <div className="services-hero-copy">
          <p className="services-hero-kicker">Admin</p>
          <h1>Quản lý dịch vụ</h1>
          <p className="services-page-note">
            Cập nhật danh mục, nội dung dịch vụ, hình ảnh và trạng thái hiển thị theo cùng một
            tông giao diện quản trị.
          </p>
        </div>

        <div className="button-group">
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="btn-primary"
          >
            {showForm ? 'Đóng form' : '+ Thêm dịch vụ mới'}
          </button>
          
          <button
            onClick={() => (showCategoryForm ? resetCategoryForm() : setShowCategoryForm(true))}
            className="btn-primary"
          >
            {showCategoryForm ? 'Đóng form danh mục' : '+ Thêm danh mục mới'}
          </button>

          <span className="services-summary-chip">{services.length} dịch vụ</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {showCategoryForm && (
        <div className="form-card category-form">
          <h3>Thêm danh mục mới</h3>
          <form onSubmit={handleCategorySubmit}>
            <div className="form-group">
              <label>Tên danh mục</label>
              <input
                type="text"
                name="category_name"
                value={categoryFormData.category_name}
                onChange={handleCategoryInputChange}
                placeholder="Nhập tên danh mục mới..."
                required
              />
            </div>

            <div className="action-group">
              <button type="submit" className="btn-success">
                Tạo danh mục
              </button>
              <button type="button" className="btn-neutral" onClick={resetCategoryForm}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3>{editingServiceId ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ mới'}</h3>
          <form onSubmit={handleSubmit}>
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
                <label>Giá (VND)</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Thời gian (phút)</label>
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
                  {dbCategories && dbCategories.map((category) => (
                    <option key={category.id} value={category.category_name}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
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
                      Bỏ ảnh đã chọn
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="image-preview-card">
              <div className="image-preview-text">
                <strong>Xem trước ảnh dịch vụ</strong>
                <span>
                  {formData.image_name
                    ? 'Đây là ảnh mới bạn vừa chọn từ máy tính.'
                    : formData.image_url
                      ? 'Đang dùng ảnh hiện tại của dịch vụ.'
                      : 'Nếu chưa chọn ảnh, hệ thống sẽ hiển thị ảnh mặc định.'}
                </span>
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

            <div className="form-group">
              <label>Trạng thái</label>
              <select name="status" value={formData.status} onChange={handleInputChange}>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ẩn</option>
              </select>
            </div>

            <div className="action-group">
              <button type="submit" className="btn-success">
                {editingServiceId ? 'Lưu cập nhật' : 'Tạo dịch vụ'}
              </button>
              {editingServiceId && (
                <button type="button" className="btn-neutral" onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <section className="services-table-shell">
        <div className="services-table-header">
          <div>
            <p className="services-table-kicker">Danh sách dịch vụ</p>
            <h2>Dịch vụ hiện có</h2>
          </div>
        </div>

        <div className="services-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Ảnh</th>
                <th>Tên dịch vụ</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    Chưa có dịch vụ nào.
                  </td>
                </tr>
              )}

              {services.map((service) => {
                const isBusy = actionLoadingId === service.id;

                return (
                  <tr key={service.id}>
                    <td>{service.id}</td>
                    <td>
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
                    </td>
                    <td>{service.name}</td>
                    <td>{service.category || '-'}</td>
                    <td>{`${Number(service.price || 0).toLocaleString('vi-VN')} VND`}</td>
                    <td>{service.duration} phút</td>
                    <td>
                      <span className={`status ${service.status}`}>
                        <span className="status-dot" aria-hidden="true" />
                        <span className="status-label">
                          {service.status === 'active' ? 'Hoạt động' : 'Tạm ẩn'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="action-group">
                        <button
                          onClick={() => startEditService(service)}
                          className="btn-edit btn-small"
                          disabled={isBusy}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(service.id)}
                          className="btn-danger btn-small"
                          disabled={isBusy}
                        >
                          {isBusy ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ManageServices;
