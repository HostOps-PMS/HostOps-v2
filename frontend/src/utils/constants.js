/**
 * Application Constants
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'hp_access_token',
  USER: 'hp_user',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  NOT_FOUND: '*',
};
