import React, { useEffect, useMemo, useState } from 'react';
import serviceService from '../../services/serviceService';
import { resolveServiceImageUrl } from '../../utils/serviceImage';
import './ManageServices.css';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=500&q=80';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  duration: '',
  category: 'Tóc',
  status: 'active',
  image_url: '',
  image_data: '',
  image_name: ''
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    fetchServices();
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
      } else {
        await serviceService.createService(payload);
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
    } catch (err) {
      setActionError(err.response?.data?.message || 'Xóa dịch vụ thất bại.');
    } finally {
      setActionLoadingId(null);
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
      <h1>Quản lý dịch vụ</h1>

      <button
        onClick={() => (showForm ? resetForm() : setShowForm(true))}
        className="btn-primary"
      >
        {showForm ? 'Đóng form' : '+ Thêm dịch vụ mới'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

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
                  <option value="Tóc">Tóc</option>
                  <option value="Móng">Móng</option>
                  <option value="Chăm sóc da">Chăm sóc da</option>
                  <option value="Massage">Massage</option>
                  <option value="Mi & Mày">Mi & Mày</option>
                  <option value="Trang điểm">Trang điểm</option>
                </select>
              </div>

              <div className="form-group image-upload-field">
                <label>Ảnh dịch vụ</label>
                <input
                  key={imageInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
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
                      {service.status === 'active' ? 'Đang hoạt động' : 'Tạm ẩn'}
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
    </div>
  );
}

export default ManageServices;