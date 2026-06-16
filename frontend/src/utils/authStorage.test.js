import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  setAuthToken,
  setAuthUser,
  startFreshAuthSession
} from './authStorage';

describe('tab-scoped authentication storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('keeps a remembered account while a fresh tab uses another account', () => {
    setAuthToken('token-a', true);
    setAuthUser({ id: 1, name: 'Khách A' }, true);

    startFreshAuthSession();
    setAuthToken('token-b', false);
    setAuthUser({ id: 2, name: 'Khách B' }, false);

    expect(getAuthToken()).toBe('token-b');
    expect(getAuthUser()).toEqual({ id: 2, name: 'Khách B' });
    expect(localStorage.getItem('token')).toBe('token-a');

    clearAuthSession();
    expect(localStorage.getItem('token')).toBe('token-a');
  });
});
