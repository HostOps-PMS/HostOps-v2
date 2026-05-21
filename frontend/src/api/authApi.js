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
