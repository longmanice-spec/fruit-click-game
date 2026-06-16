import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_ENTRIES = 50;
const VALID_GAMES = ['slash', 'match3'];

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

  // Use raw ZREVRANGE with WITHSCORES via pipeline for single round-trip
  const result = await redis.zrange(KEY, 0, limit - 1, { rev: true, withScores: true });

  let scores = parseResult(result);

  // Fallback to legacy key for slash
  if (scores.length === 0 && game === 'slash') {
    const legacy = await redis.zrange('fruit-slash:leaderboard', 0, limit - 1, { rev: true, withScores: true });
    scores = parseResult(legacy);
  }

  return res.status(200).json({ scores });
}

function parseResult(result) {
  if (!result || !Array.isArray(result) || result.length === 0) return [];

  const scores = [];

  // Format 1: array of {member/value, score} objects
  if (typeof result[0] === 'object' && result[0] !== null && ('score' in result[0] || 'member' in result[0])) {
    for (const entry of result) {
      const member = entry.member || entry.value || entry;
      const sc = Number(entry.score || 0);
      scores.push(parseMember(member, sc));
    }
    return scores;
  }

  // Format 2: flat array [member, score, member, score, ...]
  if (typeof result[0] === 'string' || typeof result[0] === 'number') {
    for (let i = 0; i < result.length - 1; i += 2) {
      const member = result[i];
      const sc = Number(result[i + 1]);
      scores.push(parseMember(member, sc));
    }
    return scores;
  }

  return scores;
}

function parseMember(member, sc) {
  try {
    const data = typeof member === 'string' ? JSON.parse(member) : member;
    return { name: data.name || 'Unknown', score: sc, combo: data.combo || 0 };
  } catch {
    return { name: String(member), score: sc, combo: 0 };
  }
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
