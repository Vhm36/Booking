import React, { useCallback, useEffect, useState } from 'react';
import {
  COOKIE_CONSENT_COOKIE,
  LOCATION_CONSENT_COOKIE,
  clearUserLocation,
  getCookie,
  readUserLocation,
  saveUserLocation,
  setCookie
} from '../utils/consent';
import './ConsentBanner.css';

function ConsentBanner({ onLocationChange }) {
  const [visible, setVisible] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);

  const emitLocation = useCallback(
    (location) => {
      if (typeof onLocationChange === 'function') {
        onLocationChange(location);
      }
    },
    [onLocationChange]
  );

  const requestLocation = useCallback(
    (showErrorMessage = false) => {
      if (!navigator?.geolocation) {
        if (showErrorMessage) {
          window.alert('Trình duyệt không hỗ trợ định vị.');
        }
        emitLocation(null);
        return;
      }

      setRequestingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude),
            accuracy: Number(position.coords.accuracy),
            capturedAt: new Date().toISOString()
          };
          saveUserLocation(nextLocation);
          emitLocation(nextLocation);
          setRequestingLocation(false);
        },
        () => {
          clearUserLocation();
          emitLocation(null);
          setRequestingLocation(false);
          if (showErrorMessage) {
            window.alert('Bạn chưa cấp quyền vị trí. Có thể bật lại trong cài đặt trình duyệt.');
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000
        }
      );
    },
    [emitLocation]
  );

  useEffect(() => {
    const storedLocation = readUserLocation();
    if (storedLocation) {
      emitLocation(storedLocation);
    }

    const cookieConsent = getCookie(COOKIE_CONSENT_COOKIE);
    const locationConsent = getCookie(LOCATION_CONSENT_COOKIE);

    if (!cookieConsent || !locationConsent) {
      setVisible(true);
      return;
    }

    if (locationConsent === 'accepted') {
      requestLocation(false);
    }
  }, [emitLocation, requestLocation]);

  const acceptAllCookies = () => {
    setCookie(COOKIE_CONSENT_COOKIE, 'accepted');
    setCookie(LOCATION_CONSENT_COOKIE, 'accepted');
    setVisible(false);
    requestLocation(true);
  };

  const acceptEssentialCookies = () => {
    setCookie(COOKIE_CONSENT_COOKIE, 'accepted');
    setCookie(LOCATION_CONSENT_COOKIE, 'declined');
    clearUserLocation();
    emitLocation(null);
    setVisible(false);
  };

  const rejectAll = () => {
    setCookie(COOKIE_CONSENT_COOKIE, 'declined');
    setCookie(LOCATION_CONSENT_COOKIE, 'declined');
    clearUserLocation();
    emitLocation(null);
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="consent-banner" role="dialog" aria-live="polite">
      <div className="consent-banner-content">
        <h3>Quản lý cookie</h3>
        <p>
          Chúng tôi sử dụng cookie cho các mục đích thiết yếu để vận hành trang web. Bạn có thể cho
          phép tất cả cookie, hoặc chọn cài đặt cookie để chỉ dùng cookie cần thiết. Khi bạn đồng ý,
          hệ thống mới xin quyền vị trí để gợi ý cơ sở phù hợp.
        </p>
      </div>

      <div className="consent-banner-actions">
        <button type="button" className="btn-primary" onClick={acceptAllCookies}>
          {requestingLocation ? 'Đang lấy vị trí...' : 'Cho phép tất cả cookie'}
        </button>
        <button type="button" className="consent-secondary-btn" onClick={acceptEssentialCookies}>
          Cài đặt cookie
        </button>
        <button type="button" className="consent-text-btn" onClick={rejectAll}>
          Không đồng ý
        </button>
      </div>
    </div>
  );
}

export default ConsentBanner;
