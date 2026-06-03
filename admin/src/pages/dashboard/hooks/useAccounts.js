import { useState, useEffect, useCallback } from 'react';
import { getClients } from '../../clients/services/clientsService';
import { fetchStaffs } from '../../Staffs/services/staffApi';

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsRes, staffsRes] = await Promise.allSettled([
        getClients(),
        fetchStaffs()
      ]);

      const allAccounts = [];

      if (clientsRes.status === 'fulfilled') {
        const raw = clientsRes.value;
        const clientsData = Array.isArray(raw) ? raw : (raw?.data || raw?.users || []);
        clientsData.forEach(client => {
          let st = client.status;
          if (!st) st = client.isVerified ? 'verified' : 'unverified';
          
          allAccounts.push({
            id: client._id || client.id || Math.random().toString(),
            email: client.email || 'No email',
            role: client.role || 'client',
            status: st,
            verificationStatus: client.isVerified ? 'Verified' : 'Unverified',
            createdAt: client.createdAt || new Date().toISOString(),
            lastLogin: client.lastLogin || client.lastLoginAt || null,
            failedLoginAttempts: client.failedLoginAttempts || 0,
            firstName: client.businessName || client.firstName, // fallback
            lastName: client.lastName || '',
            originalData: client,
            source: 'client'
          });
        });
      }

      if (staffsRes.status === 'fulfilled') {
        const raw = staffsRes.value;
        const staffsData = Array.isArray(raw) ? raw : (raw?.data || raw?.staffs || []);
        staffsData.forEach(staff => {
          let st = staff.status;
          if (!st) st = staff.isActive !== false ? 'verified' : 'locked';
          
          allAccounts.push({
            id: staff._id || staff.id || Math.random().toString(),
            email: staff.email || 'No email',
            role: 'staff',
            status: st,
            verificationStatus: 'Verified',
            createdAt: staff.createdAt || new Date().toISOString(),
            lastLogin: staff.lastLogin || staff.lastLoginAt || null,
            failedLoginAttempts: staff.failedLoginAttempts || 0,
            firstName: staff.firstName || '',
            lastName: staff.lastName || '',
            originalData: staff,
            source: 'staff'
          });
        });
      }

      setAccounts(allAccounts);

      if (clientsRes.status === 'rejected' && staffsRes.status === 'rejected') {
        throw new Error('Failed to fetch both clients and staffs. ' + clientsRes.reason?.message);
      }
    } catch (err) {
      setError(err.message || 'Error fetching accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, loading, error, refetch: fetchAccounts };
}
