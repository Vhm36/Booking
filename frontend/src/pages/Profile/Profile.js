import React, { useState, useEffect, useRef } from 'react';
import authService from '../../services/authService';
import './Profile.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getRoleLabel = (user) => {
  if (!user) return '';
  if (user.role === 'admin') return 'Quản trị viên';
  if (user.role === 'staff') {
    const staffRole = (user.staff_role_name || '').trim().toLowerCase();
    if (staffRole === 'thu ngân') return 'Thu ngân';
    return 'Nhân viên dịch vụ';
  }
  return 'Khách hàng';
};

const getRoleBadgeClass = (role) => {
  if (role === 'admin') return 'role-badge-admin';
  if (role === 'staff') return 'role-badge-staff';
  return 'role-badge-customer';
};

function Profile({ user, setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAvatarPreview(user.avatar ? `${API_URL}${user.avatar}` : null);
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);

    // Upload
    setUploadingAvatar(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.uploadAvatar(file);
      const newAvatar = response.data.avatar;
      const updatedUser = { ...user, avatar: newAvatar };
      authService.setUser(updatedUser);
      setUser(updatedUser);
      setAvatarPreview(`${API_URL}${newAvatar}`);
      setSuccess('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      setError(err.response?.data?.message || 'Tải ảnh lên thất bại.');
      // Revert preview
      setAvatarPreview(user?.avatar ? `${API_URL}${user.avatar}` : null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authService.updateProfile(name, email, phone);
      const updatedUser = { ...user, name, email, phone };
      authService.setUser(updatedUser);
      setUser(updatedUser);
      setSuccess('Cập nhật hồ sơ thành công!');
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const initials = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* ── Avatar & Identity Header ── */}
        <div className="profile-identity">
          <div
            className="profile-avatar-wrap"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Thay đổi ảnh đại diện"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt={user?.name} className="profile-avatar" />
            ) : (
              <span className="profile-avatar-placeholder">{initials}</span>
            )}
            <span className="profile-avatar-overlay">
              {uploadingAvatar ? '...' : '📷'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="profile-avatar-input"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
            />
          </div>

          <div className="profile-identity-info">
            <h1>{user?.name || 'Người dùng'}</h1>
            <span className={`profile-role-badge ${getRoleBadgeClass(user?.role)}`}>
              {getRoleLabel(user)}
            </span>
            <p className="profile-email-display">{user?.email}</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ── Info Cards ── */}
        <div className="profile-info">
          <div className="info-item">
            <span className="label">ID</span>
            <span className="value">{user?.id}</span>
          </div>
          <div className="info-item">
            <span className="label">Vai trò</span>
            <span className="value">{getRoleLabel(user)}</span>
          </div>
          <div className="info-item">
            <span className="label">Ngày tham gia</span>
            <span className="value">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('vi-VN')
                : '--'}
            </span>
          </div>
        </div>

        {/* ── Edit Form ── */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Họ tên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || uploadingAvatar}>
            {loading ? 'Đang cập nhật...' : 'Cập nhật hồ sơ'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
