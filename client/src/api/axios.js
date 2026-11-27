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

// Interceptor to attach JWT token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('illusory_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle responses and 401 unauthenticated redirects
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Something went wrong';
    
    // If unauthenticated and not on the login page, clear token
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('illusory_token');
    }

    return Promise.reject(new Error(message));
  }
);

export default api;

