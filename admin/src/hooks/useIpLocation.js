import { useState, useEffect, useRef } from 'react';

const cache = {};
let rateLimited = false;

function isPublicIP(ip) {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(clean)) return false;
  // Carrier-grade NAT 100.64.0.0/10 (100.64.x.x – 100.127.x.x) is not routable.
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(clean)) return false;
  return true;
}

const APIS = [
  { url: ip => `https://ipapi.co/${ip}/json/`, parse: d => d.error ? null : { city: d.city || '', country: d.country_code || '', region: d.region || '' } },
  { url: ip => `https://freeipapi.com/api/json/${ip}`, parse: d => ({ city: d.cityName || '', country: d.countryCode || '', region: d.regionName || '' }) },
];
let apiIndex = 0;

async function lookupIP(ip) {
  const clean = ip.replace(/^::ffff:/, '');
  if (cache[clean] !== undefined) return cache[clean];
  if (rateLimited) return null;
  const api = APIS[apiIndex];
  try {
    const res = await fetch(api.url(clean));
    if (res.status === 403 || res.status === 429) {
      apiIndex = (apiIndex + 1) % APIS.length;
      rateLimited = true;
      setTimeout(() => { rateLimited = false; }, 30000);
      return null;
    }
    if (!res.ok) { cache[clean] = null; return null; }
    const data = await res.json();
    const loc = api.parse(data);
    cache[clean] = loc;
    return loc;
  } catch {
    cache[clean] = null;
    return null;
  }
}

export function useIpLocations(ips = []) {
  const [locations, setLocations] = useState({});
  const lookingUp = useRef(new Set());

  useEffect(() => {
    if (rateLimited) return;
    const publicIPs = [...new Set(ips.filter(isPublicIP).map(ip => ip.replace(/^::ffff:/, '')))];
    const needed = publicIPs.filter(ip => cache[ip] === undefined && !lookingUp.current.has(ip));

    // Apply cached results immediately
    const cached = {};
    publicIPs.forEach(ip => { if (cache[ip]) cached[ip] = cache[ip]; });
    if (Object.keys(cached).length > 0) setLocations(prev => ({ ...prev, ...cached }));

    if (needed.length === 0) return;

    // Only IPs actually fetched in this run are marked as in-flight; the rest
    // (beyond the 10-per-run cap, or left over when the run stops early) stay
    // eligible for the next run instead of being skipped forever.
    const batch = needed.slice(0, 10);
    batch.forEach(ip => lookingUp.current.add(ip));
    const pending = new Set(batch);
    const releasePending = () => pending.forEach(ip => lookingUp.current.delete(ip));

    let cancelled = false;
    (async () => {
      for (const ip of batch) {
        if (cancelled || rateLimited) break;
        pending.delete(ip);
        const loc = await lookupIP(ip);
        lookingUp.current.delete(ip);
        if (!cancelled && loc) {
          setLocations(prev => ({ ...prev, [ip]: loc }));
        }
        await new Promise(r => setTimeout(r, 500));
      }
      releasePending();
    })();

    return () => { cancelled = true; releasePending(); };
  }, [ips.join(',')]);

  return locations;
}

export function formatLocation(ip, locations) {
  if (!locations) return null;
  const clean = (ip || '').replace(/^::ffff:/, '');
  const loc = locations[clean];
  if (!loc) return null;
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.country) return loc.country;
  return null;
}
