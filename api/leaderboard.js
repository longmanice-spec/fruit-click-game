import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = 'fruit-slash:leaderboard';
const MAX_ENTRIES = 50;

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method === 'GET') {
      return await getLeaderboard(req, res);
    }
    if (req.method === 'POST') {
      return await submitScore(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: 'Internal server error', detail: e.message });
  }
}

async function getLeaderboard(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_ENTRIES);

  const entries = await redis.zrange(KEY, 0, limit - 1, { rev: true, withScores: true });

  const scores = [];

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'score' in entry) {
        const member = entry.member || entry.value;
        const sc = Number(entry.score);
        try {
          const data = typeof member === 'string' ? JSON.parse(member) : member;
          scores.push({ name: data.name || 'Unknown', score: sc, combo: data.combo || 0 });
        } catch {
          scores.push({ name: String(member), score: sc, combo: 0 });
        }
      } else if (typeof entry === 'string' || typeof entry === 'number') {
        // Flat format fallback: [member, score, member, score, ...]
        // Re-fetch without withScores parsing
        break;
      }
    }

    // Flat array fallback
    if (scores.length === 0 && entries.length > 0 && typeof entries[0] !== 'object') {
      for (let i = 0; i < entries.length - 1; i += 2) {
        const raw = entries[i];
        const sc = Number(entries[i + 1]);
        try {
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          scores.push({ name: data.name || 'Unknown', score: sc, combo: data.combo || 0 });
        } catch {
          scores.push({ name: String(raw), score: sc, combo: 0 });
        }
      }
    }
  }

  return res.status(200).json({ scores });
}

async function submitScore(req, res) {
  const { name, score, combo } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (score === undefined || typeof score !== 'number' || score < 0 || score > 999999) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  const cleanName = name.trim().slice(0, 12);
  const member = JSON.stringify({ name: cleanName, combo: combo || 0, ts: Date.now() });

  await redis.zadd(KEY, { score, member });

  const count = await redis.zcard(KEY);
  if (count > MAX_ENTRIES) {
    await redis.zremrangebyrank(KEY, 0, count - MAX_ENTRIES - 1);
  }

  return res.status(200).json({ success: true, name: cleanName, score });
}
