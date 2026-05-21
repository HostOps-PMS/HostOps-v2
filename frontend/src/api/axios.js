import axios from 'axios';
import { getStorageItem } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for httpOnly session cookies/refresh tokens
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject Bearer Token if utilizing sessionStorage/localStorage
axiosClient.interceptors.request.use(
  (config) => {
    const token = getStorageItem('hp_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses to handle session expirations (401 errors)
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear local storage/state and redirect to login if session expires
      sessionStorage.removeItem('hp_access_token');
      sessionStorage.removeItem('hp_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;