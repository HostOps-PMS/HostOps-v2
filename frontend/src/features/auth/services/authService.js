import {
  loginRequest,
  registerRequest,
  forgotPasswordRequest,
  getCurrentUserRequest
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
};

export default authService;
