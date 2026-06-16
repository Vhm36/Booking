const TAB_TOKEN_KEY = 'beautybook.auth.tab.token';
const TAB_USER_KEY = 'beautybook.auth.tab.user';
const TAB_INITIALIZED_KEY = 'beautybook.auth.tab.initialized';
const LEGACY_TOKEN_KEY = 'token';
const LEGACY_USER_KEY = 'user';

const getStorage = (type) => {
  if (typeof window === 'undefined') return null;
  return type === 'local' ? window.localStorage : window.sessionStorage;
};

const initializeTabAuth = () => {
  const session = getStorage('session');
  const local = getStorage('local');
  if (!session || !local || session.getItem(TAB_INITIALIZED_KEY) === '1') return;

  const token = session.getItem(LEGACY_TOKEN_KEY) || local.getItem(LEGACY_TOKEN_KEY);
  const user = session.getItem(LEGACY_USER_KEY) || local.getItem(LEGACY_USER_KEY);

  if (token) session.setItem(TAB_TOKEN_KEY, token);
  if (user) session.setItem(TAB_USER_KEY, user);
  session.removeItem(LEGACY_TOKEN_KEY);
  session.removeItem(LEGACY_USER_KEY);
  session.setItem(TAB_INITIALIZED_KEY, '1');
};

export const getAuthToken = () => {
  initializeTabAuth();
  return getStorage('session')?.getItem(TAB_TOKEN_KEY) || null;
};

export const getAuthUser = () => {
  initializeTabAuth();
  const rawUser = getStorage('session')?.getItem(TAB_USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    getStorage('session')?.removeItem(TAB_USER_KEY);
    return null;
  }
};

export const setAuthToken = (token, rememberMe = true) => {
  initializeTabAuth();
  const session = getStorage('session');
  const local = getStorage('local');
  if (!session || !local) return;

  if (!token) {
    session.removeItem(TAB_TOKEN_KEY);
    return;
  }

  session.setItem(TAB_TOKEN_KEY, token);
  if (rememberMe) local.setItem(LEGACY_TOKEN_KEY, token);
};

export const setAuthUser = (user, rememberMe = true) => {
  initializeTabAuth();
  const session = getStorage('session');
  const local = getStorage('local');
  if (!session || !local) return;

  if (!user) {
    session.removeItem(TAB_USER_KEY);
    return;
  }

  const serializedUser = JSON.stringify(user);
  session.setItem(TAB_USER_KEY, serializedUser);
  if (rememberMe) local.setItem(LEGACY_USER_KEY, serializedUser);
};

export const isAuthRemembered = () => {
  const token = getAuthToken();
  return Boolean(token && getStorage('local')?.getItem(LEGACY_TOKEN_KEY) === token);
};

export const clearAuthSession = ({ clearRemembered = true } = {}) => {
  initializeTabAuth();
  const session = getStorage('session');
  const local = getStorage('local');
  if (!session || !local) return;

  const currentToken = session.getItem(TAB_TOKEN_KEY);
  session.removeItem(TAB_TOKEN_KEY);
  session.removeItem(TAB_USER_KEY);
  session.removeItem(LEGACY_TOKEN_KEY);
  session.removeItem(LEGACY_USER_KEY);
  session.setItem(TAB_INITIALIZED_KEY, '1');

  if (clearRemembered && currentToken && local.getItem(LEGACY_TOKEN_KEY) === currentToken) {
    local.removeItem(LEGACY_TOKEN_KEY);
    local.removeItem(LEGACY_USER_KEY);
  }
};

export const startFreshAuthSession = () => {
  clearAuthSession({ clearRemembered: false });
};
