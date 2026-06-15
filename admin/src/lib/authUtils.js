const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export const getToken = () =>
  sessionStorage.getItem('hp_access_token') ?? '';

export const authHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});

// For multipart/FormData — omits Content-Type so the browser sets the boundary
export const uploadHeaders = (extra = {}) => ({
  'x-api-key': API_KEY,
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});
