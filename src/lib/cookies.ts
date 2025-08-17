// Cookie utility for secure token storage
export const cookies = {
  // Set a cookie with secure defaults
  set: (name: string, value: string, options: {
    expires?: number; // days
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
  } = {}) => {
    const {
      expires = 7, // 7 days default
      secure = true, // HTTPS only in production
      sameSite = 'strict',
      path = '/'
    } = options;

    const date = new Date();
    date.setTime(date.getTime() + (expires * 24 * 60 * 60 * 1000));

    const cookieValue = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=${path}; ${secure ? 'secure; ' : ''}samesite=${sameSite}`;
    document.cookie = cookieValue;
  },

  // Get a cookie value
  get: (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  },

  // Remove a cookie
  remove: (name: string, path: string = '/') => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
  },

  // Check if cookies are supported
  isSupported: (): boolean => {
    try {
      document.cookie = "test=1";
      const supported = document.cookie.indexOf("test=") !== -1;
      document.cookie = "test=1; expires=Thu, 01 Jan 1970 00:00:00 UTC";
      return supported;
    } catch {
      return false;
    }
  }
};

// Auth-specific cookie helpers
export const authCookies = {
  // Store auth token securely
  setAuthToken: (token: string) => {
    cookies.set('auth_token', token, { 
      expires: 30, // 30 days
      secure: true,
      sameSite: 'strict'
    });
  },

  // Get auth token
  getAuthToken: (): string | null => {
    return cookies.get('auth_token');
  },

  // Remove auth token
  removeAuthToken: () => {
    cookies.remove('auth_token');
  },

  // Store user data (non-sensitive)
  setUserData: (userData: any) => {
    cookies.set('user_data', JSON.stringify(userData), {
      expires: 30,
      secure: true,
      sameSite: 'strict'
    });
  },

  // Get user data
  getUserData: (): any => {
    const data = cookies.get('user_data');
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Remove user data
  removeUserData: () => {
    cookies.remove('user_data');
  },

  // Clear all auth-related cookies
  clearAll: () => {
    cookies.remove('auth_token');
    cookies.remove('user_data');
  }
};
