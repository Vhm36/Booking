export const COOKIE_CONSENT_COOKIE = 'booking_cookie_consent';
export const LOCATION_CONSENT_COOKIE = 'booking_location_consent';
export const USER_LOCATION_STORAGE_KEY = 'booking_user_location';

const DEFAULT_COOKIE_DAYS = 180;

export const setCookie = (name, value, days = DEFAULT_COOKIE_DAYS) => {
  if (typeof document === 'undefined') return;

  const safeDays = Number(days);
  const maxAge = Number.isFinite(safeDays) ? Math.max(1, Math.floor(safeDays)) * 24 * 60 * 60 : 0;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

export const getCookie = (name) => {
  if (typeof document === 'undefined') return '';

  const key = `${name}=`;
  const items = document.cookie.split(';');

  for (const rawItem of items) {
    const item = rawItem.trim();
    if (item.startsWith(key)) {
      return decodeURIComponent(item.slice(key.length));
    }
  }

  return '';
};

export const clearCookie = (name) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

export const saveUserLocation = (location) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch (error) {
    // Ignore storage errors.
  }
};

export const readUserLocation = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
      return null;
    }

    return {
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      accuracy: Number.isFinite(parsed.accuracy) ? Number(parsed.accuracy) : null,
      capturedAt: parsed.capturedAt || null
    };
  } catch (error) {
    return null;
  }
};

export const clearUserLocation = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
  } catch (error) {
    // Ignore storage errors.
  }
};
