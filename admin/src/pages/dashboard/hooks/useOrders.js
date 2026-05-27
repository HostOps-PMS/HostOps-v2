import { useState, useEffect } from 'react';

const MOCK_ORDERS = [
  { id: '10541', customer: 'Maria Santos',  product: 'Wireless Headphones', amount: '₱2,400', status: 'Completed',  date: 'May 27, 2025' },
  { id: '10540', customer: 'Juan dela Cruz',product: 'Mechanical Keyboard',  amount: '₱3,800', status: 'Processing', date: 'May 26, 2025' },
  { id: '10539', customer: 'Ana Reyes',     product: 'USB-C Hub',            amount: '₱1,100', status: 'Pending',    date: 'May 26, 2025' },
  { id: '10538', customer: 'Pedro Lim',     product: 'Monitor Stand',        amount: '₱890',   status: 'Cancelled',  date: 'May 25, 2025' },
  { id: '10537', customer: 'Rosa Garcia',   product: 'Webcam 1080p',         amount: '₱2,150', status: 'Completed',  date: 'May 25, 2025' },
  { id: '10536', customer: 'Carlo Mendoza', product: 'SSD 1TB',              amount: '₱4,500', status: 'Processing', date: 'May 24, 2025' },
];

/**
 * useOrders — fetches recent orders list.
 * Replace the mock timeout with a real API call via ordersService.
 */
export function useOrders() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // TODO: replace with → const data = await ordersService.getRecent();
        await new Promise((r) => setTimeout(r, 1200));
        if (!cancelled) setOrders(MOCK_ORDERS);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { orders, loading, error };
}
