import crypto from 'node:crypto';

const COOKIE = 'admin_session';
const maxAge = 60 * 60 * 12;

function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(value).digest('hex');
}

function cookie(value) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedUser || !expectedPass || !secret) {
    return res.status(500).json({ error: 'Admin authentication is not configured.' });
  }

  const okUser = typeof username === 'string' && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
  const okPass = typeof password === 'string' && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));
  if (!okUser || !okPass) return res.status(401).json({ error: 'Неверный логин или пароль.' });

  const payload = `${expectedUser}.${Date.now()}`;
  const token = Buffer.from(`${payload}.${sign(payload)}`).toString('base64url');
  res.setHeader('Set-Cookie', cookie(token));
  return res.status(200).json({ ok: true });
}
