import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../../services/authService';
import '../Auth/Auth.css';

const getPostLoginPath = (user) => {
  if (user.role === 'admin') {
    return '/admin/dashboard';
  }

  if (user.role === 'staff') {
    return '/staff/dashboard';
  }

  return '/';
};

function ZaloCallback({ onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const codeVerifier = sessionStorage.getItem('zalo_code_verifier');

    if (!code) {
      setError('Không nhận được mã xác thực từ Zalo.');
      setLoading(false);
      return;
    }

    if (!codeVerifier) {
      setError('Không tìm thấy code verifier. Vui lòng thử đăng nhập lại.');
      setLoading(false);
      return;
    }

    const performLogin = async () => {
      try {
        const response = await authService.zaloLogin(code, codeVerifier);
        const { token, user } = response.data;

        authService.setToken(token);
        authService.setUser(user);

        // Xóa code verifier sau khi dùng
        sessionStorage.removeItem('zalo_code_verifier');

        const savedRedirect = sessionStorage.getItem('login_redirect');
        sessionStorage.removeItem('login_redirect');

        onLogin(user);

        if (savedRedirect && user.role === 'customer') {
          navigate(savedRedirect);
        } else {
          navigate(getPostLoginPath(user));
        }
      } catch (err) {
        console.error('[ZALO_CALLBACK_ERROR]', err);
        setError(err?.response?.data?.message || 'Đăng nhập Zalo thất bại. Vui lòng thử lại.');
        setLoading(false);
      }
    };

    performLogin();
  }, [searchParams, navigate, onLogin]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {loading ? (
          <>
            <div className="zalo-callback-spinner" />
            <p style={{ marginTop: 16, color: '#666' }}>Đang đăng nhập bằng Zalo...</p>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <p className="auth-link" style={{ marginTop: 16 }}>
              <a href="/login">Quay lại trang đăng nhập</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ZaloCallback;
