import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../../services/authService';
import '../Auth/Auth.css';

function PasswordToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c5.2 0 9 3.6 10 7.1a11.8 11.8 0 0 1-3.5 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.7 6.8A12 12 0 0 0 2 12c1 3.4 4.8 7 10 7a10.7 10.7 0 0 0 4-.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function getLoginErrorMessage(error) {
  if (!error.response) {
    return 'Không kết nối được tới máy chủ. Hãy kiểm tra backend có đang chạy không.';
  }

  const { status, data } = error.response;

  if (status === 429) {
    return 'Bạn đã đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút hoặc khởi động lại backend để xóa chặn tạm thời.';
  }
  if (status === 401) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (status === 400) {
    return data?.message || 'Vui lòng nhập đầy đủ email và mật khẩu.';
  }
  return data?.message || 'Đăng nhập thất bại.';
}

// ─── PKCE helpers cho Zalo OAuth ─────────────────────────────
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  const zaloAppId = process.env.REACT_APP_ZALO_APP_ID || '';
  const zaloCallbackUrl = process.env.REACT_APP_ZALO_CALLBACK_URL || '';

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    let cancelled = false;
    const scriptId = 'google-identity-script';
    const onGoogleCredential = async (response) => {
      if (!response?.credential) {
        setError('Không nhận được token Google hợp lệ.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const loginResponse = await authService.googleLogin(response.credential);
        const { token, user } = loginResponse.data;
        authService.setToken(token);
        authService.setUser(user);
        onLogin(user);

        if (user.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (user.role === 'staff') {
          navigate('/staff/customers');
        } else {
          navigate('/');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Đăng nhập Google thất bại.');
      } finally {
        setLoading(false);
      }
    };

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: onGoogleCredential
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'signin_with'
      });
      setGoogleReady(true);
    };

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      initializeGoogle();
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => setError('Không tải được Google Sign-In. Vui lòng thử lại.');
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, navigate, onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedEmail = email.trim();

    try {
      const response = await authService.login(normalizedEmail, password);
      const { token, user } = response.data;

      authService.setToken(token);
      authService.setUser(user);
      onLogin(user);

      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'staff') {
        navigate('/staff/customers');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleZaloLogin = async () => {
    if (!zaloAppId || !zaloCallbackUrl) return;

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Lưu code_verifier vào sessionStorage để dùng khi callback
      sessionStorage.setItem('zalo_code_verifier', codeVerifier);

      const zaloAuthUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${zaloAppId}&redirect_uri=${encodeURIComponent(zaloCallbackUrl)}&code_challenge=${codeChallenge}&state=zalo_login`;

      window.location.href = zaloAuthUrl;
    } catch (err) {
      console.error('[ZALO_PKCE_ERROR]', err);
      setError('Không thể khởi tạo đăng nhập Zalo.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Đăng nhập</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
            <label>Mật khẩu</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-link auth-link-inline">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>

        {(googleClientId || zaloAppId) && (
          <div className="social-login-block">
            <div className="social-login-divider">hoặc</div>

            {googleClientId && (
              <div className="google-login-block">
                <div ref={googleButtonRef} className="google-login-button" />
                {!googleReady && <p className="auth-link">Đang tải đăng nhập Google...</p>}
              </div>
            )}

            {zaloAppId && zaloCallbackUrl && (
              <button
                type="button"
                className="zalo-login-button"
                onClick={handleZaloLogin}
                disabled={loading}
              >
                <svg className="zalo-icon" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
                  <circle cx="24" cy="24" r="24" fill="#0068FF"/>
                  <path d="M12.5 17.8h8.8v1.5H14.7l6.5 9.2v1.7h-8.7v-1.5h6.4l-6.4-9.2v-1.7zm10.3 5.1c0-3.5 2.1-5.4 4.7-5.4 2.6 0 4.7 1.9 4.7 5.4 0 3.5-2.1 5.5-4.7 5.5-2.6 0-4.7-2-4.7-5.5zm1.7 0c0 2.5 1.2 4 3 4s3-1.5 3-4c0-2.4-1.2-3.9-3-3.9s-3 1.5-3 3.9z" fill="#fff"/>
                </svg>
                Đăng nhập bằng Zalo
              </button>
            )}
          </div>
        )}

        <p className="auth-link">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;