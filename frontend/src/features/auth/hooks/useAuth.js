import { useAuth as useGlobalAuth } from '../../../context/AuthContext';

export const useAuth = () => {
  return useGlobalAuth();
};

export default useAuth;
