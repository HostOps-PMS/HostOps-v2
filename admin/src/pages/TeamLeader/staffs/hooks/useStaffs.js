import { useState, useEffect, useCallback } from 'react';
import { fetchStaffs, fetchClientProperties } from '../../../Staffs/services/staffApi';

export function useStaffs(serverId) {
  const [staffs, setStaffs]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [propertyMap, setPropertyMap] = useState({});

  const loadStaffs = useCallback(async () => {
    if (!serverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchStaffs(serverId);
      const normalized = Array.isArray(data) ? data : (data?.staffs ?? data?.data ?? []);
      setStaffs(normalized);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadStaffs(); }, [loadStaffs]);

  // Fetch properties for the serverId
  useEffect(() => {
    if (!serverId) return;
    const fetchProps = async () => {
      try {
        const data = await fetchClientProperties(serverId);
        if (data.properties) {
          setPropertyMap((prev) => {
            const next = { ...prev };
            data.properties.forEach((p) => { next[String(p.id)] = p.propertyName; });
            return next;
          });
        }
      } catch { /* silent */ }
    };
    fetchProps();
  }, [serverId]);

  return { staffs, loading, error, propertyMap, reload: loadStaffs };
}
