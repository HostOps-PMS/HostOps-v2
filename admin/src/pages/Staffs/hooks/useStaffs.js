import { useState, useEffect, useCallback } from 'react';
import { fetchStaffs, fetchClients, fetchClientProperties } from '../services/staffApi';

export function useStaffs(filterClient) {
  const [staffs, setStaffs]       = useState([]);
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [propertyMap, setPropertyMap] = useState({});

  const loadStaffs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStaffs(filterClient);
      setStaffs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterClient]);

  const loadClients = useCallback(async () => {
    try {
      const data = await fetchClients();
      setClients(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { loadStaffs();  }, [loadStaffs]);

  // Fetch property names for all clients referenced in the current staff list
  useEffect(() => {
    const clientIds = [...new Set(staffs.map((s) => String(s.clientId?._id || s.clientId)))];
    clientIds.forEach(async (clientId) => {
      try {
        const data = await fetchClientProperties(clientId);
        if (data.properties) {
          setPropertyMap((prev) => {
            const next = { ...prev };
            data.properties.forEach((p) => { next[String(p.id)] = p.propertyName; });
            return next;
          });
        }
      } catch { /* silent */ }
    });
  }, [staffs]);

  return {
    staffs,
    clients,
    loading,
    error,
    propertyMap,
    reload: loadStaffs,
  };
}