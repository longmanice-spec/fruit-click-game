import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const LEADERBOARD_KEY = 'fruit-slash:leaderboard';
const MAX_ENTRIES = 50;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return getLeaderboard(req, res);
  }

  if (req.method === 'POST') {
    return submitScore(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getLeaderboard(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_ENTRIES);

  const entries = await redis.zrange(LEADERBOARD_KEY, 0, limit - 1, { rev: true, withScores: true });

  const scores = [];
  for (let i = 0; i < entries.length; i += 2) {
    const raw = entries[i];
    const score = entries[i + 1];
    try {
      const data = JSON.parse(raw);
      scores.push({ name: data.name, score: parseInt(score), combo: data.combo || 0 });
    } catch {
      scores.push({ name: raw, score: parseInt(score), combo: 0 });
    }
  }

  return res.status(200).json({ scores });
}

async function submitScore(req, res) {
  const { name, score, combo } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!score || typeof score !== 'number' || score < 0 || score > 999999) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  const cleanName = name.trim().slice(0, 12);
  const member = JSON.stringify({ name: cleanName, combo: combo || 0, ts: Date.now() });

  await redis.zadd(LEADERBOARD_KEY, { score, member });

  const count = await redis.zcard(LEADERBOARD_KEY);
  if (count > MAX_ENTRIES) {
    await redis.zremrangebyrank(LEADERBOARD_KEY, 0, count - MAX_ENTRIES - 1);
  }

  return res.status(200).json({ success: true, name: cleanName, score });
}
