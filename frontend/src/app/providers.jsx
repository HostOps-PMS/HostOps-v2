import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

export default AppProviders;
