import axios from 'axios';

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api/v1';
  return envUrl.endsWith('/api/v1') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api/v1`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor with silent background refresh
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    const errorCode = errorData?.code;

    // Handle mandatory password change requirement from server
    if (statusCode === 403 && errorCode === 'PASSWORD_CHANGE_REQUIRED') {
      if (!window.location.pathname.includes('/change-password')) {
        window.location.href = '/change-password';
      }
      return Promise.reject(new Error(errorData?.message || 'Password change required'));
    }

    // Handle 401 unauthenticated with silent background refresh
    if (statusCode === 401 && !originalRequest._retry) {
      const isAuthRoute =
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh-token') ||
        originalRequest.url?.includes('/auth/logout');

      if (isAuthRoute) {
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        const message = errorData?.message || error.message || 'Authentication failed';
        return Promise.reject(new Error(message));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh-token');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      (Array.isArray(errorData?.errors) && errorData.errors.length > 0
        ? errorData.errors.join(', ')
        : errorData?.message) ||
      error.message ||
      'Something went wrong';

    const customError = new Error(message);
    customError.code = errorCode;
    customError.status = statusCode;
    customError.data = errorData;

    return Promise.reject(customError);
  }
);

export default api;

