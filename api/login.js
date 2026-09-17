import { COOKIE, makeSession, sameSecret } from './_auth.js';

const maxAge = 60 * 60 * 12;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedUser || !expectedPass || !secret) {
    return res.status(500).json({ error: 'Admin authentication is not configured.' });
  }

  const okUser = sameSecret(username, expectedUser);
  const okPass = sameSecret(password, expectedPass);
  if (!okUser || !okPass) return res.status(401).json({ error: 'Неверный логин или пароль.' });

  const token = makeSession(expectedUser);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
  return res.status(200).json({ ok: true });
}
