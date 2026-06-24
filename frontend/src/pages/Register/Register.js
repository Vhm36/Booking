import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/authService';
import '../Auth/Auth.css';

function PasswordToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 3l18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10.6 10.7a2 2 0 0 0 2.7 2.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c5.2 0 9 3.6 10 7.1a11.8 11.8 0 0 1-3.5 4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.7 6.8A12 12 0 0 0 2 12c1 3.4 4.8 7 10 7a10.7 10.7 0 0 0 4-.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const getTodayDateInputValue = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const getAgeFromBirthday = (dateValue) => {
  if (!dateValue) return null;

  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRequirements = {
    minLength: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password)
  };

  const passwordValid =
    passwordRequirements.minLength &&
    passwordRequirements.hasLetter &&
    passwordRequirements.hasNumber;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const todayDateValue = getTodayDateInputValue();

  const submitLabel = loading ? 'Đang xử lý...' : 'Đăng ký';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Bạn còn thiếu Họ tên. Vui lòng nhập đầy đủ.');
      return;
    }

    if (!email.trim()) {
      setError('Bạn còn thiếu Email. Vui lòng nhập đầy đủ.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Bạn đang nhập sai định dạng Email. Bạn cần nhập lại nếu sai.');
      return;
    }

    if (!dateOfBirth) {
      setError('Bạn còn thiếu Ngày sinh. Vui lòng nhập đầy đủ.');
      return;
    }

    const age = getAgeFromBirthday(dateOfBirth);
    if (age === null || dateOfBirth >= todayDateValue || age < 13 || age > 100) {
      setError('Ngày sinh không hợp lệ. Tuổi đăng ký phải từ 13 đến 100.');
      return;
    }

    if (!password) {
      setError('Bạn còn thiếu Mật khẩu. Vui lòng nhập đầy đủ.');
      return;
    }

    if (!passwordValid) {
      setError('Mật khẩu chưa đủ yêu cầu. Bạn cần nhập lại nếu sai.');
      return;
    }

    if (!confirmPassword) {
      setError('Bạn còn thiếu phần Nhập lại mật khẩu. Vui lòng nhập đầy đủ.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Bạn cần nhập lại nếu sai.');
      return;
    }

    if (phone && !/^[0-9]{9,11}$/.test(phone)) {
      setError('Số điện thoại không hợp lệ. Bạn cần nhập lại nếu sai.');
      return;
    }

    setLoading(true);

    try {
      await authService.register(name, email, password, phone, dateOfBirth);

      // Auto login sau khi đăng ký
      const loginRes = await authService.login(email, password);
      const token = loginRes.data.data ? loginRes.data.data.token : loginRes.data.token;
      
      authService.setToken(token, true);
      
      const profileRes = await authService.getProfile();
      const user = profileRes.data.data || profileRes.data.user;
      authService.setUser(user, true);

      setSuccess('Đăng ký thành công! Đang tự động đăng nhập...');

      // Chờ 1 giây rồi tải lại trang để update state hoặc chuyển hướng
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.errors && responseData.errors.length > 0) {
        const errorDetails = responseData.errors.map(e => e.message).join(' và ');
        setError(`${responseData.message}: ${errorDetails}`);
      } else {
        setError(responseData?.message || 'Đăng ký thất bại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Đăng ký</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Họ tên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Ngày sinh</label>
            <input
              type="date"
              value={dateOfBirth}
              max={todayDateValue}
              autoComplete="bday"
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                <PasswordToggleIcon visible={showPassword} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Nhập lại mật khẩu</label>
            <div className="password-input-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'}
                aria-pressed={showConfirmPassword}
              >
                <PasswordToggleIcon visible={showConfirmPassword} />
              </button>
            </div>
            {confirmPassword && (
              <div className={`field-hint ${passwordsMatch ? 'success' : 'error'}`}>
                {passwordsMatch ? 'Mật khẩu đã khớp.' : 'Mật khẩu nhập lại chưa khớp.'}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {submitLabel}
          </button>
        </form>

        <p className="auth-link">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
