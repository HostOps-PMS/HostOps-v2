import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../features/auth/services/authService';
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check user session on initial application load
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStorageItem('hp_access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await authService.getCurrentUser();
        setUser(response.user);
      } catch (err) {
        removeStorageItem('hp_access_token');
        removeStorageItem('hp_user');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    const { accessToken, user: userData } = data;
    
    setStorageItem('hp_access_token', accessToken);
    setStorageItem('hp_user', userData);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    return data;
  };

  const logout = () => {
    removeStorageItem('hp_access_token');
    removeStorageItem('hp_user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be utilized inside an AuthProvider');
  }
  return context;
};
