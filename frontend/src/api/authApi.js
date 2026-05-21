import axiosClient from './axios';

export const loginRequest = async (email, password) => {
  const response = await axiosClient.post('/auth/login', { email, password });
  return response.data;
};

export const registerRequest = async (userData) => {
  const response = await axiosClient.post('/auth/register', userData);
  return response.data;
};

export const forgotPasswordRequest = async (email) => {
  const response = await axiosClient.post('/auth/forgot-password', { email });
  return response.data;
};

export const getCurrentUserRequest = async () => {
  const response = await axiosClient.get('/auth/me');
  return response.data;
};

export const resetPasswordRequest = async (email, token, newPassword) => {
  const response = await axiosClient.post('/auth/reset-password', { email, token, newPassword });
  return response.data;
};

export const verifyEmailRequest = async (email, token) => {
  const response = await axiosClient.post('/auth/verify', { email, token });
  return response.data;
};
