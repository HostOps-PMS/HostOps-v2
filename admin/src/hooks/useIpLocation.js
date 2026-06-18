import { useState, useEffect, useRef } from 'react';

const cache = {};
let rateLimited = false;

function isPublicIP(ip) {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(clean)) return false;
  if (/^172\.(6[4-9]|7[0-1])\./.test(clean)) return false;
  return true;
}

async function lookupIP(ip) {
  const clean = ip.replace(/^::ffff:/, '');
  if (cache[clean] !== undefined) return cache[clean];
  if (rateLimited) return null;
  try {
    const res = await fetch(`https://ipwho.is/${clean}`);
    if (res.status === 403 || res.status === 429) {
      rateLimited = true;
      setTimeout(() => { rateLimited = false; }, 60000);
      return null;
    }
    if (!res.ok) { cache[clean] = null; return null; }
    const data = await res.json();
    if (data.success === false) { cache[clean] = null; return null; }
    const loc = { city: data.city || '', country: data.country_code || '', region: data.region || '' };
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

    needed.forEach(ip => lookingUp.current.add(ip));

    let cancelled = false;
    (async () => {
      for (const ip of needed.slice(0, 10)) {
        if (cancelled || rateLimited) break;
        const loc = await lookupIP(ip);
        lookingUp.current.delete(ip);
        if (!cancelled && loc) {
          setLocations(prev => ({ ...prev, [ip]: loc }));
        }
        await new Promise(r => setTimeout(r, 500));
      }
    })();

    return () => { cancelled = true; };
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
