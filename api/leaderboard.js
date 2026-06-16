import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_ENTRIES = 50;
const VALID_GAMES = ['slash', 'match3', 'tetris', '2048', 'flappy'];

function getKey(game) {
  return 'fruit-slash:leaderboard:' + (VALID_GAMES.includes(game) ? game : 'slash');
}

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
  const game = req.query.game || 'slash';
  const KEY = getKey(game);
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_ENTRIES);

  let scores = await fetchScores(KEY, limit);

  // Fallback to legacy key
  if (scores.length === 0 && game === 'slash') {
    scores = await fetchScores('fruit-slash:leaderboard', limit);
  }

  return res.status(200).json({ scores });
}

async function fetchScores(key, limit) {
  // Get members without scores (single request)
  const members = await redis.zrange(key, 0, limit - 1, { rev: true });
  if (!members || members.length === 0) return [];

  // Use pipeline to get all scores in one round-trip
  const pipeline = redis.pipeline();
  for (const m of members) {
    pipeline.zscore(key, m);
  }
  const scoreResults = await pipeline.exec();

  const scores = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const sc = Number(scoreResults[i] || 0);
    try {
      const data = typeof member === 'string' ? JSON.parse(member) : member;
      scores.push({ name: data.name || 'Unknown', score: sc, combo: data.combo || 0 });
    } catch {
      scores.push({ name: String(member), score: sc, combo: 0 });
    }
  }
  return scores;
}

async function submitScore(req, res) {
  const { name, score, combo, game } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (score === undefined || typeof score !== 'number' || score < 0 || score > 999999) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  const KEY = getKey(game || 'slash');
  const cleanName = name.trim().slice(0, 12);
  const member = JSON.stringify({ name: cleanName, combo: combo || 0, ts: Date.now() });

  await redis.zadd(KEY, { score, member });

  const count = await redis.zcard(KEY);
  if (count > MAX_ENTRIES) {
    await redis.zremrangebyrank(KEY, 0, count - MAX_ENTRIES - 1);
  }

  return res.status(200).json({ success: true, name: cleanName, score });
}
