// src/pages/clientAccount/hooks/useClientAccounts.js
// ─────────────────────────────────────────────────────────────────
// Mirrors useStaffs.js: fetches all client accounts + parent clients
// list. Optionally filters by parentClientId.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchClientAccounts,
  fetchClients,
  fetchClientProperties,
} from '../services/clientAccountService';

export function useClientAccounts(filterParentClientId = '') {
  const [accounts, setAccounts]     = useState([]);
  const [clients, setClients]       = useState([]);
  const [propertyMap, setPropertyMap] = useState({}); // { [clientId]: [{ id, name }] }
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const loadedPropertyIds           = useRef(new Set());

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsData, clientsData] = await Promise.all([
        fetchClientAccounts(filterParentClientId),
        fetchClients(),
      ]);

      const accountsList = Array.isArray(accountsData) ? accountsData : [];
      const clientsList  = Array.isArray(clientsData)  ? clientsData  : [];

      setAccounts(accountsList);
      setClients(clientsList);

      // Collect unique parentClientIds from accounts to pre-load their property lists
      const uniqueClientIds = [
        ...new Set(accountsList.map((a) => String(a.parentClientId)).filter(Boolean)),
      ];

      const newMap = { ...propertyMap };
      await Promise.all(
        uniqueClientIds
          .filter((id) => !loadedPropertyIds.current.has(id))
          .map(async (id) => {
            loadedPropertyIds.current.add(id);
            try {
              const data = await fetchClientProperties(id);
              newMap[id] = data.properties || [];
            } catch {
              newMap[id] = [];
            }
          })
      );
      setPropertyMap(newMap);
    } catch (err) {
      setError(err.message || 'Failed to load client accounts');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParentClientId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return {
    accounts,
    clients,
    propertyMap,
    loading,
    error,
    reload: loadAccounts,
  };
}
