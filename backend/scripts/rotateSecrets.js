#!/usr/bin/env node
// scripts/rotateSecrets.js
//
// ── What this does ───────────────────────────────────────────────
// Rotates the three JWT access-token signing secrets once per hour:
//
//   Before:  PREV=A   CURR=B   NEXT=C
//   After:   PREV=B   CURR=C   NEXT=<new random>
//
// Tokens signed with the old CURR (B) are still verifiable via PREV
// for one full hour after rotation, giving every active session time
// to do a silent refresh before the key it was signed with disappears.
//
// ── How to run ───────────────────────────────────────────────────
// Option 1 — Built-in scheduler (recommended for single-server):
//   node scripts/rotateSecrets.js --daemon
//   Runs the rotation immediately on start, then every hour.
//
// Option 2 — External cron (recommended for multi-instance / PM2):
//   Add to crontab:   0 * * * * node /app/scripts/rotateSecrets.js
//   Each instance picks up the new .env values via process.env refresh
//   (see note below about env reloading).
//
// Option 3 — Call rotateSecrets() programmatically from server.js:
//   import { startSecretRotation } from './scripts/rotateSecrets.js';
//   startSecretRotation(); // call once after connectDB()
//
// ── .env file update ─────────────────────────────────────────────
// The script reads/writes the .env file in the project root (process.cwd()).
// On Render / Railway / Fly.io you should instead write to the platform's
// secret store via their CLI/API. See the "Platform notes" section below.
//
// ── Multi-instance note ──────────────────────────────────────────
// If you run multiple Node processes (PM2 cluster, multiple Render
// instances), all instances must see the same secrets at the same time.
// Store JWT_SECRET_PREV/CURR/NEXT in a shared secret store (Render env
// group, AWS Secrets Manager, HashiCorp Vault) and reload them in each
// process after every rotation. The simplest approach on single-server
// PM2 is to use the --daemon mode which calls process.env mutation
// directly, keeping all forks in sync via the cluster IPC.
// ─────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE  = path.resolve(process.cwd(), '.env');

// How many bytes of entropy per secret (256 bits = 32 bytes hex → 64 chars)
const SECRET_BYTES = 32;

// ── Generate a cryptographically secure random secret ────────────
function generateSecret() {
  return crypto.randomBytes(SECRET_BYTES).toString('hex');
}

// ── Read the current .env file as a key→value map ────────────────
function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const map = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, ''); // strip quotes
    map[key] = val;
  }
  return map;
}

// ── Write a key→value map back to the .env file ──────────────────
// Preserves lines that aren't in `updates`, only replaces/adds the
// keys in `updates`. This way unrelated env vars are left untouched.
function writeEnv(updates) {
  let lines = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, 'utf8').split('\n')
    : [];

  const updatedKeys = new Set();

  // Update existing lines
  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (key in updates) {
      updatedKeys.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  // Append any keys that didn't exist yet
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

// ── Core rotation logic ───────────────────────────────────────────
export function rotateSecrets() {
  const env = readEnv();

  const prev = env.JWT_SECRET_CURR || process.env.JWT_SECRET_CURR || '';
  const curr = env.JWT_SECRET_NEXT || process.env.JWT_SECRET_NEXT || generateSecret();
  const next = generateSecret();

  const updates = {
    JWT_SECRET_PREV: prev,
    JWT_SECRET_CURR: curr,
    JWT_SECRET_NEXT: next,
  };

  // 1. Persist to .env so the next process restart picks up the new values
  writeEnv(updates);

  // 2. Mutate process.env in the running process so the change takes
  //    effect immediately without a restart. All three token-signing /
  //    verification functions in tokens.js read process.env at call time
  //    (not at import time), so they pick this up instantly.
  process.env.JWT_SECRET_PREV = prev;
  process.env.JWT_SECRET_CURR = curr;
  process.env.JWT_SECRET_NEXT = next;

  console.log(
    `[rotateSecrets] ${new Date().toISOString()} — secrets rotated. ` +
    `PREV=${prev.slice(0, 8)}…  CURR=${curr.slice(0, 8)}…  NEXT=${next.slice(0, 8)}…`
  );
}

// ── Daemon mode: rotate now, then every hour ──────────────────────
export function startSecretRotation() {
  // Run immediately so the server always starts with a valid CURR
  rotateSecrets();

  // Then rotate every hour on the dot
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const timer = setInterval(rotateSecrets, ONE_HOUR_MS);

  // Don't keep the process alive just for this timer
  if (timer.unref) timer.unref();

  console.log('[rotateSecrets] Hourly secret rotation scheduled.');
  return timer;
}

// ── Bootstrap: ensure all three slots are populated ──────────────
// Called once on first deploy to seed PREV/CURR/NEXT if they don't
// exist yet. Safe to run multiple times — only fills missing slots.
export function bootstrapSecrets() {
  const env = readEnv();
  const updates = {};

  if (!env.JWT_SECRET_PREV && !process.env.JWT_SECRET_PREV) {
    updates.JWT_SECRET_PREV = generateSecret();
  }
  if (!env.JWT_SECRET_CURR && !process.env.JWT_SECRET_CURR) {
    // If the old single-secret key exists, promote it to CURR so
    // any tokens already in the wild continue to verify.
    updates.JWT_SECRET_CURR =
      env.JWT_ACCESS_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      generateSecret();
  }
  if (!env.JWT_SECRET_NEXT && !process.env.JWT_SECRET_NEXT) {
    updates.JWT_SECRET_NEXT = generateSecret();
  }

  if (Object.keys(updates).length > 0) {
    writeEnv(updates);
    Object.assign(process.env, updates);
    console.log('[rotateSecrets] Bootstrap: seeded missing secret slots →', Object.keys(updates).join(', '));
  } else {
    console.log('[rotateSecrets] Bootstrap: all secret slots already present, no changes needed.');
  }
}

// ── CLI entry point ───────────────────────────────────────────────
// node scripts/rotateSecrets.js            → rotate once and exit
// node scripts/rotateSecrets.js --daemon   → rotate now + every hour
// node scripts/rotateSecrets.js --bootstrap → seed missing slots only
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--daemon') {
    startSecretRotation();
    // Keep process alive
    setInterval(() => {}, 1 << 30);
  } else if (arg === '--bootstrap') {
    bootstrapSecrets();
  } else {
    rotateSecrets();
  }
}

// ── Platform notes ───────────────────────────────────────────────
// Render:
//   .env file writes work in development but NOT in production because
//   Render's filesystem is ephemeral. Use Render's "Secret Files" or
//   update the service's environment variables via the Render API:
//     PATCH https://api.render.com/v1/services/{id}/env-vars
//   Then trigger a redeploy, or use the in-process mutation above
//   (process.env assignment) which works without a restart on a
//   single Render web service.
//
// Railway / Fly.io / Heroku:
//   Same pattern — use the platform's CLI to update env vars:
//     railway variables set JWT_SECRET_PREV=... JWT_SECRET_CURR=... JWT_SECRET_NEXT=...
//   Or use the in-process mutation for zero-downtime rotation on
//   a single instance.
