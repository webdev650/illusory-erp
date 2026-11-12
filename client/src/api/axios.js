import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle responses and 401 unauthenticated redirects
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Something went wrong';
    
    // If unauthenticated and not on the login page, redirect
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // Clear any state if needed
    }

    return Promise.reject(new Error(message));
  }
);

export default api;

