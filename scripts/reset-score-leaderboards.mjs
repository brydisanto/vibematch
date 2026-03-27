/**
 * One-off script to reset the all-time and weekly score leaderboards.
 * Leaves the pin leaderboard untouched.
 *
 * Usage: node scripts/reset-score-leaderboards.mjs
 *
 * Requires .env.local with KV_REST_API_URL and KV_REST_API_TOKEN.
 */
import { createClient } from '@vercel/kv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k, v.join('=').replace(/^"|"$/g, '')]; })
);

const kvUrl = env.KV_REST_API_URL;
const kvToken = env.KV_REST_API_TOKEN;

if (!kvUrl || !kvToken) {
  console.error('Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env.local');
  process.exit(1);
}

const kv = createClient({ url: kvUrl, token: kvToken });

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

async function main() {
  const monday = getMonday();
  const weeklyKey = `classic_weekly:${monday}`;

  console.log('Resetting score leaderboards...');
  console.log(`  All-time key: classic_leaderboard`);
  console.log(`  Weekly key:   ${weeklyKey}`);
  console.log(`  Pin leaderboard: NOT touched`);
  console.log();

  // Show current counts before deletion
  const [allTimeCount, weeklyCount] = await Promise.all([
    kv.zcard('classic_leaderboard'),
    kv.zcard(weeklyKey),
  ]);
  console.log(`  All-time entries: ${allTimeCount}`);
  console.log(`  Weekly entries:   ${weeklyCount}`);
  console.log();

  // Delete
  const results = await Promise.all([
    kv.del('classic_leaderboard'),
    kv.del(weeklyKey),
  ]);

  console.log(`Deleted classic_leaderboard: ${results[0] ? 'OK' : 'not found'}`);
  console.log(`Deleted ${weeklyKey}: ${results[1] ? 'OK' : 'not found'}`);
  console.log();
  console.log('Done. Leaderboards are now empty.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
