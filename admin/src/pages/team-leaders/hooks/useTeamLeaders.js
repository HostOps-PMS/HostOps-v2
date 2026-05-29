import { useState, useEffect, useCallback } from 'react';
import { getClients } from '../../clients/services/clientsService';

export function useTeamLeaders() {
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [clients, setClients]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getClients();
      setTeamLeaders(data.filter((u) => u.role === 'team_leader'));
      setClients(data.filter((u) => u.role === 'client'));
    } catch (err) {
      setError(err.message || 'Failed to load team leaders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { teamLeaders, clients, loading, error, refetch: fetch };
}
