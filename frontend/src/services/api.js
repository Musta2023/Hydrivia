import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hydrivia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only clear token if the request was an authenticated API call, not the login endpoint itself
    const isLoginEndpoint = error.config && error.config.url && error.config.url.includes('/auth/login');
    if (error.response && error.response.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('hydrivia_token');
      localStorage.removeItem('hydrivia_user');
    }
    return Promise.reject(error);
  }
);

export default api;
