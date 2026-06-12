import React, { useState, useEffect, useRef } from 'react';
import authService from '../../services/authService';
import './Profile.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

const normalizeRoleName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getRoleLabel = (user) => {
  if (!user) return '';
  if (user.role === 'admin') return 'Quản trị viên';
  if (user.role === 'staff') {
    const staffRole = normalizeRoleName(user.staff_role_name);
    if (staffRole === 'thu ngan') return 'Thu ngân';
    return 'Nhân viên dịch vụ';
  }
  return 'Khách hàng';
};

const getAgeFromBirthday = (value) => {
  if (!value) return null;

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const formatBirthday = (value) => {
  if (!value) return 'Chưa cập nhật';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';

  const age = getAgeFromBirthday(value);
  const birthday = date.toLocaleDateString('vi-VN');
  return age ? `${birthday} (${age} tuổi)` : birthday;
};

const normalizeDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLoyaltyPoints = (user) =>
  Number(user?.loyalty_points ?? user?.reward_points ?? user?.points ?? user?.rfm_score ?? 0) || 0;

const getMembershipTier = (user) => {
  if (user?.membership_tier) return user.membership_tier;
  if (user?.customer_segment) return user.customer_segment;

  const points = getLoyaltyPoints(user);
  if (points >= 50) return 'Kim Cương';
  if (points >= 25) return 'Vàng';
  if (points >= 10) return 'Bạc';
  return 'Thân thiết';
};

function Profile({ user, setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  const hasProfileChanges =
    name !== (user?.name || '') ||
    email !== (user?.email || '') ||
    phone !== (user?.phone || '') ||
    dateOfBirth !== normalizeDateInputValue(user?.date_of_birth) ||
    gender !== (user?.gender || '');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setDateOfBirth(normalizeDateInputValue(user.date_of_birth));
      setGender(user.gender || '');
      setAvatarPreview(user.avatar ? `${API_URL}${user.avatar}` : null);
      setIsEditing(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    if (!user || user.created_at) {
      return () => {
        isMounted = false;
      };
    }

    const syncProfile = async () => {
      try {
        const response = await authService.getProfile();
        const profileUser = response.data?.data || response.data?.user;

        if (profileUser && isMounted) {
          const refreshedUser = { ...user, ...profileUser };
          const rememberMe = Boolean(localStorage.getItem('token'));
          authService.setUser(refreshedUser, rememberMe);
          setUser(refreshedUser);
        }
      } catch (err) {
        console.error('[PROFILE_SYNC_ERROR]', err);
      }
    };

    syncProfile();

    return () => {
      isMounted = false;
    };
  }, [user, setUser]);

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

    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    if (!hasProfileChanges) {
      setIsEditing(false);
      return;
    }

    setLoading(true);

    try {
      const profilePayload = {
        name,
        email,
        phone,
        date_of_birth: dateOfBirth || null,
        gender: gender || null
      };
      const response = await authService.updateProfile(profilePayload);
      const updatedUser = response.data?.data || { ...user, ...profilePayload };
      authService.setUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
      setSuccess('Lưu hồ sơ thành công!');
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset fields to original user values
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setDateOfBirth(normalizeDateInputValue(user?.date_of_birth));
    setGender(user?.gender || '');
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const initials = (user?.name || 'U').charAt(0).toUpperCase();

  const renderEditableField = ({
    label,
    type = 'text',
    value,
    onChange,
    required = false,
    children
  }) => {
    return (
      <div className={`form-group profile-edit-field ${isEditing ? 'is-editing' : ''}`}>
        <label>{label}</label>
        <div className="profile-input-shell">
          {children || (
            <input
              type={type}
              value={value}
              onChange={onChange}
              required={required}
              disabled={!isEditing || loading}
            />
          )}
        </div>
      </div>
    );
  };

  const loyaltyPoints = getLoyaltyPoints(user);
  const membershipTier = getMembershipTier(user);

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
          <button type="button" className="profile-avatar-action" onClick={() => fileInputRef.current?.click()}>
            Đổi ảnh
          </button>
        </div>

        <div className="profile-main">
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
              <span className="label">Ngày sinh</span>
              <span className="value">{formatBirthday(user?.date_of_birth)}</span>
            </div>
            <div className="info-item">
              <span className="label">Ngày tham gia</span>
              <span className="value">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('vi-VN')
                  : 'Chưa cập nhật'}
              </span>
            </div>
          </div>

          <div className="profile-loyalty" aria-label="Hạng thành viên và điểm tích lũy">
            <div className="loyalty-card">
              <span>Hạng thành viên</span>
              <strong>{membershipTier}</strong>
            </div>
            <div className="loyalty-card">
              <span>Ví điểm</span>
              <strong>{loyaltyPoints.toLocaleString('vi-VN')} điểm</strong>
            </div>
          </div>

          {/* ── Edit Form ── */}
          <form onSubmit={handleSubmit}>
            {renderEditableField({
              label: 'Họ tên',
              value: name,
              onChange: (e) => setName(e.target.value),
              required: true
            })}

            {renderEditableField({
              label: 'Email',
              type: 'email',
              value: email,
              onChange: (e) => setEmail(e.target.value),
              required: true
            })}

            {renderEditableField({
              label: 'Số điện thoại',
              type: 'tel',
              value: phone,
              onChange: (e) => setPhone(e.target.value)
            })}

            {renderEditableField({
              label: 'Ngày sinh',
              type: 'date',
              value: dateOfBirth,
              onChange: (e) => setDateOfBirth(e.target.value)
            })}

            {renderEditableField({
              label: 'Giới tính',
              value: gender,
              onChange: (e) => setGender(e.target.value),
              children: (
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={!isEditing || loading}
                >
                  <option value="">Chưa cập nhật</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              )
            })}

          <div className="profile-form-actions">
              <button type="submit" className="btn-primary" disabled={loading || uploadingAvatar}>
                {!isEditing ? 'Chỉnh sửa hồ sơ' : loading ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              {(isEditing || hasProfileChanges) && (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Hủy thay đổi
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Profile;
