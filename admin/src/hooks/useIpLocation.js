import { useState, useEffect, useRef } from 'react';

const cache = {};

function isPublicIP(ip) {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(clean)) return false;
  return true;
}

async function lookupIP(ip) {
  const clean = ip.replace(/^::ffff:/, '');
  if (cache[clean]) return cache[clean];
  try {
    const res = await fetch(`https://ipwho.is/${clean}`);
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
    const publicIPs = [...new Set(ips.filter(isPublicIP).map(ip => ip.replace(/^::ffff:/, '')))];
    const needed = publicIPs.filter(ip => !cache[ip] && !lookingUp.current.has(ip));
    if (needed.length === 0) {
      const cached = {};
      publicIPs.forEach(ip => { if (cache[ip]) cached[ip] = cache[ip]; });
      if (Object.keys(cached).length > 0) setLocations(prev => ({ ...prev, ...cached }));
      return;
    }

    needed.forEach(ip => lookingUp.current.add(ip));

    let cancelled = false;
    (async () => {
      for (const ip of needed.slice(0, 20)) {
        if (cancelled) break;
        const loc = await lookupIP(ip);
        if (!cancelled && loc) {
          setLocations(prev => ({ ...prev, [ip]: loc }));
        }
        await new Promise(r => setTimeout(r, 100));
      }
    })();

    return () => { cancelled = true; };
  }, [ips.join(',')]);

  return locations;
}

export function formatLocation(ip, locations) {
  const clean = (ip || '').replace(/^::ffff:/, '');
  const loc = locations[clean];
  if (!loc) return null;
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.country) return loc.country;
  return null;
}
