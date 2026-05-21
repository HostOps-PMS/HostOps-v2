import {
  loginRequest,
  registerRequest,
  forgotPasswordRequest,
  getCurrentUserRequest,
  resetPasswordRequest,
  verifyEmailRequest
} from '../../../api/authApi';

export const authService = {
  login: async (email, password) => {
    return await loginRequest(email, password);
  },

  register: async (userData) => {
    return await registerRequest(userData);
  },

  forgotPassword: async (email) => {
    return await forgotPasswordRequest(email);
  },

  getCurrentUser: async () => {
    return await getCurrentUserRequest();
  },

  resetPassword: async (email, token, newPassword) => {
    return await resetPasswordRequest(email, token, newPassword);
  },

  verifyEmail: async (email, token) => {
    return await verifyEmailRequest(email, token);
  },
};

export default authService;
