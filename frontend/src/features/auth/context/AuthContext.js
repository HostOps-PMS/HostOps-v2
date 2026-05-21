import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../../../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check user session on initial application load
  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('hp_access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await axiosClient.get('/auth/me');
        setUser(response.data.user);
      } catch (err) {
        sessionStorage.removeItem('hp_access_token');
        sessionStorage.removeItem('hp_user');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await axiosClient.post('/auth/login', { email, password });
    const { accessToken, user: userData } = response.data;
    
    sessionStorage.setItem('hp_access_token', accessToken);
    sessionStorage.setItem('hp_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await axiosClient.post('/auth/register', userData);
    return response.data;
  };

  const logout = () => {
    sessionStorage.removeItem('hp_access_token');
    sessionStorage.removeItem('hp_user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Unified custom hook exporter
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be utilized inside an AuthProvider');
  }
  return context;
};